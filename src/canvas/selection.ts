import { isTypingTarget } from '../ui/typing';

/** Every element selected, or none; unchanged elements keep their identity. */
export function withSelection<T extends { selected?: boolean }>(
	elements: T[],
	selected: boolean
): T[] {
	return elements.map((e) => (Boolean(e.selected) === selected ? e : { ...e, selected }));
}

type Key = Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey' | 'target'>;

/**
 * What a key does to the canvas selection: Cmd/Ctrl+A selects all, Escape
 * none, Cmd/Ctrl+D duplicates, C, X and V copy, cut and paste. Only while the canvas is the last thing clicked
 * (elsewhere, Cmd+A selects text and Escape closes menus), never in a field,
 * and never with other modifiers (Cmd+Shift+A is the browser's).
 */
export function selectionShortcut(
	e: Key,
	canvasActive: boolean
): 'all' | 'none' | 'duplicate' | 'copy' | 'cut' | 'paste' | null {
	if (!canvasActive || isTypingTarget(e.target) || e.altKey || e.shiftKey) return null;
	if (e.key === 'Escape' && !e.metaKey && !e.ctrlKey) return 'none';
	if (e.metaKey === e.ctrlKey) return null;
	const shortcuts = { a: 'all', d: 'duplicate', c: 'copy', x: 'cut', v: 'paste' } as const;
	return shortcuts[e.key.toLowerCase() as keyof typeof shortcuts] ?? null;
}

/** Whether a copy, cut or paste is the canvas's: the canvas last clicked, not typing in a field. */
export const isCanvasClipboard = (e: Pick<ClipboardEvent, 'target'>, canvasActive: boolean) =>
	canvasActive && !isTypingTarget(e.target);
