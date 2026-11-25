import type { Box, Point, Side } from './geometry.ts';

/** The points of a Component's border a Connection's end can be attached to: three per side. */
export const ANCHORS = [
	'top-left',
	'top',
	'top-right',
	'right-top',
	'right',
	'right-bottom',
	'bottom-left',
	'bottom',
	'bottom-right',
	'left-top',
	'left',
	'left-bottom'
] as const;
export type Anchor = (typeof ANCHORS)[number];

/** The Anchors of a Connection's ends; absent: automatic. */
export type Anchors = { source?: Anchor; target?: Anchor };

export const isAnchor = (value: unknown): value is Anchor =>
	(ANCHORS as readonly unknown[]).includes(value);

export const anchorSide = (anchor: Anchor): Side => anchor.split('-')[0] as Side;

/** Where an Anchor is on a box: a quarter, the middle or three quarters of its side. */
export function anchorPoint(box: Box, anchor: Anchor): Point {
	const [side, towards] = anchor.split('-') as [Side, string | undefined];
	const part = towards === undefined ? 0.5 : towards === 'left' || towards === 'top' ? 0.25 : 0.75;
	if (side === 'top' || side === 'bottom') {
		return { x: box.x + box.width * part, y: side === 'top' ? box.y : box.y + box.height };
	}
	return { x: side === 'left' ? box.x : box.x + box.width, y: box.y + box.height * part };
}

/** The Anchor of a box nearest a point. */
export function nearestAnchor(box: Box, at: Point): Anchor {
	const away = (anchor: Anchor) => {
		const p = anchorPoint(box, anchor);
		return Math.hypot(p.x - at.x, p.y - at.y);
	};
	return ANCHORS.reduce((best, anchor) => (away(anchor) < away(best) ? anchor : best));
}
