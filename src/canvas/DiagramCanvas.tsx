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
	type DragEvent
} from 'react';
import type { Diagram, DiagramEdge, DiagramNode, ProjectDocument } from '../document/project';
import { CanvasContext } from './canvas-context';

/** MIME type of what the palette drags onto the canvas. */
export const PALETTE_MIME = 'application/x-simple-modelisation';

export type Selection = { node?: DiagramNode; edge?: DiagramEdge };

/** Where an edge sits among the edges joining the same two nodes, for drawing them apart. */
export type TwinPosition = { twinIndex: number; twinCount: number };

/** What makes one Diagram kind: its nodes, edges, palette, properties panel and gestures. */
export type CanvasKind = {
	nodeTypes: NodeTypes;
	edgeTypes: EdgeTypes;
	Palette: ComponentType;
	Panel: ComponentType<{ selection: Selection }>;
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
				<Canvas {...props} />
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
			<div className="flow" onDrop={onDrop} onDragOver={(e) => e.preventDefault()}>
				<ReactFlow
					nodes={nodes}
					edges={edges}
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
					<Controls showInteractive={false} />
				</ReactFlow>
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
