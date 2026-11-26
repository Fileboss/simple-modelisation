import type { Point } from '@simple-modelisation/model/project.ts';

type Element = {
	id: string;
	selected?: boolean;
	measured?: unknown;
	position?: Point;
	dragging?: boolean;
	width?: number;
	height?: number;
};

/** The gestures in progress here, whose elements keep how they are drawn. */
export type Held = {
	/** Dragged, or carried by a dragged Zone: they keep their place. */
	moving?: ReadonlySet<string>;
	/** Resized: it keeps its place and size. */
	resizing?: string | null;
};

/**
 * Carries over what React Flow knows of the previous elements when the
 * document changes: the selection; a node's measured size, so drawing steps
 * that need sizes (label placement) do not lose them for a frame; and, for the
 * nodes of a gesture in progress here (`held`), how they are drawn, so a peer's
 * edit does not send them back to their stored box before the gesture saves it.
 */
export function carryOver<T extends Element>(previous: T[], next: T[], held: Held = {}): T[] {
	const before = new Map(previous.map((e) => [e.id, e]));
	return next.map((e) => {
		const old = before.get(e.id);
		if (!old) return e;
		const resized = held.resizing === e.id;
		const moved = (resized || held.moving?.has(e.id)) && old.position;
		if (!old.selected && !old.measured && !moved) return e;
		return {
			...e,
			...(old.selected && { selected: true }),
			...(old.measured ? { measured: old.measured } : {}),
			...(moved && { position: old.position }),
			...(moved && old.dragging && { dragging: true }),
			...(resized && old.width !== undefined && { width: old.width }),
			...(resized && old.height !== undefined && { height: old.height })
		};
	});
}
