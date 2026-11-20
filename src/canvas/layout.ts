import type { Edge, Node } from '@xyflow/react';
import type { DiagramEdge, DiagramNode } from '@simple-modelisation/model/project.ts';

/** Adjusts what a canvas draws (positions, edge data) without touching the document. */
export type Layout = (nodes: Node[], edges: Edge[]) => { nodes: Node[]; edges: Edge[] };

/** The layout of kinds that draw the document as it is. */
export const asStored: Layout = (nodes, edges) => ({ nodes, edges });

/** The canvas's nodes as the model stores them, where the canvas has them now. */
export const diagramNodes = (nodes: Node[]): DiagramNode[] =>
	nodes.map((n) => ({
		...(n.data as DiagramNode),
		id: n.id,
		type: n.type ?? '',
		x: n.position.x,
		y: n.position.y
	}));

/** The canvas's edges as the model stores them. */
export const diagramEdges = (edges: Edge[]): DiagramEdge[] =>
	edges.map((e) => ({
		...(e.data as DiagramEdge | undefined),
		id: e.id,
		type: e.type ?? '',
		source: e.source,
		target: e.target
	}));
