import { describe, expect, it } from 'vitest';
import { carryOver } from './carry-over';

const node = (id: string, x: number, extra: object = {}) => ({
	id,
	position: { x, y: 0 },
	...extra
});

describe('carryOver', () => {
	it('keeps the selection and the measured size, and takes positions from the document', () => {
		const previous = [node('a', 10, { selected: true, measured: { width: 80, height: 40 } })];
		expect(carryOver(previous, [node('a', 50)])).toEqual([
			node('a', 50, { selected: true, measured: { width: 80, height: 40 } })
		]);
	});

	it('keeps a node being moved where it is drawn, until the drop', () => {
		const previous = [node('a', 120, { dragging: true }), node('b', 30), node('c', 70)];
		// A peer moved b and c meanwhile; a is dragged here, c carried by a dragged Zone.
		const next = [node('a', 10), node('b', 300), node('c', 400)];
		expect(carryOver(previous, next, { moving: new Set(['a', 'c']) })).toEqual([
			node('a', 120, { dragging: true }),
			node('b', 300),
			node('c', 70)
		]);
	});

	it('leaves out what the document no longer holds, and takes what is new', () => {
		const previous = [node('a', 10, { dragging: true })];
		expect(carryOver(previous, [node('b', 5)], { moving: new Set(['a']) })).toEqual([node('b', 5)]);
	});
});

describe('carryOver during a gesture', () => {
	it('keeps the selection and the measured size of a node being dragged', () => {
		const measured = { width: 80, height: 40 };
		const previous = [node('a', 120, { selected: true, measured, dragging: true })];
		expect(carryOver(previous, [node('a', 10)], { moving: new Set(['a']) })).toEqual([
			node('a', 120, { selected: true, measured, dragging: true })
		]);
	});

	it('marks carried content as not dragged', () => {
		const [carried] = carryOver([node('c', 70)], [node('c', 400)], { moving: new Set(['c']) });
		expect(carried).toEqual(node('c', 70));
		expect('dragging' in carried).toBe(false);
	});

	it('keeps the place and size of a node being resized', () => {
		const previous = [node('z', 40, { width: 500, height: 300 }), node('n', 0)];
		const next = [node('z', 0, { width: 200, height: 100 }), node('n', 90)];
		expect(carryOver(previous, next, { resizing: 'z' })).toEqual([
			node('z', 40, { width: 500, height: 300 }),
			node('n', 90)
		]);
	});
});
