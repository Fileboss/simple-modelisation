import { useReactFlow, type Edge, type Node, type NodeChange } from '@xyflow/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { NOTE_WIDTHS, ZONE_MIN } from '@simple-modelisation/model/project.ts';
import type { Box, Point } from './geometry';
import { boundsOf, snap, snapSides, type Guide, type SnapTarget } from './snapping';

/** How close, in screen pixels, an edge must come to another to snap to it. */
const SNAP_PIXELS = 6;

/** A node's box as React Flow drew it; null before it is measured. */
function boxOf(node: Node): Box | null {
	const width = node.measured?.width ?? node.width;
	const height = node.measured?.height ?? node.height;
	if (!width || !height) return null;
	return { x: node.position.x, y: node.position.y, width, height };
}

/**
 * The pointer as the window last saw it, and whether Alt (Option) is held,
 * which suspends snapping for as long as it is down.
 */
function usePointer() {
	const state = useRef({ alt: false, client: { x: 0, y: 0 }, down: { x: 0, y: 0 } });
	useEffect(() => {
		const key = (e: KeyboardEvent) => (state.current.alt = e.altKey);
		// Alt may be pressed outside the window, then the pointer comes in: pointer events say too.
		const pointer = (e: PointerEvent) => {
			state.current.alt = e.altKey;
			state.current.client = { x: e.clientX, y: e.clientY };
			if (e.type === 'pointerdown') state.current.down = state.current.client;
		};
		const release = () => (state.current.alt = false);
		window.addEventListener('keydown', key, true);
		window.addEventListener('keyup', key, true);
		window.addEventListener('pointermove', pointer, true);
		window.addEventListener('pointerdown', pointer, true);
		window.addEventListener('blur', release);
		return () => {
			window.removeEventListener('keydown', key, true);
			window.removeEventListener('keyup', key, true);
			window.removeEventListener('pointermove', pointer, true);
			window.removeEventListener('pointerdown', pointer, true);
			window.removeEventListener('blur', release);
		};
	}, []);
	return state;
}

/**
 * A drag being snapped: where the dragged nodes and the pointer started, and
 * where the nodes are drawn now (snapped).
 */
type Drag = {
	starts: Map<string, Box>;
	/** Those that do not snap. */
	free: Set<string>;
	pointer: Point;
	targets: SnapTarget[];
	positions: Map<string, Point>;
};
type Resize = { id: string; start: Box; targets: SnapTarget[]; box: Box };

/**
 * Snapping for the canvas gestures (drag, Zone resize, palette drop): edges
 * and centres snap to the other elements', linked ones centre first, with
 * guides while it lasts; Alt places freely. A drag is followed from the
 * pointer, not from the positions React Flow reports: it reads back the
 * positions it is given, so a snapped one would drift into the next step.
 */
