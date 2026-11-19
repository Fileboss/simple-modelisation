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

// A rough estimate where text cannot be measured (the server, tests): 6.5px per character.
export const roughWidth: MeasureText = (text) => text.length * 6.5;

/** The label pill as styled (.edge-label): text, 6px padding and a 1px border on each side. */
export function labelBox(text: string, at: Point, measure: MeasureText = roughWidth): Box {
	const width = measure(text) + 14;
	const height = 18;
	return { x: at.x - width / 2, y: at.y - height / 2, width, height };
}

const MARGIN = 4;
const overlap = (a: Box, b: Box) =>
	Math.max(0, Math.min(a.x + a.width, b.x + b.width) + MARGIN - Math.max(a.x, b.x)) *
	Math.max(0, Math.min(a.y + a.height, b.y + b.height) + MARGIN - Math.max(a.y, b.y));

/** Where a label may go along a route: the longest segment's middle, other middles, then 30 % and 70 %. */
function candidates(route: Point[]): Point[] {
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
	const obstacles = [...boxes.values()];
	const ordered = [...connections].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
	for (const connection of ordered) {
		const source = boxes.get(connection.source);
		const target = boxes.get(connection.target);
		if (!connection.label || !source?.width || !target?.width) continue;
		const options = candidates(connectionRoute(source, target, connection.points));
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
