import { pasteable } from '@simple-modelisation/model/project.ts';
import { NotePanel } from './NoteNode';
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
	type NodeTypes,
	ViewportPortal
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
	NoteNode,
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
import { captureViewport, drawnBounds, exportFrame, rasterizeSvg } from './export-image';
import { registerExporter } from './exporter';
import type { Layout } from './layout';
import type { Box } from './geometry';
import type { Size } from '@simple-modelisation/model/layout.ts';
import { useSnapGestures } from './use-snap-gestures';
import { isCanvasClipboard, selectionShortcut, withSelection } from './selection';
import {
	clipBounds,
	copyElements,
	readClip,
	type Clip
} from '@simple-modelisation/model/clipboard.ts';
import { draggedPaletteItem, endPaletteDrag, PALETTE_MIME } from './palette-drag';

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
	/**
	 * Adds to each node what it shows but does not store (a Component's
	 * Provider taken from its Zone), each time the document changes.
	 */
	derive?: (nodes: DiagramNode[]) => DiagramNode[];
	/**
	 * Draws the Diagram as plain SVG, at the sizes the canvas measured; kinds
	 * without it export a capture of the canvas.
	 */
	drawSvg?: (
		nodes: DiagramNode[],
		edges: DiagramEdge[],
		sizeOf: (node: DiagramNode) => { width: number; height: number },
		legend: boolean
	) => string;
	/** Shown under the canvas (the MCD's MLD and SQL). */
	Footer?: ComponentType<{ diagram: Diagram }>;
	/** Adds a palette item with its top-left corner at x, y; the new element's id. */
	drop: (
		project: ProjectDocument,
		diagramId: string,
		item: string,
		x: number,
		y: number
	) => string | undefined;
	/** The size and name a palette item is previewed with while it is dragged over the canvas. */
	dropPreview: (item: string) => { width: number; height: number; label: string };
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
		return (kind.derive?.(all) ?? all).map((n) =>
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
	}, [project, diagram.id, kind]);
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
	// Framed on what it holds when it opens. An empty Diagram is framed when content
	// first arrives from a peer or an agent, but not around a first element dropped
	// here: that would move it away from the pointer.
	const [frameOnOpen] = useState(() => nodes.length > 0);
	const framed = useRef(frameOnOpen);
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
			registerExporter(async (format, { legend }) => {
				const viewport = flowRef.current?.querySelector<HTMLElement>('.react-flow__viewport');
				if (!viewport || exportBusy.current) return false;
				if (kind.drawSvg) {
					// The kind's plain SVG, at the sizes React Flow measured (the model's guess otherwise);
					// its PNG is that SVG rasterized, so both formats show the same image.
					const nodes = project.nodes(diagram.id);
					if (nodes.length === 0) return false;
					const measured = new Map(getNodes().map((n) => [n.id, n.measured]));
					const svg = kind.drawSvg(
						nodes,
						project.edges(diagram.id),
						(node) => {
							const size = measured.get(node.id);
							return size?.width && size.height
								? { width: size.width, height: size.height }
								: estimatedSize(node);
						},
						legend
					);
					if (format === 'svg') {
						downloadBlob(`${diagram.name}.svg`, new Blob([svg], { type: 'image/svg+xml' }));
						return true;
					}
					exportBusy.current = true;
					try {
						downloadBlob(`${diagram.name}.png`, await rasterizeSvg(svg));
						return true;
					} finally {
						exportBusy.current = false;
					}
				}
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
		[diagram.name, screenToFlowPosition, kind, project, diagram.id, getNodes]
	);

	const onResized = useCallback(
		(id: string, box: Box) => project.setZoneBox(diagram.id, id, box),
		[project, diagram.id]
	);
	const snapping = useSnapGestures(edges, onResized);

	// Dragging a Zone takes along what it holds when the drag starts.
	const carried = useRef<{ zones: Map<string, Point>; content: Map<string, Point> } | null>(null);
	const onNodeDragStart = (dragged: Node[]) => {
		project.stopCapturing();
		const zones = dragged.filter((n) => n.type === 'zone');
		if (zones.length === 0) {
			snapping.beginDrag(dragged.map((n) => n.id));
			return;
		}
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
		snapping.beginDrag(
			dragged.map((n) => n.id),
			content.keys()
		);
	};
	const onNodeDrag = (dragged: Node[]) => {
		const carry = carried.current;
		if (!carry || carry.content.size === 0) return;
		const zone = dragged.find((n) => carry.zones.has(n.id));
		if (!zone) return;
		// The content follows the Zone where it is drawn, snapped.
		const at = snapping.draggedAt(zone.id) ?? zone.position;
		const start = carry.zones.get(zone.id)!;
		const dx = at.x - start.x;
		const dy = at.y - start.y;
		setNodes((current) =>
			current.map((n) => {
				const from = carry.content.get(n.id);
				return from ? { ...n, position: { x: from.x + dx, y: from.y + dy } } : n;
			})
		);
	};
	const onNodeDragStop = (dragged: Node[]) => {
		// Saved where it is drawn, snapped.
		const moves = dragged.map((n) => ({ id: n.id, ...(snapping.draggedAt(n.id) ?? n.position) }));
		const zoneAt = (id: string, fallback: Point) => snapping.draggedAt(id) ?? fallback;
		const carry = carried.current;
		carried.current = null;
		const zone = carry && dragged.find((n) => carry.zones.has(n.id));
		if (carry && zone) {
			const start = carry.zones.get(zone.id)!;
			const at = zoneAt(zone.id, zone.position);
			const dx = at.x - start.x;
			const dy = at.y - start.y;
			for (const [id, from] of carry.content) moves.push({ id, x: from.x + dx, y: from.y + dy });
		}
		snapping.endDrag();
		project.moveNodes(diagram.id, moves);
	};

	const { snapChanges } = snapping;
	const onNodesChange = useCallback(
		(changes: NodeChange[]) => {
			const snapped = snapChanges(changes);
			setNodes((current) => applyNodeChanges(snapped, current));
		},
		[setNodes, snapChanges]
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

	// Where the pointer is over the canvas, on screen: a paste lands under it, wherever the
	// view has moved since.
	const pointerAt = useRef<Point | null>(null);
	// Whether the canvas was the last thing clicked: its shortcuts act only then.
	const canvasActive = useRef(false);

	// Keyboard and clipboard, while the canvas was the last thing clicked: Cmd/Ctrl+A selects
	// everything, Escape nothing; copy, cut, paste and Cmd/Ctrl+D duplicate the selection.
	useEffect(() => {
		const onPointer = (e: PointerEvent) => {
			canvasActive.current = Boolean(flowRef.current?.contains(e.target as globalThis.Node));
		};
		const copied = () => {
			const ids = getNodes()
				.filter((n) => n.selected)
				.map((n) => n.id);
			return ids.length
				? copyElements(project.nodes(diagram.id), project.edges(diagram.id), ids, diagram.kind)
				: null;
		};
		/** Pastes centred under the pointer when it is over the canvas, else 24px off; selects it. */
		const pasteClip = (clip: Clip, underPointer: boolean) => {
			// Centred on what this Diagram takes of the clip, not on what it leaves out.
			const { nodes } = pasteable(clip, diagram.kind);
			if (nodes.length === 0) return;
			const bounds = clipBounds(nodes);
			const at = underPointer && pointerAt.current ? screenToFlowPosition(pointerAt.current) : null;
			const dx = at ? at.x - (bounds.x + bounds.width / 2) : 24;
			const dy = at ? at.y - (bounds.y + bounds.height / 2) : 24;
			project.stopCapturing();
			const pasted = new Set(project.paste(diagram.id, clip, dx, dy));
			setNodes((current) => current.map((n) => ({ ...n, selected: pasted.has(n.id) })));
			setEdges((current) => current.map((e) => ({ ...e, selected: pasted.has(e.id) })));
		};
		/** Copies, and for a cut removes what was copied: a Zone goes with what it holds. */
		const copyOut = (cut: boolean): string | null => {
			const clip = copied();
			if (!clip) return null;
			if (cut) {
				project.stopCapturing();
				project.deleteElements(
					diagram.id,
					clip.nodes.map((n) => n.id),
					clip.edges.map((e) => e.id)
				);
			}
			return JSON.stringify(clip);
		};
		// Safari fires no copy or paste event without a text selection or a field: when the
		// event has not come by the next task, the Clipboard API does the work instead.
		let pending: 'copy' | 'cut' | 'paste' | null = null;
		const fallback = (action: 'copy' | 'cut' | 'paste') => {
			pending = action;
			setTimeout(() => {
				if (pending !== action) return;
				pending = null;
				if (action === 'paste') {
					void navigator.clipboard
						?.readText()
						.then((text) => {
							const clip = readClip(text);
							if (clip) pasteClip(clip, true);
						})
						.catch(() => {});
				} else {
					const text = copyOut(action === 'cut');
					if (text) void navigator.clipboard?.writeText(text).catch(() => {});
				}
			});
		};
		const onKey = (e: KeyboardEvent) => {
			const shortcut = selectionShortcut(e, canvasActive.current);
			if (!shortcut) return;
			if (shortcut === 'copy' || shortcut === 'cut' || shortcut === 'paste') {
				// The browser's own event comes first where it fires (Chrome, Firefox).
				fallback(shortcut);
				return;
			}
			// Escape keeps its default: a menu or a dialog may want it too.
			if (shortcut !== 'none') e.preventDefault();
			if (shortcut === 'duplicate') {
				// Holding the keys makes one copy, not one per key repeat.
				if (e.repeat) return;
				const clip = copied();
				if (clip) pasteClip(clip, false);
				return;
			}
			setNodes((current) => withSelection(current, shortcut === 'all'));
			setEdges((current) => withSelection(current, shortcut === 'all'));
		};
		const onCopy = (e: ClipboardEvent) => {
			if (!isCanvasClipboard(e, canvasActive.current)) return;
			pending = null;
			const text = copyOut(e.type === 'cut');
			if (!text) return;
			e.preventDefault();
			e.clipboardData?.setData('text/plain', text);
		};
		const onPaste = (e: ClipboardEvent) => {
			if (!isCanvasClipboard(e, canvasActive.current)) return;
			pending = null;
			const clip = readClip(e.clipboardData?.getData('text/plain') ?? '');
			if (!clip) return;
			e.preventDefault();
			pasteClip(clip, true);
		};
		window.addEventListener('pointerdown', onPointer, true);
		window.addEventListener('keydown', onKey);
		document.addEventListener('copy', onCopy);
		document.addEventListener('cut', onCopy);
		document.addEventListener('paste', onPaste);
		return () => {
			window.removeEventListener('pointerdown', onPointer, true);
			window.removeEventListener('keydown', onKey);
			document.removeEventListener('copy', onCopy);
			document.removeEventListener('cut', onCopy);
			document.removeEventListener('paste', onPaste);
		};
	}, [getNodes, project, diagram.id, diagram.kind, screenToFlowPosition]);

	// A palette item dragged over the canvas: drawn where it will land, centred on the pointer, snapped.
	const [preview, setPreview] = useState<(Box & { label: string }) | null>(null);
	const previewAt = (event: DragEvent, item = draggedPaletteItem()) => {
		if (!item || !event.dataTransfer.types.includes(PALETTE_MIME)) return null;
		const { label, ...size } = kind.dropPreview(item);
		const at = screenToFlowPosition({ x: event.clientX, y: event.clientY });
		return { ...snapping.placeCentred(at, size, event.altKey), label };
	};
	const clearPreview = () => {
		setPreview(null);
		snapping.clearGuides();
	};
	const onDragOver = (event: DragEvent) => {
		event.preventDefault();
		const box = previewAt(event);
		setPreview((current) =>
			current && box && current.x === box.x && current.y === box.y ? current : box
		);
	};
	const onDragLeave = (event: DragEvent) => {
		// Leaving for a child of the canvas is still being over it; by the pointer, since
		// Safari gives no relatedTarget for drags.
		const bounds = flowRef.current?.getBoundingClientRect();
		const inside =
			bounds &&
			event.clientX > bounds.left &&
			event.clientX < bounds.right &&
			event.clientY > bounds.top &&
			event.clientY < bounds.bottom;
		if (!inside) clearPreview();
	};
	const onDrop = (event: DragEvent) => {
		const item = event.dataTransfer.getData(PALETTE_MIME);
		if (!item) return;
		event.preventDefault();
		// The item the drag carries: a drag from another window has no palette item here.
		const box = previewAt(event, item);
		clearPreview();
		endPaletteDrag();
		if (!box) return;
		project.stopCapturing();
		framed.current = true;
		const id = kind.drop(project, diagram.id, item, box.x, box.y);
		if (id) dropped.current = { id, centre: centreOf(box), free: event.altKey };
	};
	// The preview has the model's estimated size: once the canvas has measured the new
	// element, it is centred where the preview was (snapped again at its real size),
	// in the same undo step.
	const dropped = useRef<{ id: string; centre: Point; free: boolean } | null>(null);
	const { placeCentred, clearGuides } = snapping;
	useEffect(() => {
		const pending = dropped.current;
		const node = pending && nodes.find((n) => n.id === pending.id);
		const size = node?.measured;
		if (!pending || !node || !size?.width || !size.height) return;
		dropped.current = null;
		const box = placeCentred(pending.centre, size as Size, pending.free, pending.id);
		clearGuides();
		if (box.x !== node.position.x || box.y !== node.position.y) {
			project.moveNode(diagram.id, pending.id, box.x, box.y);
		}
	}, [nodes, placeCentred, clearGuides, project, diagram.id]);
	useEffect(() => {
		if (framed.current || nodes.length === 0) return;
		framed.current = true;
		if (!dropped.current) setFitPending(true);
	}, [nodes]);

	return (
		<div className="workspace">
			<kind.Palette />
			<div className="flow-column">
				<div
					ref={flowRef}
					className="flow"
					onDrop={onDrop}
					onDragOver={onDragOver}
					onDragLeave={onDragLeave}
					onPointerMove={(e) => {
						const { x, y } = screenToFlowPosition({ x: e.clientX, y: e.clientY });
						pointerAt.current = { x: e.clientX, y: e.clientY };
						cursor.move(x, y);
					}}
					onPointerLeave={() => {
						pointerAt.current = null;
						cursor.leave();
					}}
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
						// Dragging a box-selected group by its selection rectangle: the same gestures.
						onSelectionDragStart={(_event, dragged) => onNodeDragStart(dragged)}
						onSelectionDrag={(_event, dragged) => onNodeDrag(dragged)}
						onSelectionDragStop={(_event, dragged) => onNodeDragStop(dragged)}
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
						// Selection as in design tools: dragging on the background draws a selection
						// rectangle, Shift+click (or Cmd+click, Ctrl+click off a Mac) adds to it, Delete
						// or Backspace removes it. The view pans with two fingers, the middle or right
						// button, or Space+drag (React Flow's pan key).
						// On a touch screen one finger still pans: there is no Space key to hold.
						selectionOnDrag={!coarsePointer}
						panOnDrag={coarsePointer ? true : [1, 2]}
						multiSelectionKeyCode={MULTI_SELECTION_KEYS}
						deleteKeyCode={['Backspace', 'Delete']}
						// Trackpad gestures, as in Figma: two fingers pan, a pinch zooms (it arrives as a
						// ctrl+wheel), and a mouse wheel zooms with Cmd (Ctrl elsewhere) held, React Flow's
						// default zoom key.
						panOnScroll
						panOnScrollMode={PanOnScrollMode.Free}
						zoomOnPinch
						fitView={frameOnOpen}
						fitViewOptions={{ maxZoom: 1 }}
						proOptions={{ hideAttribution: true }}
					>
						<Background gap={16} />
						<ViewportPortal>
							{preview && (
								<div
									className="drop-preview"
									style={{
										transform: `translate(${preview.x}px, ${preview.y}px)`,
										width: preview.width,
										height: preview.height
									}}
								>
									{preview.label}
								</div>
							)}
							{snapping.guides.length > 0 && (
								<svg className="snap-guides" width="1" height="1" aria-hidden="true">
									{snapping.guides.map((g, i) => (
										<line
											key={i}
											x1={g.axis === 'x' ? g.at : g.from}
											x2={g.axis === 'x' ? g.at : g.to}
											y1={g.axis === 'x' ? g.from : g.at}
											y2={g.axis === 'x' ? g.to : g.at}
										/>
									))}
								</svg>
							)}
						</ViewportPortal>
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
				{/* A Note is the same in every kind of Diagram. */}
				{selection.node?.type === 'note' ? (
					<NotePanel key={selection.node.id} note={selection.node as NoteNode} />
				) : (
					<kind.Panel selection={selection} />
				)}
			</aside>
		</div>
	);
}

// On a Mac, Ctrl+click is a right click: it opens the context menu.
const MULTI_SELECTION_KEYS =
	typeof navigator !== 'undefined' && /Mac|iP(hone|ad)/.test(navigator.userAgent)
		? ['Shift', 'Meta']
		: ['Shift', 'Control'];
const coarsePointer = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;

const pairKey = (e: DiagramEdge) => `${e.source}|${e.target}`;
const centreOf = (b: Box): Point => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });

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
