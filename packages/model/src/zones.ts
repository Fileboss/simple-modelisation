import type { DiagramNode } from './project.ts';

type Size = { width: number; height: number };
export type Box = { x: number; y: number } & Size;

/** A node's box: a Zone's stored size, another node's from `sizeOf`. */
export function nodeBox(node: DiagramNode, sizeOf: (node: DiagramNode) => Size): Box {
	if (node.type === 'zone') {
		return { x: node.x, y: node.y, width: node.width as number, height: node.height as number };
	}
	return { x: node.x, y: node.y, ...sizeOf(node) };
}

/** Whether two boxes overlap (touching edges do not count). */
export const overlaps = (a: Box, b: Box) =>
	a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** Whether `inner` lies wholly in `outer`. */
export const inside = (inner: Box, outer: Box) =>
	inner.x >= outer.x &&
	inner.y >= outer.y &&
	inner.x + inner.width <= outer.x + outer.width &&
	inner.y + inner.height <= outer.y + outer.height;

const area = (box: Box) => box.width * box.height;

/**
 * Where each node sits: the innermost Zone its box lies wholly in. Nodes
 * outside every Zone are left out. Two Zones with the same box nest by id, so
 * no Zone ever holds itself. Every caller passes the same sizes (the model's
 * estimate), so that the canvas, Tidy up and agents agree on what a Zone holds.
 */
export function zoneParents(
	nodes: DiagramNode[],
	sizeOf: (node: DiagramNode) => Size
): Map<string, string> {
	const zones = nodes
		.filter((n) => n.type === 'zone')
		.map((zone) => ({ id: zone.id, box: nodeBox(zone, sizeOf) }));
	const parents = new Map<string, string>();
	if (zones.length === 0) return parents;
	for (const node of nodes) {
		const box = nodeBox(node, sizeOf);
		let best: (typeof zones)[number] | undefined;
		for (const zone of zones) {
			if (zone.id === node.id || !inside(box, zone.box)) continue;
			// Same box: the Zone with the smaller id holds the other.
			if (node.type === 'zone' && area(zone.box) === area(box) && zone.id > node.id) continue;
			if (
				!best ||
				area(zone.box) < area(best.box) ||
				(area(zone.box) === area(best.box) && zone.id > best.id)
			)
				best = zone;
		}
		if (best) parents.set(node.id, best.id);
	}
	return parents;
}

/** Everything a Zone holds, directly or through the Zones inside it. */
export function zoneContent(parents: Map<string, string>, zoneId: string): string[] {
	const content: string[] = [];
	for (const [id] of parents) {
		for (let at = parents.get(id); at; at = parents.get(at)) {
			if (at === zoneId) {
				content.push(id);
				break;
			}
		}
	}
	return content;
}
