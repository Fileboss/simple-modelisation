import { Position, type InternalNode } from '@xyflow/react';

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

/** An SVG path through `points` with rounded corners, as a routed Connection or Leg is drawn. */
export function routedPath(points: Point[], radius = 10): string {
	if (points.length < 3) return points.map((p, i) => `${i ? 'L' : 'M'} ${p.x},${p.y}`).join(' ');
	let path = `M ${points[0].x},${points[0].y}`;
	for (let i = 1; i < points.length - 1; i++) {
		const [before, corner, after] = [points[i - 1], points[i], points[i + 1]];
		const r = Math.min(radius, distance(before, corner) / 2, distance(corner, after) / 2);
		const enter = toward(corner, before, r);
		const leave = toward(corner, after, r);
		path += ` L ${enter.x},${enter.y} Q ${corner.x},${corner.y} ${leave.x},${leave.y}`;
	}
	const last = points[points.length - 1];
	return `${path} L ${last.x},${last.y}`;
}

/** The point at fraction `t` of the polyline's length (0 = start, 1 = end). */
export function pointAlong(points: Point[], t: number): Point {
	const lengths = points.slice(1).map((p, i) => distance(points[i], p));
	let left = lengths.reduce((a, b) => a + b, 0) * t;
	for (let i = 0; i < lengths.length; i++) {
		if (left <= lengths[i] || i === lengths.length - 1) {
			const k = lengths[i] ? Math.min(left / lengths[i], 1) : 0;
			return {
				x: points[i].x + (points[i + 1].x - points[i].x) * k,
				y: points[i].y + (points[i + 1].y - points[i].y) * k
			};
		}
		left -= lengths[i];
	}
	return points[0];
}

const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);

function toward(from: Point, to: Point, length: number): Point {
	const d = distance(from, to) || 1;
	return { x: from.x + ((to.x - from.x) / d) * length, y: from.y + ((to.y - from.y) / d) * length };
}

/** The sides two boxes face each other by: left/right when they sit side by side, else top/bottom. */
export function facingSides(source: InternalNode, target: InternalNode) {
	const a = center(source);
	const b = center(target);
	const sideways = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y);
	const side = (node: InternalNode, position: Position): Point => {
		const { x, y } = node.internals.positionAbsolute;
		const width = node.measured.width ?? 0;
		const height = node.measured.height ?? 0;
		if (position === Position.Left) return { x, y: y + height / 2 };
		if (position === Position.Right) return { x: x + width, y: y + height / 2 };
		if (position === Position.Top) return { x: x + width / 2, y };
		return { x: x + width / 2, y: y + height };
	};
	const sourcePosition = sideways
		? b.x >= a.x
			? Position.Right
			: Position.Left
		: b.y >= a.y
			? Position.Bottom
			: Position.Top;
	const targetPosition = {
		[Position.Right]: Position.Left,
		[Position.Left]: Position.Right,
		[Position.Bottom]: Position.Top,
		[Position.Top]: Position.Bottom
	}[sourcePosition];
	return {
		start: side(source, sourcePosition),
		end: side(target, targetPosition),
		sourcePosition,
		targetPosition
	};
}
