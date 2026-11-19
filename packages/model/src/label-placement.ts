import { connectionRoute, distance, labelPoint, type Box, type Point } from './geometry.ts';

export type LabelledConnection = {
	id: string;
	source: string;
	target: string;
	label: string;
	/** Stored bends, when a Tidy up routed it. */
	points?: Point[];
};

/** Measures a label's text in pixels as the canvas draws it. */
export type MeasureText = (text: string) => number;

/** Between a Connection's Flow and its label in their pill: "Read · REST". */
export const FLOW_SEPARATOR = ' · ';

/** A Connection pill's whole text, its Flow's name first: what placing and measuring it go by. */
export const pillText = (label: string, flowName?: string): string =>
	[flowName, label].filter(Boolean).join(FLOW_SEPARATOR);

// A rough estimate where text cannot be measured (the server, tests): 6.5px per character.
export const roughWidth: MeasureText = (text) => text.length * 6.5;

/** The label pill as styled (.edge-label): text, 6px padding and a 1px border on each side. */
export function labelBox(text: string, at: Point, measure: MeasureText = roughWidth): Box {
	const width = measure(text) + 14;
	const height = 18;
	return { x: at.x - width / 2, y: at.y - height / 2, width, height };
}

const MARGIN = 4;
/**
 * The strip a Component's badges may take over its top-right corner: up to
 * three 18px badges with their ring, centred on the top border, the last one
 * sticking out on the right.
 */
const badgeStrip = (b: Box): Box => ({
	x: b.x + b.width - 3 * 24 + 9,
	y: b.y - 11,
	width: 3 * 24 + 2,
	height: 22
});
/** The arrowhead at a route's end (8px long, as drawn), which a label must not cover. */
function arrowhead(route: Point[]): Box {
	const end = route[route.length - 1];
	const before = route[route.length - 2] ?? end;
	const horizontal = Math.abs(end.x - before.x) >= Math.abs(end.y - before.y);
	const size = 10;
	return horizontal
		? { x: end.x - (end.x > before.x ? size : 0), y: end.y - size / 2, width: size, height: size }
		: { x: end.x - size / 2, y: end.y - (end.y > before.y ? size : 0), width: size, height: size };
}
const overlap = (a: Box, b: Box) =>
	Math.max(0, Math.min(a.x + a.width, b.x + b.width) + MARGIN - Math.max(a.x, b.x)) *
	Math.max(0, Math.min(a.y + a.height, b.y + b.height) + MARGIN - Math.max(a.y, b.y));

/**
 * A route without the bends that do not bend: ELK may leave a point in the
 * middle of a straight line, which would cut it into segments too short for a label.
 */
function straightened(route: Point[]): Point[] {
	return route.filter((p, i) => {
		const before = route[i - 1];
		const after = route[i + 1];
		if (!before || !after) return true;
		const cross = (p.x - before.x) * (after.y - p.y) - (p.y - before.y) * (after.x - p.x);
		return Math.abs(cross) > 1e-6;
	});
}

/** Where a label may go along a route: the longest segment's middle, other middles, then 30 % and 70 %. */
function candidates(drawn: Point[]): Point[] {
	const route = straightened(drawn);
	const segments = route.slice(1).map((end, i) => ({ start: route[i], end }));
	const at = (t: number) => (s: (typeof segments)[number]) => ({
		x: s.start.x + (s.end.x - s.start.x) * t,
		y: s.start.y + (s.end.y - s.start.y) * t
	});
	const byLength = [...segments].sort(
		(a, b) => distance(b.start, b.end) - distance(a.start, a.end)
	);
	return [
		labelPoint(route),
		...byLength.slice(1).map(at(0.5)),
		...byLength.flatMap((s) => [at(0.3)(s), at(0.7)(s)])
	];
}

/**
 * Where to draw each Connection's label so that none overlaps another or a
 * box: the first free candidate along its own route, Connections taken by id
 * so the result is stable; when none is free, the candidate that overlaps
 * least, boxes weighing more than labels. Connections whose boxes are not
 * measured yet are left out.
 */
export function placeLabels(
	boxes: Map<string, Box>,
	connections: LabelledConnection[],
	measure: MeasureText = roughWidth
): Map<string, Point> {
	const placed: Box[] = [];
	const result = new Map<string, Point>();
	const ordered = [...connections].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
	const routes = new Map<string, Point[]>();
	for (const connection of ordered) {
		const source = boxes.get(connection.source);
		const target = boxes.get(connection.target);
		if (!source?.width || !target?.width) continue;
		routes.set(connection.id, connectionRoute(source, target, connection.points));
	}
	// Boxes, their badges and every arrowhead, unlabelled Connections' too.
	const obstacles = [
		...boxes.values(),
		...[...boxes.values()].map(badgeStrip),
		...[...routes.values()].map(arrowhead)
	];
	for (const connection of ordered) {
		const route = routes.get(connection.id);
		if (!connection.label || !route) continue;
		const options = candidates(route);
		let best = options[0];
		let bestScore = Infinity;
		for (const at of options) {
			const box = labelBox(connection.label, at, measure);
			const score =
				obstacles.reduce((sum, b) => sum + overlap(box, b) * 10, 0) +
				placed.reduce((sum, other) => sum + overlap(box, other), 0);
			if (score < bestScore) [best, bestScore] = [at, score];
			if (score === 0) break;
		}
		placed.push(labelBox(connection.label, best, measure));
		result.set(connection.id, best);
	}
	return result;
}
