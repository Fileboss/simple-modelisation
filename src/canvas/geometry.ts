import type { InternalNode } from '@xyflow/react';

type Point = { x: number; y: number };

export function center(node: InternalNode): Point {
	const { x, y } = node.internals.positionAbsolute;
	return { x: x + (node.measured.width ?? 0) / 2, y: y + (node.measured.height ?? 0) / 2 };
}

/** Where the line from a node's center toward `toward` leaves the node's box. */
export function borderPoint(node: InternalNode, toward: Point): Point {
	const c = center(node);
	const dx = toward.x - c.x;
	const dy = toward.y - c.y;
	if (dx === 0 && dy === 0) return c;
	const halfWidth = (node.measured.width ?? 0) / 2;
	const halfHeight = (node.measured.height ?? 0) / 2;
	const scale = Math.min(
		dx === 0 ? Infinity : halfWidth / Math.abs(dx),
		dy === 0 ? Infinity : halfHeight / Math.abs(dy)
	);
	return { x: c.x + dx * scale, y: c.y + dy * scale };
}
