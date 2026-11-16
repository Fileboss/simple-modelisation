import {
	applyEdgeChanges,
	applyNodeChanges,
	Background,
	ConnectionMode,
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
	useState,
	type ComponentType,
	type CSSProperties,
	type DragEvent
} from 'react';
import type {
	Diagram,
	DiagramEdge,
	DiagramNode,
	ProjectDocument
} from '@simple-modelisation/model/project.ts';
import {
	reportPresence,
	useCursorReporter,
	usePresence,
	useRemoteSelections
} from '../presence/presence-context';
import { RemoteCursors } from '../presence/RemoteCursors';
import { estimatedSize, layoutDiagram } from '@simple-modelisation/model/layout.ts';
import { strings } from '../ui/strings';
import { CanvasContext } from './canvas-context';
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

	// Fit once the tidied positions have reached React Flow, not before.
	const [fitPending, setFitPending] = useState(false);

	// Tidy up: arrange the whole Diagram along its links with the sizes drawn, as one undo step.
	const tidyUp = () => {
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
		const { positions, routes } = layoutDiagram(
			project.nodes(diagram.id),
			project.edges(diagram.id),
			sizeOf
		);
		project.arrange(diagram.id, positions, routes);
		setFitPending(true);
	};

	const toNodes = useCallback(
		(): Node[] =>
			project.nodes(diagram.id).map((n) => ({
				id: n.id,
				type: n.type,
				position: { x: n.x, y: n.y },
				data: n
			})),
		[project, diagram.id]
	);
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
				const color = remoteSelections.get(n.id);
				if (!color) return n;
				// The node's own box draws the outline, so it follows its shape (see .remote-selected).
				const style = { ...n.style, '--remote-color': color } as CSSProperties;
				return { ...n, className: `${n.className ?? ''} remote-selected`, style };
			}),
		[nodes, remoteSelections]
	);
	const shownEdges = useMemo(
		() =>
			edges.map((e) => {
				const color = remoteSelections.get(e.id);
				return color ? { ...e, data: { ...e.data, remoteColor: color } } : e;
			}),
		[edges, remoteSelections]
	);

	const layout = kind.useLayout();
	const drawn = useMemo(() => {
		const laid = layout(shownNodes, shownEdges);
		// A box being dragged leaves its stored routes behind: draw those edges the default way.
		const moving = new Set(
			shownNodes
				.filter((n) => {
					const stored = n.data as DiagramNode;
					return n.position.x !== stored.x || n.position.y !== stored.y;
				})
				.map((n) => n.id)
		);
		if (moving.size === 0) return laid;
		const edges = laid.edges.map((e) =>
			moving.has(e.source) || moving.has(e.target)
				? { ...e, data: { ...e.data, points: undefined } }
				: e
		);
		return { nodes: laid.nodes, edges };
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
						onNodeDragStart={() => project.stopCapturing()}
						onNodeDragStop={(_event, _node, dragged) => {
							project.moveNodes(
								diagram.id,
								dragged.map((n) => ({ id: n.id, ...n.position }))
							);
						}}
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
						fitView
						fitViewOptions={{ maxZoom: 1 }}
						proOptions={{ hideAttribution: true }}
					>
						<Background gap={16} />
						<RemoteCursors diagramId={diagram.id} />
						<Controls showInteractive={false}>
							<ControlButton
								onClick={tidyUp}
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

function keepSelection<T extends { id: string; selected?: boolean }>(
	previous: T[],
	next: T[]
): T[] {
	const selected = new Set(previous.filter((e) => e.selected).map((e) => e.id));
	return next.map((e) => (selected.has(e.id) ? { ...e, selected: true } : e));
}
