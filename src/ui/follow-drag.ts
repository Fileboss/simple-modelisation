import type { PointerEvent as ReactPointerEvent } from 'react';

/** Ignores the click a drag ends with, wherever it lands. */
function swallowClick() {
	const swallow = (click: MouseEvent) => {
		click.stopPropagation();
		click.preventDefault();
	};
	window.addEventListener('click', swallow, { capture: true, once: true });
	setTimeout(() => window.removeEventListener('click', swallow, { capture: true }));
}

type Options = {
	/** How far, in screen pixels, the pointer goes before the press is a drag. */
	distance: number;
	/** The drag begins after a press this long instead, and going that far first gives it up. */
	pressDelay?: number;
	/** A press held this long without a drag is something else (a long press): given up. */
	giveUpAfter?: number;
	onBegin?: () => void;
	/** The pointer moved, the drag begun. */
	onMove: (e: { clientX: number; clientY: number }) => void;
	/** Released after a drag; not when it was given up or abandoned. */
	onDrop: () => void;
	/** Always, last. */
	onEnd: () => void;
};

/**
 * Follows a press on the window until it is released, so that the drag goes on
 * wherever the pointer does. Escape, the window losing the focus and the pointer
 * being lost leave things as they were. Returns how to abandon it.
 */
export function followDrag(event: ReactPointerEvent, options: Options): () => void {
	const { pointerId, pointerType } = event;
	const start = { x: event.clientX, y: event.clientY };
	const isTouch = pointerType === 'touch';
	let last = { clientX: start.x, clientY: start.y };
	let begun = false;
	let ended = false;

	const begin = () => {
		begun = true;
		clearTimeout(giveUp);
		options.onBegin?.();
		options.onMove(last);
	};
	const press =
		options.pressDelay === undefined ? undefined : setTimeout(begin, options.pressDelay);
	const giveUp =
		options.giveUpAfter === undefined ? undefined : setTimeout(() => stop(), options.giveUpAfter);

	const onMove = (e: PointerEvent) => {
		if (e.pointerId !== pointerId) return;
		// Released where the page could not see it (a menu, another window).
		if (e.buttons === 0) return stop();
		last = { clientX: e.clientX, clientY: e.clientY };
		if (begun) return options.onMove(last);
		if (Math.hypot(e.clientX - start.x, e.clientY - start.y) < options.distance) return;
		if (press === undefined) begin();
		else stop();
	};
	const onUp = (e: PointerEvent) => {
		if (e.pointerId !== pointerId) return;
		if (!begun) return stop();
		swallowClick();
		options.onDrop();
		stop();
	};
	const onCancel = (e: PointerEvent) => {
		if (e.pointerId === pointerId) stop();
	};
	const onKey = (e: KeyboardEvent) => {
		if (e.key !== 'Escape' || !begun) return;
		e.stopPropagation();
		abandon();
	};
	// Once a finger drags, it no longer scrolls, nor opens the browser's menu.
	const onTouchMove = (e: TouchEvent) => {
		if (begun) e.preventDefault();
	};
	const onMenu = (e: Event) => {
		if (isTouch) e.preventDefault();
	};
	const blur = () => stop();

	const stop = () => {
		if (ended) return;
		ended = true;
		clearTimeout(press);
		clearTimeout(giveUp);
		window.removeEventListener('pointermove', onMove);
		window.removeEventListener('pointerup', onUp);
		window.removeEventListener('pointercancel', onCancel);
		window.removeEventListener('blur', blur);
		window.removeEventListener('keydown', onKey, true);
		window.removeEventListener('touchmove', onTouchMove);
		window.removeEventListener('contextmenu', onMenu, true);
		options.onEnd();
	};
	/** Stops with the button still down: this pointer's release opens nothing either. */
	const abandon = () => {
		if (ended) return;
		stop();
		if (!begun) return;
		const forget = () => {
			window.removeEventListener('pointerup', release);
			window.removeEventListener('pointerdown', forget, true);
			window.removeEventListener('blur', forget);
		};
		const release = (e: PointerEvent) => {
			if (e.pointerId !== pointerId) return;
			forget();
			swallowClick();
		};
		window.addEventListener('pointerup', release);
		// Released out of sight: the next press is another gesture.
		window.addEventListener('pointerdown', forget, true);
		window.addEventListener('blur', forget);
	};
	window.addEventListener('pointermove', onMove);
	window.addEventListener('pointerup', onUp);
	window.addEventListener('pointercancel', onCancel);
	window.addEventListener('blur', blur);
	window.addEventListener('keydown', onKey, true);
	window.addEventListener('touchmove', onTouchMove, { passive: false });
	window.addEventListener('contextmenu', onMenu, true);
	return abandon;
}