export function useSnapGestures(
	edges: Edge[],
	onResized: (id: string, box: Box, type: string) => void
) {
	const { getNodes, getZoom, screenToFlowPosition } = useReactFlow();
	const [guides, setShownGuides] = useState<Guide[]>([]);
	// Drawn again only when they change: a palette drag reports the pointer every few ms, still or not.
	const setGuides = useCallback(
		(next: Guide[]) =>
			setShownGuides((current) =>
				JSON.stringify(current) === JSON.stringify(next) ? current : next
			),
		[]
	);
	// What a palette drag snaps to, taken once when it comes over the canvas.
	const dropTargets = useRef<SnapTarget[] | null>(null);
	const drag = useRef<Drag | null>(null);
	const resize = useRef<Resize | null>(null);
	const pointer = usePointer();

	const threshold = useCallback(() => SNAP_PIXELS / getZoom(), [getZoom]);

	/** Every drawn node but the excluded ones, those joined to `linkedTo` marked linked. */
	const targetsBut = useCallback(
		(excluded: Set<string>, linkedTo: Set<string> = new Set()) => {
			const linked = new Set<string>();
			for (const e of edges) {
				if (linkedTo.has(e.source)) linked.add(e.target);
				if (linkedTo.has(e.target)) linked.add(e.source);
			}
			return getNodes().flatMap((n) => {
				// An Area is behind the Diagram, placed freely: nothing snaps to it.
				const box = excluded.has(n.id) || n.type === 'area' ? null : boxOf(n);
				return box ? [{ id: n.id, box, linked: linked.has(n.id) }] : [];
			});
		},
		[edges, getNodes]
	);

	/** Starts snapping a drag of `dragged`; `carried` moves along (a Zone's content) and is not a target. */
	const beginDrag = useCallback(
		(dragged: string[], carried: Iterable<string> = []) => {
			const ids = new Set(dragged);
			const moving = new Set([...dragged, ...carried]);
			const starts = new Map<string, Box>();
			for (const n of getNodes()) {
				const box = ids.has(n.id) ? boxOf(n) : null;
				if (box) starts.set(n.id, box);
			}
			// Areas go along without a part in the snapping.
			const free = new Set(
				getNodes()
					.filter((n) => n.type === 'area')
					.map((n) => n.id)
			);
			drag.current = {
				starts,
				free,
				// From where the button went down: React Flow starts the drag a few pixels later,
				// the nodes still where they were.
				pointer: screenToFlowPosition(pointer.current.down),
				// What moves along is joined to its Connections too: they come out straight.
				targets: targetsBut(moving, moving),
				positions: new Map([...starts].map(([id, b]) => [id, { x: b.x, y: b.y }]))
			};
		},
		[getNodes, screenToFlowPosition, pointer, targetsBut]
	);

	/** Where a dragged node is drawn, snapped; undefined for a node not being dragged. */
	const draggedAt = useCallback((id: string) => drag.current?.positions.get(id), []);

	const endDrag = useCallback(() => {
		setGuides([]);
		// React Flow may report the last position after the drag stop: keep snapping it a frame.
		requestAnimationFrame(() => (drag.current = null));
	}, [setGuides]);

	/** Snaps the changes React Flow reports before they reach the canvas state. */
	const snapChanges = useCallback(
		(changes: NodeChange[]): NodeChange[] => {
			/** A Zone's, a Note's or an Area's resize step: its moving sides snapped (not an Area's); the end saves the box. */
			const snapResize = (change: NodeChange, all: NodeChange[]): NodeChange[] => {
				if (change.type === 'position' && resize.current?.id === change.id) return [];
				if (change.type !== 'dimensions' || change.resizing === undefined || !change.dimensions) {
					return [change];
				}
				const node = getNodes().find((n) => n.id === change.id);
				if (!node || !['zone', 'note', 'area'].includes(node.type ?? '')) return [change];
				if (change.resizing === false) {
					const done = resize.current;
					resize.current = null;
					setGuides([]);
					if (!done) return [change];
					onResized(done.id, done.box, node.type!);
					// A Note's height follows its rewrapped text: React Flow measures it again.
					const height = node.type === 'note' ? change.dimensions.height : done.box.height;
					return [{ ...change, dimensions: { width: done.box.width, height } }];
				}
				resize.current ??= {
					id: node.id,
					start: boxOf(node)!,
					targets: node.type === 'area' ? [] : targetsBut(new Set([node.id])),
					box: boxOf(node)!
				};
				const moved = all.find(
					(c): c is Extract<NodeChange, { type: 'position' }> =>
						c.type === 'position' && c.id === change.id
				)?.position;
				const { start } = resize.current;
				const raw = {
					x: moved?.x ?? start.x,
					y: moved?.y ?? start.y,
					width: change.dimensions.width,
					height: change.dimensions.height
				};
				const sided = snapSides(raw, start, resize.current.targets, threshold());
				// Snapping never makes a Zone smaller, or a Note narrower or wider, than it may be.
				const fits =
					node.type === 'area' ||
					(node.type === 'note'
						? sided.box.width >= NOTE_WIDTHS.min && sided.box.width <= NOTE_WIDTHS.max
						: sided.box.width >= ZONE_MIN.width && sided.box.height >= ZONE_MIN.height);
				const snapped = pointer.current.alt || !fits ? { box: raw, guides: [] } : sided;
				resize.current.box = snapped.box;
				setGuides(snapped.guides);
				return [
					{ id: change.id, type: 'position', position: { x: snapped.box.x, y: snapped.box.y } },
					{
						...change,
						dimensions: { width: snapped.box.width, height: snapped.box.height }
					}
				];
			};

			const current = drag.current;
			if (current && changes.some((c) => c.type === 'position' && current.starts.has(c.id))) {
				// The pointer's way since the start, applied to where each node started.
				const at = screenToFlowPosition(pointer.current.client);
				const dx = at.x - current.pointer.x;
				const dy = at.y - current.pointer.y;
				const raw = [...current.starts]
					.filter(([id]) => !current.free.has(id))
					.map(([, b]) => ({ ...b, x: b.x + dx, y: b.y + dy }));
				const snapped =
					pointer.current.alt || raw.length === 0
						? { dx: 0, dy: 0, guides: [] }
						: snap(boundsOf(raw), current.targets, threshold());
				for (const [id, b] of current.starts) {
					current.positions.set(id, { x: b.x + dx + snapped.dx, y: b.y + dy + snapped.dy });
				}
				const dragging = changes.some((c) => c.type === 'position' && c.dragging);
				setGuides(dragging ? snapped.guides : []);
				return changes.map((c) =>
					c.type === 'position' && current.positions.has(c.id)
						? { ...c, position: current.positions.get(c.id) }
						: c
				);
			}
			return changes.flatMap((c) => snapResize(c, changes));
		},
		[getNodes, threshold, pointer, targetsBut, onResized, screenToFlowPosition, setGuides]
	);

	/** A box of `size` centred on `at`, snapped to every element but `except` (unless free); guides shown. */
	const placeCentred = useCallback(
		(at: Point, size: { width: number; height: number }, free: boolean, except?: string): Box => {
			const centred = {
				x: at.x - size.width / 2,
				y: at.y - size.height / 2,
				...size
			};
			if (free) {
				setGuides([]);
				return centred;
			}
			const targets = except
				? targetsBut(new Set([except]))
				: (dropTargets.current ??= targetsBut(new Set()));
			const snapped = snap(centred, targets, threshold());
			setGuides(snapped.guides);
			return { ...centred, x: centred.x + snapped.dx, y: centred.y + snapped.dy };
		},
		[targetsBut, threshold, setGuides]
	);

	const clearGuides = useCallback(() => {
		dropTargets.current = null;
		setGuides([]);
	}, [setGuides]);

	return { guides, beginDrag, draggedAt, endDrag, snapChanges, placeCentred, clearGuides };
}
