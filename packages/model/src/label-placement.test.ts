import { describe, expect, it } from 'vitest';
import type { Box } from './geometry.ts';
import { labelBox, placeLabels, type LabelledConnection } from './label-placement.ts';

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

	it('leaves out unlabelled Connections and unmeasured boxes', () => {
		const placed = placeLabels(new Map([...boxes, ['x', box(0, 0, 0, 0)]]), [
			{ id: '3', source: 'a', target: 'd', label: '' },
			{ id: '4', source: 'x', target: 'd', label: 'SQL' }
		]);
		expect(placed.size).toBe(0);
	});
});
