import type { Point } from '@simple-modelisation/model/project.ts';

/** How long a finger stays down, in ms, and how far it may drift, in px, for a long press. */
export const LONG_PRESS_DELAY = 500;
export const LONG_PRESS_SLOP = 8;

type PointerLike = {
	pointerId: number;
	pointerType: string;
	/** False for a second finger on the screen. */
	isPrimary: boolean;
	clientX: number;
	clientY: number;
	target: EventTarget | null;
};

/**
 * Tells a long press from a tap, a pan or a pinch: one pointer held still for
 * the delay fires `onPress` once, at where it went down. Moving past the slop,
 * a second finger or lifting before the delay cancels it; a mouse never fires.
 */
export class LongPress {
	private timer: ReturnType<typeof setTimeout> | null = null;
	private start: (Point & { id: number; target: EventTarget | null }) | null = null;
	/** Whether the last press fired: the click that follows it is not a tap. */
	fired = false;

	private readonly onPress: (at: Point, target: EventTarget | null) => void;

	constructor(onPress: (at: Point, target: EventTarget | null) => void) {
		this.onPress = onPress;
	}

	pointerDown(e: PointerLike) {
		this.fired = false;
		// A mouse has its right click; a second finger makes a pinch.
		if (e.pointerType === 'mouse' || !e.isPrimary) return this.cancel();
		this.start = { x: e.clientX, y: e.clientY, id: e.pointerId, target: e.target };
		this.timer = setTimeout(() => {
			const start = this.start;
			this.cancel();
			if (!start) return;
			this.fired = true;
			this.onPress({ x: start.x, y: start.y }, start.target);
		}, LONG_PRESS_DELAY);
	}

	pointerMove(e: PointerLike) {
		const start = this.start;
		if (!start || start.id !== e.pointerId) return;
		if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > LONG_PRESS_SLOP) this.cancel();
	}

	pointerUp() {
		this.cancel();
	}

	cancel() {
		if (this.timer) clearTimeout(this.timer);
		this.timer = null;
		this.start = null;
	}
}
