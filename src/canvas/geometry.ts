import { Position, type InternalNode } from '@xyflow/react';

export type Point = { x: number; y: number };

/** A box as drawn on the canvas: top-left corner and size. */
export type Box = { x: number; y: number; width: number; height: number };

/** The box React Flow draws a node in. */
export function boxOf(node: InternalNode): Box {
	const { x, y } = node.internals.positionAbsolute;
	return { x, y, width: node.measured.width ?? 0, height: node.measured.height ?? 0 };
}

export function center(box: Box): Point {
	return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Where the line from a box's center toward `toward` leaves the box. */
export function borderPoint(box: Box, toward: Point): Point {
	const c = center(box);
	const dx = toward.x - c.x;
	const dy = toward.y - c.y;
	if (dx === 0 && dy === 0) return c;
	const scale = Math.min(
		dx === 0 ? Infinity : box.width / 2 / Math.abs(dx),
		dy === 0 ? Infinity : box.height / 2 / Math.abs(dy)
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

export const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);

function toward(from: Point, to: Point, length: number): Point {
	const d = distance(from, to) || 1;
	return { x: from.x + ((to.x - from.x) / d) * length, y: from.y + ((to.y - from.y) / d) * length };
}

/** The sides two boxes face each other by: left/right when they sit side by side, else top/bottom. */
export function facingSides(source: Box, target: Box) {
	const a = center(source);
	const b = center(target);
	const sideways = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y);
	const side = (box: Box, position: Position): Point => {
		if (position === Position.Left) return { x: box.x, y: box.y + box.height / 2 };
		if (position === Position.Right) return { x: box.x + box.width, y: box.y + box.height / 2 };
		if (position === Position.Top) return { x: box.x + box.width / 2, y: box.y };
		return { x: box.x + box.width / 2, y: box.y + box.height };
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

/** The right-angle route drawn between two boxes without stored bends: a step halfway. */
export function defaultRoute(source: Box, target: Box): Point[] {
	const { start, end, sourcePosition } = facingSides(source, target);
	if (sourcePosition === Position.Left || sourcePosition === Position.Right) {
		const middle = (start.x + end.x) / 2;
		return [start, { x: middle, y: start.y }, { x: middle, y: end.y }, end];
	}
	const middle = (start.y + end.y) / 2;
	return [start, { x: start.x, y: middle }, { x: end.x, y: middle }, end];
}

/**
 * How a route leaves or enters a box toward its first or last bend, keeping
 * right angles: straight from the side the bend is level with; when the bend is
 * just off the drawn box (the layout reserved a larger one), from the nearest
 * point of that side with an elbow; otherwise where the line toward the bend
 * leaves the box. Returns the points from the box to just before the bend.
 */
export function attachRoute(box: Box, bend: Point): Point[] {
	const c = center(box);
	const clamp = (value: number, low: number, high: number) =>
		Math.min(Math.max(value, low + 4), high - 4);
	if (bend.x >= box.x + box.width || bend.x <= box.x) {
		const side = bend.x >= c.x ? box.x + box.width : box.x;
		if (bend.y >= box.y && bend.y <= box.y + box.height) return [{ x: side, y: bend.y }];
		const level = clamp(bend.y, box.y, box.y + box.height);
		return [
			{ x: side, y: level },
			{ x: bend.x, y: level }
		];
	}
	if (bend.y >= box.y + box.height || bend.y <= box.y) {
		const side = bend.y >= c.y ? box.y + box.height : box.y;
		return [{ x: bend.x, y: side }];
	}
	return [borderPoint(box, bend)];
}

/** A whole drawn route: from the source box, through the bends, into the target box. */
export function drawnRoute(source: Box, bends: Point[], target: Box): Point[] {
	return [
		...attachRoute(source, bends[0]),
		...bends,
		...attachRoute(target, bends.at(-1)!).reverse()
	];
}

/** A Connection's drawn route: through its stored bends, else a right-angle step. */
export function connectionRoute(source: Box, target: Box, bends?: Point[]): Point[] {
	return bends?.length ? drawnRoute(source, bends, target) : defaultRoute(source, target);
}

/** The middle of a route's longest segment: away from bends, where labels collide least. */
export function labelPoint(points: Point[]): Point {
	let best = 0;
	for (let i = 1; i < points.length - 1; i++) {
		if (distance(points[i], points[i + 1]) > distance(points[best], points[best + 1])) best = i;
	}
	return {
		x: (points[best].x + points[best + 1].x) / 2,
		y: (points[best].y + points[best + 1].y) / 2
	};
}
