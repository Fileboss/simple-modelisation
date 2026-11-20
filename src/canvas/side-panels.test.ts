import { describe, expect, it } from 'vitest';
import { isSidesShortcut, toggledSides } from './side-panels';

const key = (over: Partial<KeyboardEvent> = {}) => ({
	key: '\\',
	code: 'Backslash',
	metaKey: true,
	ctrlKey: false,
	altKey: false,
	shiftKey: false,
	target: null,
	...over
});

describe('side panels', () => {
	it('hides both when either is open, shows both when both are hidden', () => {
		expect(toggledSides({ palette: true, panel: true })).toEqual({ palette: false, panel: false });
		expect(toggledSides({ palette: false, panel: true })).toEqual({ palette: false, panel: false });
		expect(toggledSides({ palette: false, panel: false })).toEqual({ palette: true, panel: true });
	});

	it('takes Cmd+\\ or Ctrl+\\, whatever the keyboard needs to type the backslash', () => {
		expect(isSidesShortcut(key())).toBe(true);
		expect(isSidesShortcut(key({ metaKey: false, ctrlKey: true }))).toBe(true);
		// French Mac: Shift+Alt+/ types it; French or German PC: AltGr, read as Ctrl+Alt.
		expect(isSidesShortcut(key({ code: 'Slash', shiftKey: true, altKey: true }))).toBe(true);
		expect(
			isSidesShortcut(key({ metaKey: false, ctrlKey: true, altKey: true, code: 'Digit8' }))
		).toBe(true);
		expect(isSidesShortcut(key({ metaKey: false }))).toBe(false);
		expect(isSidesShortcut(key({ key: '/', code: 'Slash' }))).toBe(false);
	});
});
