import { noteLines } from '../layout.ts';
import { NOTE_LOOKS } from '../looks.ts';
import type { Box } from '../geometry.ts';
import type { DiagramNode } from '../project.ts';

// The canvas styles (index.css), so that images look like the screen.
export const FONT = "system-ui, 'Segoe UI', Roboto, sans-serif";
export const TEXT = '#1d1b22';

/** A Note as the canvas draws it: paper in its color, its text wrapped. */
export function noteShape(note: DiagramNode, box: Box): string {
	const look = own(NOTE_LOOKS, note.color) ?? NOTE_LOOKS.yellow;
	const lines = noteLines(String(note.text ?? ''));
	return [
		`<rect x="${box.x + 0.5}" y="${box.y + 0.5}" width="${box.width - 1}" height="${box.height - 1}" rx="4" fill="${look.paper}" stroke="${look.edge}"/>`,
		...lines.map(
			(line, i) =>
				`<text x="${box.x + 12}" y="${box.y + 12 + 10 + i * 20}" font-size="14" fill="#3f3a2e" dy="0.35em">${escape(line)}</text>`
		)
	].join('');
}

/**
 * A catalog entry by a key from the document: its own entries only. Peers can
 * write any value, and `constructor` or `__proto__` must not read what every
 * object inherits.
 */
export function own<T>(catalog: Record<string, T>, key: unknown): T | undefined {
	return typeof key === 'string' && Object.hasOwn(catalog, key) ? catalog[key] : undefined;
}

export function bounds(boxes: Box[]): Box {
	if (boxes.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
	const left = Math.min(...boxes.map((b) => b.x));
	const top = Math.min(...boxes.map((b) => b.y));
	const right = Math.max(...boxes.map((b) => b.x + b.width));
	const bottom = Math.max(...boxes.map((b) => b.y + b.height));
	return { x: left, y: top, width: right - left, height: bottom - top };
}

/**
 * Narrows a text wider than its room, its width guessed at `perChar`: sizes
 * may be estimates (the server, the zip).
 */
export const fit = (text: string, perChar: number, room: number) =>
	text.length * perChar > room ? ` textLength="${room}" lengthAdjust="spacingAndGlyphs"` : '';

/** Text as SVG content: names and labels are user text. */
export function escape(text: string): string {
	return (
		text
			// XML 1.0 forbids control characters other than tab, line feed and carriage return.
			// eslint-disable-next-line no-control-regex
			.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
	);
}
