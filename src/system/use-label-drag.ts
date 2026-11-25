import { useOptionsStore } from '@xyflow/react';
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { nearestAlong } from '@simple-modelisation/model/geometry.ts';
import type { Point } from '../canvas/geometry';
import { useEdgeDrag } from './use-edge-drag';

/**
 * Moving a Connection's label along its `route`: where it is meanwhile (0 to 1),
 * null otherwise.
 */
export function useLabelDrag(
	edgeId: string,
	route: Point[],
	selected: boolean,
	/** Where a label put there is drawn, clear of its ends. */
	clear: (position: number) => number,
	onDrop: (position: number) => void
) {
	const addSelectedEdges = useOptionsStore((s) => s.addSelectedEdges);
	const startDrag = useEdgeDrag(selected);
	const [position, setPosition] = useState<number | null>(null);
	// The line may move under the drag (a peer moving a box).
	const latest = useRef({ route, clear, onDrop });
	useEffect(() => {
		latest.current = { route, clear, onDrop };
	});

	const onPointerDown = (event: ReactPointerEvent) => {
		// Grabbed anywhere on the pill, its middle follows as if grabbed there.
		const pill = event.currentTarget.getBoundingClientRect();
		let current: number | null = null;
		startDrag(event, {
			grab: {
				x: event.clientX - (pill.left + pill.width / 2),
				y: event.clientY - (pill.top + pill.height / 2)
			},
			onBegin: () => addSelectedEdges([edgeId]),
			onMove: (at) => {
				current = latest.current.clear(nearestAlong(latest.current.route, at));
				setPosition(current);
			},
			onDrop: () => {
				if (current !== null) latest.current.onDrop(current);
			},
			onEnd: () => setPosition(null)
		});
	};
	return { position, onPointerDown };
}
