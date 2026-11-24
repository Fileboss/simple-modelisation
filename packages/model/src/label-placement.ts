import {
	connectionRoute,
	distance,
	labelPoint,
	pointAlong,
	type Box,
	type Point
} from './geometry.ts';

export type LabelledConnection = {
	id: string;
	source: string;
	target: string;
	label: string;
	/** Stored bends, when a Tidy up routed it. */
	points?: Point[];
	/** How far along its line it was put (0 to 1); absent: placed automatically. */
	labelPosition?: number;
};

/** Measures a label's text in pixels as the canvas draws it. */
export type MeasureText = (text: string) => number;

/** Between a Connection's Flow and its label in their pill: "Read · REST". */
export const FLOW_SEPARATOR = ' · ';

/** A Connection pill's whole text, its Flow's name first: what placing and measuring it go by. */
export const pillText = (label: string, flowName?: string): string =>
	[flowName, oneLine(label)].filter(Boolean).join(FLOW_SEPARATOR);

/** A label's text as HTML and SVG both show it: its spaces and line breaks single spaces. */
const oneLine = (text: string) => text.replace(/\s+/g, ' ').trim();

// A rough estimate where text cannot be measured (the server, tests): 6.5px per character.
export const roughWidth: MeasureText = (text) => text.length * 6.5;

/** The widest a pill's text goes on one line, and the most lines it takes. */
export const LABEL_WIDTH = 160;
export const LABEL_LINES = 8;
/** The height of each line of a pill that has several. */
export const LABEL_LINE_HEIGHT = 15;

/** A word in pieces no wider than a line. */
function pieces(word: string, measure: MeasureText): string[] {
	const parts: string[] = [];
	let part = '';
	for (const character of word) {
		if (part && measure(part + character) > LABEL_WIDTH) {
			parts.push(part);
			part = '';
		}
		part += character;
	}
	return [...parts, part];
}

/**
 * A pill's text as drawn: on one line while it fits, else wrapped between words,
 * a longer word cut, what passes the last line left out. A Flow's name keeps its
 * separator on its line.
 */
export function pillLines(text: string, measure: MeasureText = roughWidth): string[] {
	// Far more than the lines hold: no use measuring the rest.
	const shown = oneLine([...text.slice(0, 4000)].slice(0, 1000).join(''));
	if (measure(shown) <= LABEL_WIDTH) return [shown];
	const glued = shown.replace(FLOW_SEPARATOR, '\u00a0· ');
	const lines: string[] = [];
	let line = '';
	for (const word of glued.split(' ')) {
		const joined = line ? `${line} ${word}` : word;
		if (measure(joined) <= LABEL_WIDTH) {
			line = joined;
			continue;
		}
		if (line) lines.push(line);
		const parts = pieces(word, measure);
		lines.push(...parts.slice(0, -1));
		line = parts[parts.length - 1];
		if (lines.length > LABEL_LINES) break;
	}
	if (line) lines.push(line);
	const plain = lines.map((l) => l.replaceAll('\u00a0', ' '));
	if (plain.length <= LABEL_LINES) return plain;
	const kept = plain.slice(0, LABEL_LINES);
	let last = [...kept[LABEL_LINES - 1]];
	while (last.length > 1 && measure(`${last.join('')}…`) > LABEL_WIDTH) last = last.slice(0, -1);
	kept[LABEL_LINES - 1] = `${last.join('').trimEnd()}…`;
	return kept;
}

export type PillSize = { lines: string[]; width: number; height: number };

/** A pill's size as styled (.edge-label): its lines, 6px padding and a 1px border on each side. */
export function pillSize(text: string, measure: MeasureText = roughWidth): PillSize {
	const lines = pillLines(text, measure);
	return {
		lines,
		width: Math.max(...lines.map(measure)) + 14,
		height: 18 + (lines.length - 1) * LABEL_LINE_HEIGHT
	};
}

const centred = ({ width, height }: { width: number; height: number }, at: Point): Box => ({
	x: at.x - width / 2,
	y: at.y - height / 2,
	width,
	height
});

/** The label pill's box, centred on `at`. */
export const labelBox = (text: string, at: Point, measure: MeasureText = roughWidth): Box =>
	centred(pillSize(text, measure), at);

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

/** How finely a place along a line is looked for, clear of its ends. */
const STEPS = 200;

/**
 * Where a label put at `position` is drawn along its line: there, or the nearest
 * place where it covers neither of its two Components nor the arrowhead, which
 * would hide it or be hidden. On a line too short for that, where it was put.
 */
export function clearPosition(
	route: Point[],
	position: number,
	size: { width: number; height: number },
	ends: Box[]
): number {
	const blocked = [...ends, arrowhead(route)];
	const isClear = (t: number) => {
		const box = centred(size, pointAlong(route, t));
		return blocked.every((b) => overlap(box, b) === 0);
	};
	if (isClear(position)) return position;
	for (let i = 1; i <= STEPS; i++) {
		for (const step of [-1 / STEPS, 1 / STEPS]) {
			const t = position + i * step;
			if (t < 0 || t > 1 || !isClear(t)) continue;
			// Where it becomes clear, not a step past it: a drag along the end does not jump.
			let [blockedAt, clearAt] = [t - step, t];
			for (let n = 0; n < 12; n++) {
				const middle = (blockedAt + clearAt) / 2;
				if (isClear(middle)) clearAt = middle;
				else blockedAt = middle;
			}
			return clearAt;
		}
	}
	return position;
}

/**
 * Where to draw each Connection's label: where it was put along its line, else
 * so that none overlaps another or a box: the first free candidate along its own route, Connections taken by id
 * so the result is stable; when none is free, the candidate that overlaps
 * least, boxes weighing more than labels. Connections whose boxes are not
 * measured yet are left out.
 */
export function placeLabels(
	boxes: Map<string, Box>,
	connections: LabelledConnection[],
	measure: MeasureText = roughWidth,
	/** A pill's size, for a caller that keeps them. */
	sizeOf: (text: string) => PillSize = (text) => pillSize(text, measure)
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
	// Those put somewhere first: the others make room for them.
	const labelled = ordered.filter((c) => c.label && routes.has(c.id));
	for (const connection of labelled) {
		if (connection.labelPosition === undefined) continue;
		const route = routes.get(connection.id)!;
		const size = sizeOf(connection.label);
		const ends = [boxes.get(connection.source)!, boxes.get(connection.target)!];
		const at = pointAlong(route, clearPosition(route, connection.labelPosition, size, ends));
		placed.push(centred(size, at));
		result.set(connection.id, at);
	}
	for (const connection of labelled) {
		if (connection.labelPosition !== undefined) continue;
		const size = sizeOf(connection.label);
		const options = candidates(routes.get(connection.id)!);
		let best = options[0];
		let bestScore = Infinity;
		for (const at of options) {
			const box = centred(size, at);
			const score =
				obstacles.reduce((sum, b) => sum + overlap(box, b) * 10, 0) +
				placed.reduce((sum, other) => sum + overlap(box, other), 0);
			if (score < bestScore) [best, bestScore] = [at, score];
			if (score === 0) break;
		}
		placed.push(centred(size, best));
		result.set(connection.id, best);
	}
	return result;
}
