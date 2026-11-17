import {
	applyEdgeChanges,
	applyNodeChanges,
	Background,
	ConnectionMode,
	PanOnScrollMode,
	ControlButton,
	Controls,
	ReactFlow,
	ReactFlowProvider,
	useReactFlow,
	type Edge,
	type EdgeChange,
	type EdgeTypes,
	type Node,
	type NodeChange,
	type NodeTypes
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type ComponentType,
	type CSSProperties,
	type DragEvent
} from 'react';
import type {
	Diagram,
	DiagramEdge,
	DiagramNode,
	Point,
	ProjectDocument,
	Route
} from '@simple-modelisation/model/project.ts';
import {
	reportPresence,
	useCursorReporter,
	usePresence,
	useRemoteSelections
} from '../presence/presence-context';
import { RemoteCursors } from '../presence/RemoteCursors';
import {
	estimatedSize,
	layoutDiagram,
	layoutFingerprint
} from '@simple-modelisation/model/layout.ts';
import { zoneContent, zoneParents } from '@simple-modelisation/model/zones.ts';
import { strings } from '../ui/strings';
import { downloadBlob } from '../ui/download';
import { CanvasContext } from './canvas-context';
import { captureViewport, drawnBounds, exportFrame } from './export-image';
import { registerExporter } from './exporter';
import type { Layout } from './layout';

/** MIME type of what the palette drags onto the canvas. */
export const PALETTE_MIME = 'application/x-simple-modelisation';

export type Selection = { node?: DiagramNode; edge?: DiagramEdge };

/** Where an edge sits among the edges joining the same two nodes, for drawing them apart. */
export type TwinPosition = { twinIndex: number; twinCount: number };

/** Set on an edge another Participant selected: its color. */
export type RemoteHighlight = { remoteColor?: string };

/** What makes one Diagram kind: its nodes, edges, palette, properties panel and gestures. */
export type CanvasKind = {
	nodeTypes: NodeTypes;
	edgeTypes: EdgeTypes;
	Palette: ComponentType;
	Panel: ComponentType<{ selection: Selection }>;
	/**
	 * Adjusts what is drawn (positions, edge data) without touching the
	 * document: the MCD's UML Notation. A hook, called on every render.
	 */
	useLayout: () => Layout;
	/** Shown under the canvas (the MCD's MLD and SQL). */
	Footer?: ComponentType<{ diagram: Diagram }>;
	drop: (project: ProjectDocument, diagramId: string, item: string, x: number, y: number) => void;
	connect: (project: ProjectDocument, diagramId: string, source: string, target: string) => void;
};

type Props = { project: ProjectDocument; diagram: Diagram; kind: CanvasKind };

export function DiagramCanvas(props: Props) {
	const context = useMemo(
		() => ({ project: props.project, diagramId: props.diagram.id }),
		[props.project, props.diagram.id]
	);
	return (
		<CanvasContext value={context}>
			<ReactFlowProvider>
				{/* Keyed by Diagram: the kind's hooks (useLayout) must not change on one instance. */}
				<Canvas key={props.diagram.id} {...props} />
			</ReactFlowProvider>
		</CanvasContext>
	);
}

/**
 * One Diagram on a React Flow canvas (ADR 0002). Positions and selection live
 * in local state while dragging; the Project document stays the source of truth.
 */
