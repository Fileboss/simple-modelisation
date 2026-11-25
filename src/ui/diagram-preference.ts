import { useSyncExternalStore } from 'react';

/**
 * A choice per browser and per Diagram (an MCD's Notation), never stored in the
 * Project; followed in the browser's other tabs.
 */
export function diagramPreference<T extends string>(name: string, values: readonly [T, ...T[]]) {
	const storageKey = (diagramId: string) => `simple-modelisation:${name}:${diagramId}`;
	const listeners = new Set<() => void>();
	// When storage is blocked, the choice lasts until the page reloads.
	const unsaved = new Map<string, T>();

	/** The choice, or the first value. */
	function get(diagramId: string): T {
		const kept = unsaved.get(diagramId);
		if (kept) return kept;
		try {
			const stored = localStorage.getItem(storageKey(diagramId));
			return values.find((value) => value === stored) ?? values[0];
		} catch {
			return values[0];
		}
	}

	function set(diagramId: string, value: T): void {
		try {
			localStorage.setItem(storageKey(diagramId), value);
			unsaved.delete(diagramId);
		} catch {
			unsaved.set(diagramId, value);
		}
		for (const listener of listeners) listener();
	}

	// One subscription for every component; other tabs report their changes through 'storage'.
	function subscribe(onChange: () => void): () => void {
		listeners.add(onChange);
		window.addEventListener('storage', onChange);
		return () => {
			listeners.delete(onChange);
			window.removeEventListener('storage', onChange);
		};
	}

	const use = (diagramId: string): T => useSyncExternalStore(subscribe, () => get(diagramId));

	return { get, set, use };
}
