import { Graph, layout } from '@dagrejs/dagre';
import type { Attribute, DiagramEdge, DiagramNode, Point } from './project.ts';

export type Size = { width: number; height: number };
export type Positions = Map<string, Point>;

/**
 * Where every node goes, and the bends of every edge dagre routed: only the
 * inner points, since the ends attach to the boxes as they are drawn.
 */
export type Layout = { positions: Positions; routes: Map<string, Point[]> };

/** A link dagre ranks along: the edge it routes, drawn the other way when reversed. */
type Link = { from: string; to: string; edge: string; reversed?: boolean };

const NODE_GAP = 70;
const LAYER_GAP = 140;
/** Elements without any link go on a grid under the rest, this many per row. */
const LOOSE_PER_ROW = 5;

const byId = <T extends { id: string }>(a: T, b: T) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * Arranges a Diagram in layers from left to right along its links: the
 * Connections of a System design diagram, the Legs of an MCD (each
 * Association ranked between its Entities). Elements without links go on a
 * grid underneath. Deterministic: every peer computes the same layout. The
 * positions are shared by every Notation, so an MCD is always laid out with
 * its Associations as boxes.
 */
export function layoutDiagram(
	allNodes: DiagramNode[],
	allEdges: DiagramEdge[],
	sizeOf: (node: DiagramNode) => Size
): Layout {
	// Input order steers dagre: sort by id so peers that received the document in a
	// different order still agree.
	const nodes = [...allNodes].sort(byId);
	const edges = [...allEdges].sort(byId);
	const links = linksOf(nodes, edges);
	const linked = new Set(links.flatMap((link) => [link.from, link.to]));

	const graph = new Graph({ multigraph: true });
	graph.setGraph({
		rankdir: 'LR',
		nodesep: NODE_GAP,
		ranksep: LAYER_GAP,
		marginx: 0,
		marginy: 0,
		acyclicer: 'greedy'
	});
	graph.setDefaultEdgeLabel(() => ({}));
	for (const node of nodes) if (linked.has(node.id)) graph.setNode(node.id, { ...sizeOf(node) });
	links.forEach((link, index) => graph.setEdge(link.from, link.to, {}, String(index)));
	layout(graph);

	const positions: Positions = new Map();
	let bottom = 0;
	for (const node of nodes) {
		if (!linked.has(node.id)) continue;
		const { x, y, width, height } = graph.node(node.id);
		positions.set(node.id, { x: Math.round(x - width / 2), y: Math.round(y - height / 2) });
		bottom = Math.max(bottom, y + height / 2);
	}

	const routes = new Map<string, Point[]>();
	links.forEach((link, index) => {
		const points: Point[] = graph.edge(link.from, link.to, String(index))?.points ?? [];
		const bends = points.slice(1, -1).map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) }));
		if (bends.length > 0) routes.set(link.edge, link.reversed ? bends.reverse() : bends);
	});

	const loose = nodes.filter((n) => !linked.has(n.id));
	let x = 0;
	let y = positions.size > 0 ? Math.round(bottom + LAYER_GAP) : 0;
	let rowHeight = 0;
	loose.forEach((node, index) => {
		if (index > 0 && index % LOOSE_PER_ROW === 0) {
			x = 0;
			y += rowHeight + NODE_GAP;
			rowHeight = 0;
		}
		const size = sizeOf(node);
		positions.set(node.id, { x, y });
		x += size.width + NODE_GAP;
		rowHeight = Math.max(rowHeight, size.height);
	});
	return { positions, routes };
}

/** The directed links dagre ranks along. */
function linksOf(nodes: DiagramNode[], edges: DiagramEdge[]): Link[] {
	const present = new Set(nodes.map((n) => n.id));
	const clients = new Set(
		nodes.filter((n) => n.type === 'component' && n.componentType === 'client').map((n) => n.id)
	);
	const links: Link[] = [];
	const firstLeg = new Set<string>();
	for (const edge of edges) {
		if (!present.has(edge.source) || !present.has(edge.target)) continue;
		if (edge.type === 'leg') {
			// Legs are sorted by id: the first leads into its Association, the others out of it,
			// so the Association ranks between its Entities.
			const first = !firstLeg.has(edge.source);
			firstLeg.add(edge.source);
			links.push(
				first
					? { from: edge.target, to: edge.source, edge: edge.id, reversed: true }
					: { from: edge.source, to: edge.target, edge: edge.id }
			);
			continue;
		}
		// Clients are where flows start: a Connection back to one (a push) ranks the other way.
		const back = clients.has(edge.target) && !clients.has(edge.source);
		links.push(
			back
				? { from: edge.target, to: edge.source, edge: edge.id, reversed: true }
				: { from: edge.source, to: edge.target, edge: edge.id }
		);
	}
	return links;
}

/**
 * A node's drawn size guessed from its content, wide enough for both
 * Notations (a UML line also shows the type), where the canvas cannot measure
 * it (the server) or measures another Notation than the shared positions need.
 */
export function estimatedSize(node: DiagramNode): Size {
	const name = String(node.name ?? '');
	const attributes = (node.attributes as Attribute[] | undefined) ?? [];
	const longest = Math.max(name.length, ...attributes.map((a) => a.name.length + 24));
	if (node.type === 'component') {
		// The Skin's product name shows under the name.
		return { width: Math.max(170, name.length * 8 + 90 + (node.skin ? 20 : 0)), height: 64 };
	}
	if (node.type === 'association') {
		return { width: Math.max(100, longest * 8 + 40), height: 48 + attributes.length * 18 };
	}
	return { width: Math.max(130, longest * 8 + 30), height: 40 + attributes.length * 20 };
}

type Box = Point & Size;

/** Whether any two boxes overlap (touching edges do not count). */
export function anyOverlap(boxes: Box[]): boolean {
	return boxes.some((a, i) =>
		boxes.some(
			(b, j) =>
				i < j &&
				a.x < b.x + b.width &&
				b.x < a.x + a.width &&
				a.y < b.y + b.height &&
				b.y < a.y + a.height
		)
	);
}
