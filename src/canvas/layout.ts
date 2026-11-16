import type { Edge, Node } from '@xyflow/react';

/** Adjusts what a canvas draws (positions, edge data) without touching the document. */
export type Layout = (nodes: Node[], edges: Edge[]) => { nodes: Node[]; edges: Edge[] };

/** The layout of kinds that draw the document as it is. */
export const asStored: Layout = (nodes, edges) => ({ nodes, edges });
