import { useReactFlow, useReactFlowStoreApi } from '@xyflow/react';
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { anchorPoint, nearestAnchor, type Anchor } from '@simple-modelisation/model/anchors.ts';
import { boxOf, type Box, type Point } from '../canvas/geometry';
import { useEdgeDrag } from './use-edge-drag';

export type EndName = 'source' | 'target';

/** Where an end being dragged is: at the pointer, and the Anchor it would take, if any. */
export type EndDrag = {
	end: EndName;
	at: Point;
	over: { componentId: string; box: Box; anchor: Anchor } | null;
};

/** How far around a Component, in screen pixels, an end still takes its Anchors. */
const REACH = 24;

/**
 * Dragging an end of a Connection to an Anchor, of its Component or another but
 * `otherId` (the one at the other end). Released anywhere else, nothing changes.
 */
export function useEndDrag(
	otherId: (end: EndName) => string,
	onDrop: (end: EndName, componentId: string, anchor: Anchor) => void
) {
	const { getZoom } = useReactFlow();
	const store = useReactFlowStoreApi();
	// Only a selected Connection shows the grips.
	const startDrag = useEdgeDrag(true);
	const [drag, setDrag] = useState<EndDrag | null>(null);
	const latest = useRef({ otherId, onDrop });
	useEffect(() => {
		latest.current = { otherId, onDrop };
	});

	/**
	 * The Component an end at a point would take: the one drawn on top there (none
	 * when it is `excluded`), else the nearest within reach.
	 */
	const componentAt = (at: Point, excluded: string) => {
		const reach = REACH / getZoom();
		const near = [...store.nodesStore.getState().nodeLookup.values()]
			.filter((node) => node.type === 'component')
			.map((node) => {
				const box = boxOf(node);
				const distance = Math.hypot(
					Math.max(box.x - at.x, 0, at.x - box.x - box.width),
					Math.max(box.y - at.y, 0, at.y - box.y - box.height)
				);
				return { id: node.id, box, distance, z: node.internals.z };
			})
			.filter((c) => c.distance <= reach)
			// On top: the higher, then the later drawn.
			.reverse()
			.sort((a, b) => a.distance - b.distance || b.z - a.z);
		const under = near[0]?.distance === 0 ? near[0] : undefined;
		if (under) return under.id === excluded ? null : under;
		return near.find((c) => c.id !== excluded) ?? null;
	};

	const start = (event: ReactPointerEvent, end: EndName) => {
		event.stopPropagation();
		let current: EndDrag | null = null;
		startDrag(event, {
			onMove: (at) => {
				const found = componentAt(at, latest.current.otherId(end));
				const anchor = found && nearestAnchor(found.box, at);
				current = {
					end,
					at: found && anchor ? anchorPoint(found.box, anchor) : at,
					over: found && anchor ? { componentId: found.id, box: found.box, anchor } : null
				};
				setDrag(current);
			},
			onDrop: () => {
				const over = current?.over;
				if (over) latest.current.onDrop(end, over.componentId, over.anchor);
			},
			onEnd: () => setDrag(null)
		});
	};
	return { drag, start };
}
