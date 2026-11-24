import type { Box, Point, Side } from './geometry.ts';

/** An end of a line: a point on a box's border, and the side it leaves by. */
export type End = { at: Point; side: Side; box: Box };

const OUT: Record<Side, Point> = {
	top: { x: 0, y: -1 },
	right: { x: 1, y: 0 },
	bottom: { x: 0, y: 1 },
	left: { x: -1, y: 0 }
};

/**
 * How far a line goes straight out of a box before it turns, and how far it keeps
 * from both: less and less when they are close, then not at all.
 */
const ROOM = [
	{ stub: 20, clear: 12 },
	{ stub: 10, clear: 6 },
	{ stub: 4, clear: 2 },
	{ stub: 20, clear: -Infinity }
];
/** What a turn costs, in pixels of line; a little less halfway between the ends. */
const TURN = 40;
const HALFWAY = 1;

/**
 * A line at right angles between two ends, straight out of each, around both
 * boxes: the shortest with few turns, turning halfway when it can.
 */
export function orthogonalRoute(start: End, end: End): Point[] {
	const key = JSON.stringify([start, end]);
	const known = routes.get(key);
	if (known) return known;
	const route = findRoute(start, end);
	if (routes.size >= KEPT) routes.clear();
	routes.set(key, route);
	return route;
}

// A drag draws every line at every step, and most of them have not changed.
const routes = new Map<string, Point[]>();
const KEPT = 2000;

function findRoute(start: End, end: End): Point[] {
	for (const { stub, clear } of ROOM) {
		const route = search(start, end, stub, clear);
		if (route) return route;
	}
	return [start.at, end.at];
}

const unique = (values: number[]) => [...new Set(values)].sort((a, b) => a - b);

function search(start: End, end: End, stub: number, clear: number): Point[] | null {
	const out = ({ at, side }: End): Point => ({
		x: at.x + OUT[side].x * stub,
		y: at.y + OUT[side].y * stub
	});
	const from = out(start);
	const to = out(end);
	const boxes = [start.box, end.box];
	// Where lines may run: through the ends, halfway, and around the boxes.
	const halfX = (from.x + to.x) / 2;
	const halfY = (from.y + to.y) / 2;
	const xs = unique([
		from.x,
		to.x,
		halfX,
		...boxes.flatMap((b) => [b.x - stub, b.x + b.width + stub])
	]);
	const ys = unique([
		from.y,
		to.y,
		halfY,
		...boxes.flatMap((b) => [b.y - stub, b.y + b.height + stub])
	]);
	const isBlocked = (a: Point, b: Point) =>
		boxes.some(
			(box) =>
				Math.max(a.x, b.x) > box.x - clear &&
				Math.min(a.x, b.x) < box.x + box.width + clear &&
				Math.max(a.y, b.y) > box.y - clear &&
				Math.min(a.y, b.y) < box.y + box.height + clear
		);
	// Out of each end to where it may turn: only its own box is in the way there.
	if (clear > -Infinity) {
		const inside = (p: Point, box: Box) =>
			p.x > box.x && p.x < box.x + box.width && p.y > box.y && p.y < box.y + box.height;
		if (inside(from, end.box) || inside(to, start.box)) return null;
	}

	// The cheapest way to each crossing, arriving along a row or a column.
	const axisOf = (side: Side) => (side === 'left' || side === 'right' ? 0 : 1);
	const index = (x: number, y: number, axis: number) => (y * xs.length + x) * 2 + axis;
	const total = xs.length * ys.length * 2;
	const cost = new Array<number>(total).fill(Infinity);
	const via = new Array<number>(total).fill(-1);
	const done = new Array<boolean>(total).fill(false);
	const first = index(xs.indexOf(from.x), ys.indexOf(from.y), axisOf(start.side));
	const goal = [xs.indexOf(to.x), ys.indexOf(to.y)];
	cost[first] = 0;
	const turnAt = (x: number, y: number, axis: number) =>
		// Leaving a row for a column turns on that column, and the other way round.
		TURN - ((axis === 0 ? xs[x] === halfX : ys[y] === halfY) ? HALFWAY : 0);
	for (;;) {
		let at = -1;
		for (let i = 0; i < total; i++) {
			if (!done[i] && cost[i] < Infinity && (at === -1 || cost[i] < cost[at])) at = i;
		}
		if (at === -1) break;
		done[at] = true;
		const axis = at % 2;
		const cell = (at - axis) / 2;
		const x = cell % xs.length;
		const y = (cell - x) / xs.length;
		for (const [dx, dy] of [
			[1, 0],
			[-1, 0],
			[0, 1],
			[0, -1]
		]) {
			const [nx, ny] = [x + dx, y + dy];
			if (nx < 0 || ny < 0 || nx >= xs.length || ny >= ys.length) continue;
			const a = { x: xs[x], y: ys[y] };
			const b = { x: xs[nx], y: ys[ny] };
			if (isBlocked(a, b)) continue;
			const next = dx !== 0 ? 0 : 1;
			const spent =
				cost[at] +
				Math.abs(b.x - a.x) +
				Math.abs(b.y - a.y) +
				(next === axis ? 0 : turnAt(x, y, axis));
			const i = index(nx, ny, next);
			if (spent < cost[i]) [cost[i], via[i]] = [spent, at];
		}
	}
	// Arriving across the last stretch costs the turn into it.
	const last = axisOf(end.side);
	const straight = index(goal[0], goal[1], last);
	const turned = index(goal[0], goal[1], 1 - last);
	const best = cost[straight] <= cost[turned] + TURN ? straight : turned;
	if (cost[best] === Infinity) return null;
	const points: Point[] = [end.at];
	for (let at = best; at !== -1; at = via[at]) {
		const cell = (at - (at % 2)) / 2;
		const x = cell % xs.length;
		points.push({ x: xs[x], y: ys[(cell - x) / xs.length] });
	}
	points.push(start.at);
	return cornersOnly(points.reverse());
}

/** A line without the points it goes straight through. */
function cornersOnly(points: Point[]): Point[] {
	const distinct = points.filter(
		(p, i) => i === 0 || p.x !== points[i - 1].x || p.y !== points[i - 1].y
	);
	return distinct.filter((p, i) => {
		const before = distinct[i - 1];
		const after = distinct[i + 1];
		if (!before || !after) return true;
		return !((before.x === p.x && p.x === after.x) || (before.y === p.y && p.y === after.y));
	});
}
