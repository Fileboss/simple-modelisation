import { useReactFlow } from '@xyflow/react';
import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import type { Point } from '../canvas/geometry';
import { LONG_PRESS_DELAY, LONG_PRESS_SLOP } from '../canvas/long-press';
import { followDrag } from '../ui/follow-drag';
import { useCoarsePointer } from '../ui/media';

/** How far, in screen pixels, a press on a part of a Connection goes before it drags it. */
const DRAG_START = 4;

type Handlers = {
	/** What was grabbed stays this far from the pointer, in screen pixels. */
	grab?: Point;
	onBegin?: () => void;
	/** Where what is dragged is, on the canvas. */
	onMove: (at: Point) => void;
	onDrop: () => void;
	onEnd: () => void;
};

/**
 * Dragging a part of a Connection (its label, an end) without getting in the way
 * of the canvas: a modifier selects, Space pans, and where a finger pans (a touch
 * screen) only a selected Connection is dragged.
 */
export function useEdgeDrag(selected: boolean) {
	const { screenToFlowPosition } = useReactFlow();
	const coarsePointer = useCoarsePointer();
	const cancel = useRef<(() => void) | null>(null);
	useEffect(() => () => cancel.current?.(), []);

	return (event: ReactPointerEvent, { grab = { x: 0, y: 0 }, ...handlers }: Handlers) => {
		if (event.button !== 0 || !event.isPrimary) return;
		if (event.shiftKey || event.metaKey || event.ctrlKey) return;
		const isTouch = event.pointerType === 'touch';
		if ((isTouch || coarsePointer) && !selected) return;
		// Space pans (there is none to hold on a touch screen, whose background always pans).
		const flow = (event.target as Element).closest('.react-flow');
		if (!isTouch && !coarsePointer && flow?.querySelector('.react-flow__pane.draggable')) return;
		cancel.current?.();
		cancel.current = followDrag(event, {
			// A finger drags only once it can no longer be a long press, which opens the menu.
			distance: isTouch ? LONG_PRESS_SLOP + 1 : DRAG_START,
			giveUpAfter: event.pointerType === 'mouse' ? undefined : LONG_PRESS_DELAY,
			onBegin: handlers.onBegin,
			onMove: ({ clientX, clientY }) =>
				handlers.onMove(
					screenToFlowPosition({ x: clientX - grab.x, y: clientY - grab.y }, { snapToGrid: false })
				),
			onDrop: handlers.onDrop,
			onEnd: () => {
				cancel.current = null;
				handlers.onEnd();
			}
		});
	};
}
