import {
	applyEdgeChanges,
	applyNodeChanges,
	Background,
	ConnectionMode,
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
import type { Diagram, DiagramEdge, DiagramNode, ProjectDocument } from '../document/project';
import {
	reportPresence,
	useCursorReporter,
	usePresence,
	useRemoteSelections
} from '../presence/presence-context';
import { RemoteCursors } from '../presence/RemoteCursors';
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
	const { screenToFlowPosition } = useReactFlow();

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

	const onNodesChange = useCallback(
		(changes: NodeChange[]) => setNodes((current) => applyNodeChanges(changes, current)),
		[]
	);
	const onEdgesChange = useCallback(
		(changes: EdgeChange[]) => setEdges((current) => applyEdgeChanges(changes, current)),
		[]
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
	const drawn = useMemo(() => layout(shownNodes, shownEdges), [layout, shownNodes, shownEdges]);

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
							project.doc.transact(() => {
								for (const n of dragged) {
									project.moveNode(diagram.id, n.id, n.position.x, n.position.y);
								}
							});
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
						<Controls showInteractive={false} />
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
