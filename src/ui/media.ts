import { useSyncExternalStore } from 'react';

// One subscribe function per query: a new one on each render would make React subscribe again.
const subscribers = new Map<string, (onChange: () => void) => () => void>();

function subscriber(query: string) {
	let subscribe = subscribers.get(query);
	if (!subscribe) {
		subscribe = (onChange) => {
			if (typeof matchMedia === 'undefined') return () => {};
			const list = matchMedia(query);
			list.addEventListener('change', onChange);
			return () => list.removeEventListener('change', onChange);
		};
		subscribers.set(query, subscribe);
	}
	return subscribe;
}

/** Whether a media query matches, following its changes. */
export function useMediaQuery(query: string): boolean {
	return useSyncExternalStore(
		subscriber(query),
		() => typeof matchMedia !== 'undefined' && matchMedia(query).matches,
		() => false
	);
}

/** The width under which the canvas takes the whole screen; index.css uses the same. */
export const SMALL_SCREEN = '(max-width: 767px)';

/** A phone: the panels become drawers over the canvas. */
export const useSmallScreen = () => useMediaQuery(SMALL_SCREEN);

/** A touch screen, whatever its size: gestures made for a finger. */
export const useCoarsePointer = () => useMediaQuery('(pointer: coarse)');
