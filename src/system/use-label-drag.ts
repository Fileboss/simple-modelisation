import { useOptionsStore, useReactFlow } from '@xyflow/react';
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { nearestAlong } from '@simple-modelisation/model/geometry.ts';
import type { Point } from '../canvas/geometry';
import { LONG_PRESS_DELAY, LONG_PRESS_SLOP } from '../canvas/long-press';
import { followDrag } from '../ui/follow-drag';
import { useCoarsePointer } from '../ui/media';

/** How far, in screen pixels, a press on a label goes before it moves it rather than selects its Connection. */
const DRAG_START = 4;

/**
 * Moving a Connection's label along its `route`: where it is meanwhile (0 to 1),
 * null otherwise. Where a finger pans (a touch screen), only once the Connection
 * is selected.
 */
export function useLabelDrag(
	edgeId: string,
	route: Point[],
	selected: boolean,
	/** Where a label put there is drawn, clear of its ends. */
	clear: (position: number) => number,
	onDrop: (position: number) => void
) {
	const { screenToFlowPosition } = useReactFlow();
	const addSelectedEdges = useOptionsStore((s) => s.addSelectedEdges);
	const coarsePointer = useCoarsePointer();
	const [position, setPosition] = useState<number | null>(null);
	const cancel = useRef<(() => void) | null>(null);
	useEffect(() => () => cancel.current?.(), []);
	// The line may move under the drag (a peer moving a box).
	const latest = useRef({ route, clear, onDrop });
	useEffect(() => {
		latest.current = { route, clear, onDrop };
	});

	const onPointerDown = (event: ReactPointerEvent) => {
		if (event.button !== 0 || !event.isPrimary) return;
		if (event.shiftKey || event.metaKey || event.ctrlKey) return;
		const isTouch = event.pointerType === 'touch';
		if ((isTouch || coarsePointer) && !selected) return;
		// Space pans (there is none to hold on a touch screen, whose background always pans).
		const target = event.target as Element;
		if (!isTouch && !coarsePointer && target.closest('.react-flow__pane.draggable')) return;
		cancel.current?.();
		// Grabbed anywhere on the pill, its middle follows as if grabbed there.
		const pill = (event.currentTarget as Element).getBoundingClientRect();
		const grab = {
			x: event.clientX - (pill.left + pill.width / 2),
			y: event.clientY - (pill.top + pill.height / 2)
		};
		let current: number | null = null;
		cancel.current = followDrag(event, {
			// A finger drags only once it can no longer be a long press, which opens the menu.
			distance: isTouch ? LONG_PRESS_SLOP + 1 : DRAG_START,
			giveUpAfter: event.pointerType === 'mouse' ? undefined : LONG_PRESS_DELAY,
			onBegin: () => addSelectedEdges([edgeId]),
			onMove: ({ clientX, clientY }) => {
				const at = screenToFlowPosition(
					{ x: clientX - grab.x, y: clientY - grab.y },
					{ snapToGrid: false }
				);
				current = latest.current.clear(nearestAlong(latest.current.route, at));
				setPosition(current);
			},
			onDrop: () => {
				if (current !== null) latest.current.onDrop(current);
			},
			onEnd: () => {
				cancel.current = null;
				setPosition(null);
			}
		});
	};
	return { position, onPointerDown };
}
