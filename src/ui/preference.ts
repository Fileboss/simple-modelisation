// Per-browser preferences, never stored in the Project. Blocked storage (private
// browsing, a policy) reads as the default and forgets changes at reload.

/** A stored on/off preference; true unless turned off. */
export function readFlag(key: string): boolean {
	try {
		return localStorage.getItem(key) !== 'false';
	} catch {
		return true;
	}
}

export function saveFlag(key: string, value: boolean): void {
	try {
		localStorage.setItem(key, String(value));
	} catch {
		// Blocked storage: the choice lasts until the page reloads.
	}
}
