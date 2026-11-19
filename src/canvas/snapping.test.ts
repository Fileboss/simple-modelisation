import { describe, expect, it } from 'vitest';
import { snap, snapSides, type SnapTarget } from './snapping';

const box = (x: number, y: number, width = 100, height = 40) => ({ x, y, width, height });
const target = (id: string, b: ReturnType<typeof box>, linked = false): SnapTarget => ({
	id,
	box: b,
	linked
});

describe('snap', () => {
	it('brings the nearest edges together within the threshold, on each axis', () => {
		// Left edges 4px apart, tops 300px apart: x snaps, y does not.
		expect(snap(box(104, 300), [target('a', box(100, 0))], 6)).toMatchObject({ dx: -4, dy: 0 });
		// Right to right, from a wider box.
		expect(snap(box(0, 300, 150), [target('a', box(53, 0))], 6).dx).toBe(3);
		// Centre to centre: 50 + 50 against 120 + 30.
		expect(snap(box(97, 300, 100), [target('a', box(120, 0, 60))], 6).dx).toBe(3);
	});

	it('leaves a box alone beyond the threshold', () => {
		expect(snap(box(110, 300), [target('a', box(100, 0))], 6)).toEqual({
			dx: 0,
			dy: 0,
			guides: []
		});
	});

	it('takes the closest pair', () => {
		const targets = [target('a', box(105, 0)), target('b', box(102, 100))];
		expect(snap(box(100, 300), targets, 6).dx).toBe(2);
	});

	it('lines a linked box up centre to centre first, so that the line between them is straight', () => {
		// The unlinked box is 1px off by its top; the linked one 5px off by its middle (115 against 120).
		const targets = [target('near', box(400, 101)), target('linked', box(400, 95), true)];
		expect(snap(box(0, 100), targets, 6).dy).toBe(-5);
	});

	it('draws a guide across what the snapped box lines up with, and none for an axis that did not snap', () => {
		const { guides } = snap(
			box(103, 300, 60),
			[target('a', box(100, 0)), target('b', box(100, 150))],
			6
		);
		expect(guides).toEqual([{ axis: 'x', at: 100, from: 0, to: 340 }]);
	});
});

describe('snapSides', () => {
	const start = box(0, 0, 200, 100);
	it('snaps the side that moved, the opposite one staying put', () => {
		// The right side dragged to 297, 3px short of a box's left edge at 300.
		const { box: snapped, guides } = snapSides(
			box(0, 0, 297, 100),
			start,
			[target('a', box(300, 400))],
			6
		);
		expect(snapped).toEqual(box(0, 0, 300, 100));
		expect(guides).toEqual([{ axis: 'x', at: 300, from: 0, to: 440 }]);
		// The left side dragged to 98, near a box's centre at 100.
		expect(snapSides(box(98, 0, 102, 100), start, [target('a', box(50, 400))], 6).box).toEqual(
			box(100, 0, 100, 100)
		);
	});

	it('leaves sides that did not move and far sides alone', () => {
		expect(snapSides(box(0, 0, 250, 100), start, [target('a', box(300, 400))], 6).box).toEqual(
			box(0, 0, 250, 100)
		);
		// The bottom did not move, though it is 2px from an edge.
		expect(snapSides(start, start, [target('a', box(500, 102))], 6).box).toEqual(start);
	});
});
