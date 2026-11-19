import type { Box } from './geometry';

/** A box another one may snap to; `linked` when a Connection or a Leg joins it to what moves. */
export type SnapTarget = { id: string; box: Box; linked?: boolean };

/**
 * A guide line drawn while snapping: vertical at x = `at` (axis x) or
 * horizontal at y = `at` (axis y), from `from` to `to` along the other axis.
 */
export type Guide = { axis: 'x' | 'y'; at: number; from: number; to: number };

export type Snap = { dx: number; dy: number; guides: Guide[] };

type Axis = 'x' | 'y';

/** A box's start, centre and end along an axis; the centre is index 1. */
const edges = (box: Box, axis: Axis): number[] => {
	const start = axis === 'x' ? box.x : box.y;
	const size = axis === 'x' ? box.width : box.height;
	return [start, start + size / 2, start + size];
};

/** The other axis' extent of a box, for a guide to span. */
const span = (box: Box, axis: Axis): [number, number] =>
	axis === 'x' ? [box.y, box.y + box.height] : [box.x, box.x + box.width];

/**
 * The offset along one axis that brings an edge (start, centre or end) of the
 * moving box onto the nearest edge of a target, within `threshold`: a linked
 * target's centre against the moving centre first, so that the line joining
 * them comes out straight; null when nothing is near.
 */
function offsetAlong(moving: Box, targets: SnapTarget[], axis: Axis, threshold: number) {
	const own = edges(moving, axis);
	let best: { offset: number; linked: boolean } | null = null;
	for (const target of targets) {
		const theirs = edges(target.box, axis);
		for (let i = 0; i < 3; i++) {
			for (let j = 0; j < 3; j++) {
				const offset = theirs[j] - own[i];
				if (Math.abs(offset) > threshold) continue;
				const linked = Boolean(target.linked) && i === 1 && j === 1;
				const better =
					!best ||
					(linked && !best.linked) ||
					(linked === best.linked && Math.abs(offset) < Math.abs(best.offset));
				if (better) best = { offset, linked };
			}
		}
	}
	return best?.offset ?? null;
}

/** The guides along an axis once snapped: one per coordinate the moved box shares with targets. */
function guidesAlong(moved: Box, targets: SnapTarget[], axis: Axis): Guide[] {
	const guides: Guide[] = [];
	for (const at of edges(moved, axis)) {
		const aligned = targets.filter((t) =>
			edges(t.box, axis).some((edge) => Math.abs(edge - at) < 0.5)
		);
		if (aligned.length === 0) continue;
		const extents = [moved, ...aligned.map((t) => t.box)].map((b) => span(b, axis));
		guides.push({
			axis,
			at,
			from: Math.min(...extents.map(([from]) => from)),
			to: Math.max(...extents.map(([, to]) => to))
		});
	}
	return guides;
}

/**
 * Where a moving box snaps: on each axis on its own, the nearest edge pair
 * within `threshold` (in flow units: screen pixels divided by the zoom), and
 * the guides to draw for what it then lines up with.
 */
export function snap(moving: Box, targets: SnapTarget[], threshold: number): Snap {
	const ox = offsetAlong(moving, targets, 'x', threshold);
	const oy = offsetAlong(moving, targets, 'y', threshold);
	const moved = { ...moving, x: moving.x + (ox ?? 0), y: moving.y + (oy ?? 0) };
	return {
		dx: ox ?? 0,
		dy: oy ?? 0,
		// Only an axis that snapped draws guides: a near miss on it would be a lie.
		guides: [
			...(ox === null ? [] : guidesAlong(moved, targets, 'x')),
			...(oy === null ? [] : guidesAlong(moved, targets, 'y'))
		]
	};
}

/** The smallest box around several. */
export function boundsOf(boxes: Box[]): Box {
	const left = Math.min(...boxes.map((b) => b.x));
	const top = Math.min(...boxes.map((b) => b.y));
	const right = Math.max(...boxes.map((b) => b.x + b.width));
	const bottom = Math.max(...boxes.map((b) => b.y + b.height));
	return { x: left, y: top, width: right - left, height: bottom - top };
}

/**
 * Where a box being resized snaps: only the sides that moved since `start`,
 * each to the nearest edge of a target within `threshold`, the opposite sides
 * staying put; with the guides for what the snapped sides line up with.
 */
export function snapSides(
	resized: Box,
	start: Box,
	targets: SnapTarget[],
	threshold: number
): { box: Box; guides: Guide[] } {
	const box = { ...resized };
	const snapped: Axis[] = [];
	for (const axis of ['x', 'y'] as const) {
		const pos = axis === 'x' ? 'x' : 'y';
		const size = axis === 'x' ? 'width' : 'height';
		const nearest = (at: number) => {
			let best: number | null = null;
			for (const target of targets) {
				for (const edge of edges(target.box, axis)) {
					const offset = edge - at;
					if (
						Math.abs(offset) <= threshold &&
						(best === null || Math.abs(offset) < Math.abs(best))
					) {
						best = offset;
					}
				}
			}
			return best;
		};
		const end = box[pos] + box[size];
		if (box[pos] !== start[pos]) {
			const offset = nearest(box[pos]);
			if (offset !== null && box[size] - offset > 0) {
				box[pos] += offset;
				box[size] -= offset;
				snapped.push(axis);
			}
		} else if (end !== start[pos] + start[size]) {
			const offset = nearest(end);
			if (offset !== null && box[size] + offset > 0) {
				box[size] += offset;
				snapped.push(axis);
			}
		}
	}
	return { box, guides: snapped.flatMap((axis) => guidesAlong(box, targets, axis)) };
}