function Canvas({ project, diagram, kind }: Props) {
	const { screenToFlowPosition, fitView, getNodes } = useReactFlow();
	const flowRef = useRef<HTMLDivElement>(null);

	// Fit once the tidied positions have reached React Flow, not before.
	const [fitPending, setFitPending] = useState(false);

	// Tidy up: arrange the whole Diagram along its links with the sizes drawn, as one undo step.
	const tidying = useRef(false);
	const tidyUp = async () => {
		if (tidying.current) return;
		tidying.current = true;
		try {
			const measured = new Map(getNodes().map((n) => [n.id, n.measured]));
			// The positions are shared by every Notation: never smaller than either draws a box.
			const sizeOf = (node: DiagramNode) => {
				const size = measured.get(node.id);
				const guess = estimatedSize(node);
				return {
					width: Math.max(size?.width ?? 0, guess.width),
					height: Math.max(size?.height ?? 0, guess.height)
				};
			};
			// The layout is asynchronous: if the Diagram changed meanwhile (here or by a
			// peer), lay it out again rather than overwrite the change.
			for (let attempt = 0; attempt < 3; attempt++) {
				const nodes = project.nodes(diagram.id);
				const edges = project.edges(diagram.id);
				const before = layoutFingerprint(nodes, edges);
				const { positions, routes, zoneSizes } = await layoutDiagram(
					nodes,
					edges,
					sizeOf,
					diagram.kind
				);
				if (layoutFingerprint(project.nodes(diagram.id), project.edges(diagram.id)) !== before) {
					continue;
				}
				project.arrange(diagram.id, positions, routes, zoneSizes);
				setFitPending(true);
				return;
			}
		} catch (error) {
			console.error('Tidy up failed', error);
		} finally {
			tidying.current = false;
		}
	};

	const toNodes = useCallback((): Node[] => {
		const all = project.nodes(diagram.id);
		// Zones under everything else, each under the Zones it holds; low enough that
		// React Flow's +1000 for a selected node keeps a Zone under the Components.
		const zones = all.filter((n) => n.type === 'zone');
		const parents = zoneParents(zones, estimatedSize);
		const depth = (id: string) => {
			let count = 0;
			for (let at = parents.get(id); at; at = parents.get(at)) count++;
			return count;
		};
		return all.map((n) =>
			n.type === 'zone'
				? {
						id: n.id,
						type: n.type,
						position: { x: n.x, y: n.y },
						width: n.width as number,
						height: n.height as number,
						zIndex: depth(n.id) - 2000,
						dragHandle: '.zone-title',
						data: n
					}
				: { id: n.id, type: n.type, position: { x: n.x, y: n.y }, data: n }
		);
	}, [project, diagram.id]);
	const toEdges = useCallback((): Edge[] => {
		const all = project.edges(diagram.id);
		// Edges joining the same two nodes (a reflexive Association's Legs) are drawn apart.
		const twins = new Map<string, number>();
		for (const e of all) twins.set(pairKey(e), (twins.get(pairKey(e)) ?? 0) + 1);
		const seen = new Map<string, number>();
		return all.map((e) => {
			const twinIndex = seen.get(pairKey(e)) ?? 0;
			seen.set(pairKey(e), twinIndex + 1);
			return {
				id: e.id,
				type: e.type,
				source: e.source,
				target: e.target,
				data: { ...e, twinIndex, twinCount: twins.get(pairKey(e)) ?? 1 }
			};
		});
	}, [project, diagram.id]);

	const [nodes, setNodes] = useState(toNodes);
	const [edges, setEdges] = useState(toEdges);

	useEffect(() => {
		const sync = () => {
			setNodes((previous) => keepSelection(previous, toNodes()));
			setEdges((previous) => keepSelection(previous, toEdges()));
		};
		sync();
		return project.subscribe(sync);
	}, [project, toNodes, toEdges]);

	useEffect(() => {
		if (!fitPending) return;
		const frame = requestAnimationFrame(() => {
			void fitView({ duration: 300, maxZoom: 1 });
			setFitPending(false);
		});
		return () => cancelAnimationFrame(frame);
	}, [fitPending, nodes, fitView]);

	// Export: the whole Diagram, framed on what it draws, drawn for the time of the
	// capture without anyone's selection; one export at a time.
	const [exporting, setExporting] = useState(false);
	const exportBusy = useRef(false);
	useEffect(
		() =>
			registerExporter(async (format) => {
				const viewport = flowRef.current?.querySelector<HTMLElement>('.react-flow__viewport');
				if (!viewport || exportBusy.current) return false;
				exportBusy.current = true;
				setExporting(true);
				try {
					await new Promise((resolve) =>
						requestAnimationFrame(() => requestAnimationFrame(resolve))
					);
					const bounds = drawnBounds(viewport, screenToFlowPosition);
					if (!bounds) return false;
					const image = await captureViewport(viewport, exportFrame(bounds), format);
					downloadBlob(`${diagram.name}.${format}`, image);
					return true;
				} finally {
					exportBusy.current = false;
					setExporting(false);
				}
			}),
		[diagram.name, screenToFlowPosition]
	);

	// Dragging a Zone takes along what it holds when the drag starts.
	const carried = useRef<{ zones: Map<string, Point>; content: Map<string, Point> } | null>(null);
	const onNodeDragStart = (dragged: Node[]) => {
		project.stopCapturing();
		const zones = dragged.filter((n) => n.type === 'zone');
		if (zones.length === 0) return;
		// At the model's sizes, as Tidy up and agents see it.
		const all = new Map(project.nodes(diagram.id).map((n) => [n.id, n]));
		const parents = zoneParents([...all.values()], estimatedSize);
		const moving = new Set(dragged.map((n) => n.id));
		const content = new Map<string, Point>();
		for (const zone of zones) {
			for (const id of zoneContent(parents, zone.id)) {
				const node = all.get(id);
				if (node && !moving.has(id)) content.set(id, { x: node.x, y: node.y });
			}
		}
		carried.current = {
			zones: new Map(zones.map((z) => [z.id, z.data as DiagramNode])),
			content
		};
	};
	const onNodeDrag = (dragged: Node[]) => {
		const carry = carried.current;
		if (!carry || carry.content.size === 0) return;
		const zone = dragged.find((n) => carry.zones.has(n.id));
		if (!zone) return;
		const start = carry.zones.get(zone.id)!;
		const dx = zone.position.x - start.x;
		const dy = zone.position.y - start.y;
		setNodes((current) =>
			current.map((n) => {
				const from = carry.content.get(n.id);
				return from ? { ...n, position: { x: from.x + dx, y: from.y + dy } } : n;
			})
		);
	};
	const onNodeDragStop = (dragged: Node[]) => {
		const moves = dragged.map((n) => ({ id: n.id, ...n.position }));
		const carry = carried.current;
		carried.current = null;
		const zone = carry && dragged.find((n) => carry.zones.has(n.id));
		if (carry && zone) {
			const start = carry.zones.get(zone.id)!;
			const dx = zone.position.x - start.x;
			const dy = zone.position.y - start.y;
			for (const [id, from] of carry.content) moves.push({ id, x: from.x + dx, y: from.y + dy });
		}
		project.moveNodes(diagram.id, moves);
	};

	const onNodesChange = useCallback(
		(changes: NodeChange[]) => setNodes((current) => applyNodeChanges(changes, current)),
		[setNodes]
	);
	const onEdgesChange = useCallback(
		(changes: EdgeChange[]) => setEdges((current) => applyEdgeChanges(changes, current)),
		[setEdges]
	);

	// Presence: share the pointer and the selection; outline what others selected.
	const { awareness } = usePresence();
	const cursor = useCursorReporter();
	const selectionKey = JSON.stringify(
		[...nodes, ...edges].filter((e) => e.selected).map((e) => e.id)
	);
	useEffect(() => {
		reportPresence(awareness, { selection: JSON.parse(selectionKey) as string[] });
	}, [awareness, selectionKey]);
	const remoteSelections = useRemoteSelections(diagram.id);
	const shownNodes = useMemo(
		() =>
			nodes.map((n) => {
				if (exporting) return n.selected ? { ...n, selected: false } : n;
				const color = remoteSelections.get(n.id);
				if (!color) return n;
				// The node's own box draws the outline, so it follows its shape (see .remote-selected).
				const style = { ...n.style, '--remote-color': color } as CSSProperties;
				return { ...n, className: `${n.className ?? ''} remote-selected`, style };
			}),
		[nodes, remoteSelections, exporting]
	);
	const shownEdges = useMemo(
		() =>
			edges.map((e) => {
				if (exporting) return e.selected ? { ...e, selected: false } : e;
				const color = remoteSelections.get(e.id);
				return color ? { ...e, data: { ...e.data, remoteColor: color } } : e;
			}),
		[edges, remoteSelections, exporting]
	);

	const layout = kind.useLayout();
	const drawn = useMemo(() => {
		// A box being dragged leaves its stored routes behind: draw those edges the default
		// way, before the kind's drawing step (which places labels along the routes).
		// Edges whose two ends move alike (a Zone and its content) keep their route, shifted.
		const moving = new Map<string, Point>();
		for (const n of shownNodes) {
			const stored = n.data as DiagramNode;
			const offset = { x: n.position.x - stored.x, y: n.position.y - stored.y };
			if (offset.x !== 0 || offset.y !== 0) moving.set(n.id, offset);
		}
		const edges =
			moving.size === 0
				? shownEdges
				: shownEdges.map((e) => {
						const source = moving.get(e.source) ?? { x: 0, y: 0 };
						const target = moving.get(e.target) ?? { x: 0, y: 0 };
						if (!moving.has(e.source) && !moving.has(e.target)) return e;
						const points = (e.data as Route | undefined)?.points;
						const together = source.x === target.x && source.y === target.y;
						return {
							...e,
							data: {
								...e.data,
								points:
									together && points
										? points.map((p) => ({ x: p.x + source.x, y: p.y + source.y }))
										: undefined
							}
						};
					});
		return layout(shownNodes, edges);
	}, [layout, shownNodes, shownEdges]);

	const selectedNodes = nodes.filter((n) => n.selected);
	const selectedEdges = edges.filter((e) => e.selected);
	const selection: Selection =
		selectedNodes.length + selectedEdges.length !== 1
			? {}
			: {
					node: selectedNodes[0]?.data as DiagramNode | undefined,
					edge: selectedEdges[0]?.data as DiagramEdge | undefined
				};

	const onDrop = (event: DragEvent) => {
		const item = event.dataTransfer.getData(PALETTE_MIME);
		if (!item) return;
		event.preventDefault();
		const { x, y } = screenToFlowPosition({ x: event.clientX, y: event.clientY });
		project.stopCapturing();
		kind.drop(project, diagram.id, item, x, y);
	};

	return (
		<div className="workspace">
			<kind.Palette />
			<div className="flow-column">
				<div
					ref={flowRef}
					className="flow"
					onDrop={onDrop}
					onDragOver={(e) => e.preventDefault()}
					onPointerMove={(e) => {
						const { x, y } = screenToFlowPosition({ x: e.clientX, y: e.clientY });
						cursor.move(x, y);
					}}
					onPointerLeave={cursor.leave}
				>
					<ReactFlow
						nodes={drawn.nodes}
						edges={drawn.edges}
						nodeTypes={kind.nodeTypes}
						edgeTypes={kind.edgeTypes}
						onNodesChange={onNodesChange}
						onEdgesChange={onEdgesChange}
						onNodeDragStart={(_event, _node, dragged) => onNodeDragStart(dragged)}
						onNodeDrag={(_event, _node, dragged) => onNodeDrag(dragged)}
						onNodeDragStop={(_event, _node, dragged) => onNodeDragStop(dragged)}
						onConnect={({ source, target }) => {
							project.stopCapturing();
							kind.connect(project, diagram.id, source, target);
						}}
						onDelete={({ nodes: deletedNodes, edges: deletedEdges }) => {
							project.stopCapturing();
							project.deleteElements(
								diagram.id,
								deletedNodes.map((n) => n.id),
								deletedEdges.map((e) => e.id)
							);
						}}
						connectionMode={ConnectionMode.Loose}
						// Trackpad gestures, as in Figma: two fingers pan, a pinch zooms (it arrives as a
						// ctrl+wheel), and a mouse wheel zooms with Cmd (Ctrl elsewhere) held, React Flow's
						// default zoom key.
						panOnScroll
						panOnScrollMode={PanOnScrollMode.Free}
						zoomOnPinch
						fitView
						fitViewOptions={{ maxZoom: 1 }}
						proOptions={{ hideAttribution: true }}
					>
						<Background gap={16} />
						<RemoteCursors diagramId={diagram.id} />
						<Controls showInteractive={false}>
							<ControlButton
								onClick={() => void tidyUp()}
								title={strings.canvas.tidyUp}
								aria-label={strings.canvas.tidyUp}
							>
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
									<rect x="3" y="4" width="6" height="5" rx="1" />
									<rect x="15" y="4" width="6" height="5" rx="1" />
									<rect x="15" y="15" width="6" height="5" rx="1" />
									<path d="M9 6.5h6M18 9v6" />
								</svg>
							</ControlButton>
						</Controls>
					</ReactFlow>
				</div>
				{kind.Footer && <kind.Footer diagram={diagram} />}
			</div>
			<aside className="panel">
				<kind.Panel selection={selection} />
			</aside>
		</div>
	);
}

const pairKey = (e: DiagramEdge) => `${e.source}|${e.target}`;

/**
 * Carries over what React Flow knows of the previous elements: the selection,
 * and a node's measured size, so drawing steps that need sizes (label
 * placement) do not lose them for a frame after every document change.
 */
function keepSelection<T extends { id: string; selected?: boolean; measured?: unknown }>(
	previous: T[],
	next: T[]
): T[] {
	const before = new Map(previous.map((e) => [e.id, e]));
	return next.map((e) => {
		const old = before.get(e.id);
		if (!old?.selected && !old?.measured) return e;
		return {
			...e,
			...(old.selected && { selected: true }),
			...(old.measured ? { measured: old.measured } : {})
		};
	});
}
