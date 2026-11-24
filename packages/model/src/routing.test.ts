import { describe, expect, it } from 'vitest';
import {
	ANCHORS,
	anchorPoint,
	anchorSide,
	isAnchor,
	nearestAnchor,
	type Anchor
} from './anchors.ts';
import { connectionRoute, defaultRoute, type Box, type Point } from './geometry.ts';

const A: Box = { x: 0, y: 0, width: 160, height: 64 };
const at = (x: number, y: number, width = 200, height = 64): Box => ({ x, y, width, height });

const OUT = { top: [0, -1], right: [1, 0], bottom: [0, 1], left: [-1, 0] };

/** How much of a segment lies strictly inside a box. */
const crosses = (a: Point, b: Point, box: Box) =>
	Math.max(a.x, b.x) > box.x &&
	Math.min(a.x, b.x) < box.x + box.width &&
	Math.max(a.y, b.y) > box.y &&
	Math.min(a.y, b.y) < box.y + box.height;

function check(route: Point[], source: Box, target: Box, from?: Anchor, to?: Anchor) {
	if (from) expect(route[0]).toEqual(anchorPoint(source, from));
	if (to) expect(route.at(-1)).toEqual(anchorPoint(target, to));
	route.slice(1).forEach((b, i) => {
		const a = route[i];
		expect(a.x === b.x || a.y === b.y).toBe(true);
		expect(a.x !== b.x || a.y !== b.y).toBe(true);
	});
	const direction = (a: Point, b: Point) => [Math.sign(b.x - a.x), Math.sign(b.y - a.y)];
	if (from) expect(direction(route[0], route[1])).toEqual(OUT[anchorSide(from)]);
	if (to) expect(direction(route.at(-1)!, route.at(-2)!)).toEqual(OUT[anchorSide(to)]);
}

describe('Anchors', () => {
	it('are three per side, on the border, in their order', () => {
		expect(ANCHORS).toHaveLength(12);
		const points = ANCHORS.map((a) => anchorPoint(A, a));
		expect(new Set(points.map((p) => `${p.x},${p.y}`)).size).toBe(12);
		expect(anchorPoint(A, 'top-left')).toEqual({ x: 40, y: 0 });
		expect(anchorPoint(A, 'right')).toEqual({ x: 160, y: 32 });
		expect(anchorPoint(A, 'right-bottom')).toEqual({ x: 160, y: 48 });
		expect(anchorPoint(A, 'bottom-right')).toEqual({ x: 120, y: 64 });
		expect(anchorPoint(A, 'left-top')).toEqual({ x: 0, y: 16 });
	});
	it('are found from a point', () => {
		for (const a of ANCHORS) expect(nearestAnchor(A, anchorPoint(A, a))).toBe(a);
		expect(nearestAnchor(A, { x: 500, y: 34 })).toBe('right');
		expect(nearestAnchor(A, { x: 30, y: -80 })).toBe('top-left');
	});
	it('are told from anything else', () => {
		for (const bad of ['', 'middle', 'top-', 'constructor', 3, null, undefined]) {
			expect(isAnchor(bad)).toBe(false);
		}
	});
});

describe('The line of a Connection with Anchors', () => {
	const places: [string, Box][] = [
		['right', at(400, 0)],
		['left', at(-500, 10)],
		['below', at(20, 300)],
		['above', at(-30, -300)],
		['below right', at(400, 250)],
		['above left', at(-420, -240)],
		['near', at(230, 20)],
		['near below', at(0, 130)],
		['level tops', at(400, 0, 160, 400)]
	];
	const ends: (Anchor | undefined)[] = [undefined, ...ANCHORS];

	it.each(places)('goes out, at right angles and around both boxes: %s', (_name, target) => {
		for (const from of ends) {
			for (const to of ends) {
				const route = connectionRoute(A, target, undefined, { source: from, target: to });
				if (!from && !to) {
					expect(route).toEqual(defaultRoute(A, target));
					continue;
				}
				check(route, A, target, from, to);
				expect(route.length).toBeLessThanOrEqual(8);
				route.slice(1).forEach((b, i) => {
					for (const box of [A, target]) expect(crosses(route[i], b, box)).toBe(false);
				});
			}
		}
	});

	it('is straight between facing Anchors at one level', () => {
		const route = connectionRoute(A, at(400, 0), undefined, { source: 'right', target: 'left' });
		expect(route).toEqual([
			{ x: 160, y: 32 },
			{ x: 400, y: 32 }
		]);
	});

	it('turns halfway, as one without Anchors, whichever way it goes', () => {
		const facing: [Box, Anchor, Anchor][] = [
			[at(400, 200), 'right', 'left'],
			[at(500, -170), 'right', 'left'],
			[at(-500, 130), 'left', 'right'],
			[at(-450, -150), 'left', 'right'],
			[at(100, 400), 'bottom', 'top'],
			[at(-150, 380), 'bottom', 'top'],
			[at(120, -400), 'top', 'bottom'],
			[at(-160, -420), 'top', 'bottom']
		];
		for (const [target, source, end] of facing) {
			expect(connectionRoute(A, target, undefined, { source, target: end })).toEqual(
				defaultRoute(A, target)
			);
		}
	});

	it('is the same from the other end', () => {
		for (const from of ANCHORS) {
			for (const to of ANCHORS) {
				const there = connectionRoute(A, at(400, 250), undefined, { source: from, target: to });
				const back = connectionRoute(at(400, 250), A, undefined, { source: to, target: from });
				const length = (r: Point[]) =>
					r.slice(1).reduce((s, p, i) => s + Math.abs(p.x - r[i].x) + Math.abs(p.y - r[i].y), 0);
				expect(length(back)).toBeCloseTo(length(there), 6);
				expect(back.length).toBe(there.length);
			}
		}
	});

	it('is drawn, at right angles, whatever the boxes: touching, overlapping, one in the other', () => {
		for (const target of [
			at(160, 0),
			at(80, 30),
			at(0, 0, 160, 64),
			at(20, 10, 60, 30),
			at(3, 66)
		]) {
			for (const from of ANCHORS) {
				for (const to of ANCHORS) {
					const route = connectionRoute(A, target, undefined, { source: from, target: to });
					expect(route.length).toBeGreaterThanOrEqual(1);
					expect(route[0]).toEqual(anchorPoint(A, from));
					expect(route.at(-1)).toEqual(anchorPoint(target, to));
					route
						.slice(1)
						.forEach((b, i) => expect(route[i].x === b.x || route[i].y === b.y).toBe(true));
					for (const p of route) expect(Number.isFinite(p.x + p.y)).toBe(true);
				}
			}
		}
	});

	it('does not use stored bends', () => {
		const bends = [{ x: 999, y: 999 }];
		const anchors = { source: 'top' as const };
		expect(connectionRoute(A, at(400, 0), bends, anchors)).toEqual(
			connectionRoute(A, at(400, 0), undefined, anchors)
		);
	});

	it('is worked out fast enough for a drag', () => {
		const started = performance.now();
		for (let i = 0; i < 500; i++) {
			connectionRoute(A, at(400 + i, 250), undefined, {
				source: ANCHORS[i % 12],
				target: ANCHORS[(i * 5) % 12]
			});
		}
		expect((performance.now() - started) / 500).toBeLessThan(2);
	});
});
