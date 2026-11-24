import { describe, expect, it } from 'vitest';
import { connectionRoute, nearestAlong, pointAlong, type Box } from './geometry.ts';
import {
	clearPosition,
	LABEL_LINES,
	LABEL_WIDTH,
	labelBox,
	pillLines,
	pillSize,
	pillText,
	placeLabels,
	roughWidth,
	type LabelledConnection
} from './label-placement.ts';

const box = (x: number, y: number, width = 100, height = 40): Box => ({ x, y, width, height });
const pill = (text: string, at: { x: number; y: number }) => labelBox(text, at);
const intersects = (a: Box, b: Box) =>
	a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

describe('placeLabels', () => {
	// Two Connections whose routes cross in the middle: A→D horizontal, B→C vertical.
	const boxes = new Map([
		['a', box(0, 200)],
		['d', box(500, 200)],
		['b', box(250, 0)],
		['c', box(250, 400)]
	]);
	const connections: LabelledConnection[] = [
		{ id: '1', source: 'a', target: 'd', label: 'query', points: [{ x: 300, y: 220 }] },
		{ id: '2', source: 'b', target: 'c', label: 'push tweet ids', points: [{ x: 300, y: 220 }] }
	];

	it('keeps the labels of crossing Connections apart', () => {
		const placed = placeLabels(boxes, connections);
		expect(
			intersects(pill('query', placed.get('1')!), pill('push tweet ids', placed.get('2')!))
		).toBe(false);
	});

	it('keeps labels off the boxes when there is room', () => {
		const placed = placeLabels(boxes, connections);
		for (const [id, at] of placed) {
			const text = connections.find((c) => c.id === id)!.label;
			for (const b of boxes.values()) expect(intersects(pill(text, at), b)).toBe(false);
		}
	});

	it('does not move existing labels when an unrelated Connection is added far away', () => {
		const before = placeLabels(boxes, connections);
		const far = new Map([...boxes, ['e', box(2000, 2000)], ['f', box(2400, 2000)]]);
		const after = placeLabels(far, [
			...connections,
			{ id: '0', source: 'e', target: 'f', label: 'gRPC' }
		]);
		expect(after.get('1')).toEqual(before.get('1'));
		expect(after.get('2')).toEqual(before.get('2'));
	});

	it("keeps a label off the badges over a box's top-right corner", () => {
		// A short horizontal Connection leaving A at mid-height: its label would sit on A's badges.
		const near = new Map([
			['a', box(0, 0, 100, 40)],
			['b', box(300, 0, 100, 40)]
		]);
		const at = placeLabels(near, [{ id: '1', source: 'a', target: 'b', label: 'Read · REST' }]).get(
			'1'
		)!;
		const badges = { x: 100 - 25, y: -11, width: 36, height: 18 };
		expect(intersects(pill('Read · REST', at), badges)).toBe(false);
	});

	it('keeps a label off the arrowhead, centred when the line has room', () => {
		// 194px between the boxes, as Tidy up leaves for "Read · REST, nightly".
		const apart = new Map([
			['a', box(0, 100, 100, 40)],
			['b', box(294, 100, 100, 40)]
		]);
		const text = 'Read · REST, nightly';
		const at = placeLabels(apart, [{ id: '1', source: 'a', target: 'b', label: text }]).get('1')!;
		expect(at.x).toBe(197);
		const arrow = { x: 284, y: 115, width: 10, height: 10 };
		expect(intersects(pill(text, at), arrow)).toBe(false);
	});

	it('reads a straight line as one segment, whatever bend ELK left in its middle', () => {
		const apart = new Map([
			['a', box(0, 16, 164, 64)],
			['b', box(358, 0, 150, 64)]
		]);
		const text = 'Read · REST, nightly';
		const at = placeLabels(apart, [
			{ id: '1', source: 'a', target: 'b', label: text, points: [{ x: 261, y: 32 }] }
		]).get('1')!;
		expect(at).toEqual({ x: 261, y: 32 });
	});

	it('leaves out unlabelled Connections and unmeasured boxes', () => {
		const placed = placeLabels(new Map([...boxes, ['x', box(0, 0, 0, 0)]]), [
			{ id: '3', source: 'a', target: 'd', label: '' },
			{ id: '4', source: 'x', target: 'd', label: 'SQL' }
		]);
		expect(placed.size).toBe(0);
	});
});

