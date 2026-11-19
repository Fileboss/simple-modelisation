import { describe, expect, it } from 'vitest';
import { selectionShortcut, withSelection } from './selection';

describe('withSelection', () => {
	it('selects every element, or none, keeping those already so', () => {
		const kept = { id: 'a', selected: true };
		const other: { id: string; selected?: boolean } = { id: 'b' };
		const all = withSelection([kept, other], true);
		expect(all).toEqual([kept, { id: 'b', selected: true }]);
		expect(all[0]).toBe(kept);
		expect(withSelection(all, false).map((e) => e.selected)).toEqual([false, false]);
		expect(withSelection([other], false)[0]).toBe(other);
	});
});

describe('selectionShortcut', () => {
	const key = (
		key: string,
		mods: Partial<KeyboardEvent> = {},
		target: EventTarget | null = null
	) => ({
		key,
		metaKey: false,
		ctrlKey: false,
		shiftKey: false,
		altKey: false,
		target,
		...mods
	});

	it('selects all with Cmd or Ctrl+A, none with Escape, on the canvas', () => {
		expect(selectionShortcut(key('a', { metaKey: true }), true)).toBe('all');
		expect(selectionShortcut(key('A', { ctrlKey: true }), true)).toBe('all');
		expect(selectionShortcut(key('Escape'), true)).toBe('none');
	});

	it('leaves the keys alone off the canvas, in a field, or with other modifiers', () => {
		expect(selectionShortcut(key('a', { metaKey: true }), false)).toBeNull();
		expect(selectionShortcut(key('Escape'), false)).toBeNull();
		expect(selectionShortcut(key('a', { metaKey: true, shiftKey: true }), true)).toBeNull();
		expect(selectionShortcut(key('a', { metaKey: true, altKey: true }), true)).toBeNull();
		expect(selectionShortcut(key('a'), true)).toBeNull();
		// What isTypingTarget reads of an element: tests run without a DOM.
		const field = { isContentEditable: false, closest: () => ({}) } as unknown as EventTarget;
		expect(selectionShortcut(key('a', { metaKey: true }, field), true)).toBeNull();
		const editable = { isContentEditable: true, closest: () => null } as unknown as EventTarget;
		expect(selectionShortcut(key('Escape', {}, editable), true)).toBeNull();
	});
});
