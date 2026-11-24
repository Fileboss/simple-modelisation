/** The longest Check, Comment and foreign key name (PostgreSQL's own limit for names). */
export const MAX_CHECK = 500;
export const MAX_COMMENT = 1000;
export const MAX_NAME = 63;

/** Why a Check or a foreign key name is refused, in English (the app has its own strings). */
export const ENGLISH_PROBLEMS = {
	empty: 'A Check cannot be empty.',
	tooLong: `A Check takes ${MAX_CHECK} characters at most.`,
	lines: 'A Check has no line break in quotes and no control character.',
	escapeString: "A Check cannot hold an escape string (E'...').",
	openQuote: 'A Check needs its quotes closed.',
	backslashQuote: 'A Check cannot hold a backslash before a quote.',
	parentheses: 'A Check needs its parentheses balanced.',
	separator: 'A Check cannot hold ";" outside quotes.',
	symbol: 'A Check cannot hold "$" or a backslash outside quotes.',
	sqlComment: 'A Check cannot hold an SQL comment.',
	foreignKeyName:
		'A foreign key name is a letter or _ then letters, digits or _, 63 characters at most.'
};
export type ConstraintProblem = keyof typeof ENGLISH_PROBLEMS;

/** A value the Project document refuses, and why. */
export class ConstraintError extends Error {
	readonly problem: ConstraintProblem;
	constructor(problem: ConstraintProblem) {
		super(ENGLISH_PROBLEMS[problem]);
		this.problem = problem;
	}
}

/**
 * A Check as stored: trimmed, its line breaks spaces. Those in quotes stay (they
 * are part of a value), for `checkProblem` to refuse.
 */
export function cleanCheck(text: string): string {
	let quote = '';
	let cleaned = '';
	// One pass: an agent can send a long text, refused only afterwards.
	for (const char of text) {
		if (quote) {
			if (char === quote) quote = '';
		} else if (char === "'" || char === '"') quote = char;
		cleaned += !quote && LINE_BREAKS.includes(char) ? ' ' : char;
	}
	return cleaned.trim();
}
const LINE_BREAKS = '\n\r\v\f\u0085\u2028\u2029';

/**
 * Why a Check is refused, or null (ADR 0010): the expression must not be able to
 * leave the `CHECK (...)` the script writes it in. Scanned, not parsed: a wrong
 * one fails in the database.
 */
export function checkProblem(text: string): ConstraintProblem | null {
	if (!text) return 'empty';
	if (text.length > MAX_CHECK) return 'tooLong';
	// eslint-disable-next-line no-control-regex
	if (/[\u0000-\u0008\u000a-\u001f\u007f\u0085\u2028\u2029]/.test(text)) return 'lines';
	let depth = 0;
	for (let i = 0; i < text.length; i++) {
		const char = text[i];
		if (char === "'" || char === '"') {
			// An escape string ends by other rules than the ones scanned here.
			if (char === "'" && /(^|[^a-z0-9_])e$/i.test(text.slice(0, i))) return 'escapeString';
			const end = closingQuote(text, i);
			if (end === -1) return 'openQuote';
			// With its quotes: a backslash before a doubled quote or the closing one.
			if (char === "'" && text.slice(i, end + 1).includes("\\'")) return 'backslashQuote';
			i = end;
		} else if (char === '(') depth++;
		else if (char === ')') {
			if (--depth < 0) return 'parentheses';
		} else if (char === ';') return 'separator';
		else if (char === '$' || char === '\\') return 'symbol';
		else if (text.startsWith('--', i) || text.startsWith('/*', i)) return 'sqlComment';
	}
	return depth === 0 ? null : 'parentheses';
}

/** Where the quote opened at `start` closes (a doubled quote is text), or -1. */
function closingQuote(text: string, start: number): number {
	const quote = text[start];
	for (let i = start + 1; i < text.length; i++) {
		if (text[i] !== quote) continue;
		if (text[i + 1] === quote) i++;
		else return i;
	}
	return -1;
}

/** Whether a Check names a column, outside its string literals. */
export function namesColumn(check: string, column: string): boolean {
	const outside = check.replace(/'(?:[^']|'')*'/g, ' ').toLowerCase();
	return outside.split(/[^\p{L}\p{N}_]+/u).includes(column.toLowerCase());
}

/** A Comment as stored: trimmed, `\n` line breaks, no control characters, bounded. */
export const cleanComment = (text: string) =>
	text
		.replace(/\r\n?/g, '\n')
		// eslint-disable-next-line no-control-regex
		.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '')
		.trim()
		.slice(0, MAX_COMMENT)
		.trimEnd();

/** Whether a foreign key can have this name. */
export const isForeignKeyName = (name: unknown): name is string =>
	typeof name === 'string' && /^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(name);