describe('pillLines', () => {
	const fits = (lines: string[]) => lines.every((line) => roughWidth(line) <= LABEL_WIDTH);

	it('keeps on one line what fits, its spaces single', () => {
		expect(pillLines('REST  over\n\tHTTP ')).toEqual(['REST over HTTP']);
		expect(pillText(' \n ', 'Read')).toBe('Read');
		expect(pillText('GET\n/users')).toBe('GET /users');
		expect(pillLines('x'.repeat(24))).toHaveLength(1);
	});

	it('wraps between words, losing none', () => {
		const text = 'publishes the order events that billing and shipping consume';
		const lines = pillLines(text);
		expect(lines.length).toBeGreaterThan(1);
		expect(fits(lines)).toBe(true);
		expect(lines.join(' ')).toBe(text);
	});

	it('cuts a word longer than a line', () => {
		const lines = pillLines(`see ${'x'.repeat(60)} end`);
		expect(fits(lines)).toBe(true);
		expect(lines.join('').replaceAll(' ', '')).toBe(`see${'x'.repeat(60)}end`);
	});

	it('keeps a Flow with its separator', () => {
		for (let n = 1; n < 40; n++) {
			const [first] = pillLines(
				pillText(`${'w'.repeat(n)} and then some more words`, 'Read/Write')
			);
			expect(first.startsWith('Read/Write ·')).toBe(true);
			expect(first).not.toContain('\u00a0');
		}
	});

	it('stops at its last line with an ellipsis, however long the text', () => {
		for (const text of ['word '.repeat(5000), 'x'.repeat(100_000), '🚀'.repeat(5000)]) {
			const started = Date.now();
			const lines = pillLines(text);
			expect(Date.now() - started).toBeLessThan(500);
			expect(lines).toHaveLength(LABEL_LINES);
			expect(lines.at(-1)).toMatch(/…$/);
			expect(fits(lines)).toBe(true);
			expect(lines.join('')).not.toMatch(/[\ud800-\udbff](?![\udc00-\udfff])/);
		}
	});

	it('has a size whatever the text', () => {
		for (const text of ['', ' '.repeat(500), '\n'.repeat(60), '·', ' · · ·']) {
			const { width, height } = pillSize(text);
			expect(Number.isFinite(width) && width >= 14 && height >= 18).toBe(true);
		}
	});

	it('sizes the pill on its lines', () => {
		expect(pillSize('GET')).toEqual({ lines: ['GET'], width: 3 * 6.5 + 14, height: 18 });
		const { lines, height } = pillSize('a fairly long label that takes two lines');
		expect(lines).toHaveLength(2);
		expect(height).toBe(33);
	});
});

describe('A label put along its line', () => {
	const ends = new Map([
		['a', box(0, 0)],
		['b', box(400, 200)]
	]);
	const route = connectionRoute(ends.get('a')!, ends.get('b')!);
	const at = (labelPosition?: number) =>
		placeLabels(ends, [{ id: '1', source: 'a', target: 'b', label: 'GET', labelPosition }]).get(
			'1'
		)!;

	it('is there, clear of its two Components and of the arrow', () => {
		for (const t of [0, 0.03, 0.97, 1]) {
			const drawn = pill('GET', at(t));
			for (const b of ends.values()) expect(intersects(drawn, b)).toBe(false);
			expect(nearestAlong(route, at(t))).toBeCloseTo(t, 0);
		}
		for (const t of [0.2, 0.37, 0.5, 0.8]) {
			expect(at(t)).toEqual(pointAlong(route, t));
			expect(nearestAlong(route, at(t))).toBeCloseTo(t, 6);
		}
	});

	it('moves smoothly along an end, and stays there once stored', () => {
		const far = [
			{ x: 0, y: 0 },
			{ x: 2000, y: 0 }
		];
		const blocked = [box(1990, -20)];
		const size = pillSize('GET');
		const places = Array.from({ length: 60 }, (_, i) =>
			clearPosition(far, 0.975 + i * 0.0004, size, blocked)
		);
		for (let i = 1; i < places.length; i++) {
			expect(Math.abs(places[i] - places[i - 1]) * 2000).toBeLessThan(1.5);
		}
		const stored = Math.round(places.at(-1)! * 1000) / 1000;
		expect(
			Math.abs(clearPosition(far, stored, size, blocked) - places.at(-1)!) * 2000
		).toBeLessThan(2.5);
	});

	it('is where it was put on a line too short to clear its ends', () => {
		const close = new Map([
			['a', box(0, 0)],
			['b', box(110, 0)]
		]);
		const short = connectionRoute(close.get('a')!, close.get('b')!);
		const placed = placeLabels(close, [
			{ id: '1', source: 'a', target: 'b', label: 'a long label', labelPosition: 0.3 }
		]).get('1')!;
		expect(placed).toEqual(pointAlong(short, 0.3));
	});

	it('follows the line when a box moves', () => {
		const moved = new Map([...ends, ['b', box(900, -300)]] as [string, Box][]);
		const placed = placeLabels(moved, [
			{ id: '1', source: 'a', target: 'b', label: 'GET', labelPosition: 0.25 }
		]).get('1')!;
		expect(placed).toEqual(pointAlong(connectionRoute(moved.get('a')!, moved.get('b')!), 0.25));
	});

	it('is avoided by automatic ones, even those taken before it', () => {
		const automatic = { id: '0', source: 'a', target: 'b', label: 'automatic' };
		const alone = placeLabels(ends, [automatic]).get('0')!;
		const t = nearestAlong(route, alone);
		const placed = placeLabels(ends, [
			automatic,
			{ id: '1', source: 'a', target: 'b', label: 'put there', labelPosition: t }
		]);
		expect(
			intersects(pill('automatic', placed.get('0')!), pill('put there', placed.get('1')!))
		).toBe(false);
	});

	it('finds the nearest point of a line, off it and on a point alone', () => {
		const line = [
			{ x: 0, y: 0 },
			{ x: 100, y: 0 },
			{ x: 100, y: 100 }
		];
		expect(nearestAlong(line, { x: 50, y: -30 })).toBe(0.25);
		expect(nearestAlong(line, { x: 500, y: 50 })).toBe(0.75);
		expect(nearestAlong(line, { x: -50, y: -50 })).toBe(0);
		expect(nearestAlong([line[0], line[0]], { x: 9, y: 9 })).toBe(0);
		expect(pointAlong([line[0], line[0]], 0.5)).toEqual(line[0]);
		expect(pointAlong(line, 7)).toEqual(line[2]);
	});
});
