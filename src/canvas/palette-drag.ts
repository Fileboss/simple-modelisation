import { useSyncExternalStore, type DragEvent } from 'react';

/** What both palettes drag to write a Note. */
export const NOTE_ITEM = 'note';

/** MIME type of what the palette drags onto the canvas. */
export const PALETTE_MIME = 'application/x-simple-modelisation';

// The palette item being dragged: a drag over the canvas cannot read the data it carries.
let paletteItem: string | null = null;
// Made and decoded ahead: an image not loaded yet when the drag starts is ignored.
const emptyImage =
	typeof Image === 'undefined'
		? undefined
		: Object.assign(new Image(), {
				src: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
			});

/**
 * Starts dragging a palette item: the canvas draws the element itself while it
 * is over it, so the browser's picture of the palette item is hidden.
 */
export function startPaletteDrag(event: DragEvent, item: string) {
	paletteItem = item;
	event.dataTransfer.setData(PALETTE_MIME, item);
	event.dataTransfer.effectAllowed = 'copy';
	if (emptyImage) event.dataTransfer.setDragImage(emptyImage, 0, 0);
}

/** The palette item being dragged, if any. */
export const draggedPaletteItem = () => paletteItem;

export function endPaletteDrag() {
	paletteItem = null;
}

/** A palette item tapped on a touch screen, for the Diagram whose palette it is in. */
export type ArmedItem = { item: string; diagramId: string };

// The next tap on that Diagram's canvas places it; another Diagram ignores it.
let armedItem: ArmedItem | null = null;
const armListeners = new Set<() => void>();

/** Arms a palette item, or disarms with null. */
export function armPaletteItem(armed: ArmedItem | null) {
	if (armed?.item === armedItem?.item && armed?.diagramId === armedItem?.diagramId) return;
	armedItem = armed;
	armListeners.forEach((listener) => listener());
}

/** The armed palette item, if any. */
export const armedPaletteItem = () => armedItem;

/** Calls `listener` whenever the armed item changes; returns the unsubscribe. */
export function onArmedChange(listener: () => void) {
	armListeners.add(listener);
	return () => {
		armListeners.delete(listener);
	};
}

/** The armed palette item, following its changes. */
export const useArmedItem = () => useSyncExternalStore(onArmedChange, armedPaletteItem, () => null);
