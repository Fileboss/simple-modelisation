import { describe, expect, it } from 'vitest';
import { dropIndex, shiftOf, withinRow } from './tab-order';

// Widths differ, as names do; 4px between tabs.
const boxes = [
	{ id: 'a', left: 0, width: 100 },
	{ id: 'b', left: 104, width: 60 },
	{ id: 'c', left: 168, width: 200 }
];

describe('dropIndex', () => {
	it('takes a place once its leading edge passes the middle of the tab there', () => {
		expect(dropIndex(boxes, 'a', 0)).toBe(0);
		expect(dropIndex(boxes, 'a', 34)).toBe(0);
		expect(dropIndex(boxes, 'a', 35)).toBe(1);
		expect(dropIndex(boxes, 'a', 5000)).toBe(2);
		expect(dropIndex(boxes, 'c', -33)).toBe(2);
		expect(dropIndex(boxes, 'c', -35)).toBe(1);
		expect(dropIndex(boxes, 'c', -5000)).toBe(0);
		expect(dropIndex(boxes, 'b', -10)).toBe(1);
	});
	it('is none for a tab that is gone', () => expect(dropIndex(boxes, 'x', 0)).toBe(-1));
});

describe('withinRow', () => {
	it('keeps the tab between the ends', () => {
		expect(withinRow(boxes, 'b', 10)).toBe(10);
		expect(withinRow(boxes, 'b', -500)).toBe(-104);
		expect(withinRow(boxes, 'b', 500)).toBe(204);
		expect(withinRow(boxes, 'x', 5)).toBe(0);
	});
	it('still reaches both ends of the order', () => {
		expect(dropIndex(boxes, 'c', withinRow(boxes, 'c', -900))).toBe(0);
		expect(dropIndex(boxes, 'a', withinRow(boxes, 'a', 900))).toBe(2);
	});
});

describe('shiftOf', () => {
	const shifts = (id: string, index: number) => boxes.map((b) => shiftOf(boxes, id, index, b.id));
	it('closes the place left and opens the one aimed at', () => {
		expect(shifts('a', 0)).toEqual([0, 0, 0]);
		expect(shifts('a', 1)).toEqual([0, -104, 0]);
		expect(shifts('a', 2)).toEqual([0, -104, -104]);
		expect(shifts('c', 0)).toEqual([204, 204, 0]);
		expect(shifts('c', 1)).toEqual([0, 204, 0]);
		expect(shifts('b', 0)).toEqual([64, 0, 0]);
	});
	it('moves nothing for a tab alone or gone', () => {
		expect(shiftOf([boxes[0]], 'a', 0, 'a')).toBe(0);
		expect(shiftOf(boxes, 'x', 0, 'a')).toBe(0);
	});
});
