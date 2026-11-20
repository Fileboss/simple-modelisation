import { readFlag, saveFlag } from '../ui/preference';
import { isTypingTarget } from '../ui/typing';

/** The two side panels of a wide screen: the palette on the left, the panel on the right. */
export type Side = 'palette' | 'panel';
export type SidesOpen = Record<Side, boolean>;

const KEY = (side: Side) => `simple-modelisation:${side}-open`;

/** Which side panels this browser keeps open. */
export const readSidesOpen = (): SidesOpen => ({
	palette: readFlag(KEY('palette')),
	panel: readFlag(KEY('panel'))
});

export function saveSidesOpen(open: SidesOpen): void {
	saveFlag(KEY('palette'), open.palette);
	saveFlag(KEY('panel'), open.panel);
}

/**
 * Cmd/Ctrl+\ hides both panels, or shows both when they are both hidden; not
 * while typing. The backslash by its key or its character: on French or German
 * keyboards it takes Alt, Shift or AltGr (which reads as Ctrl+Alt).
 */
export function isSidesShortcut(
	e: Pick<KeyboardEvent, 'key' | 'code' | 'metaKey' | 'ctrlKey' | 'target'>
): boolean {
	return (
		(e.key === '\\' || e.code === 'Backslash') &&
		(e.metaKey || e.ctrlKey) &&
		!isTypingTarget(e.target)
	);
}

/** What the shortcut does: any panel open closes both; both closed opens both. */
export const toggledSides = (open: SidesOpen): SidesOpen => {
	const show = !open.palette && !open.panel;
	return { palette: show, panel: show };
};
