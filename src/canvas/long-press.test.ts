import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LONG_PRESS_DELAY, LongPress } from './long-press';

const finger = (pointerId: number, clientX: number, clientY: number, isPrimary = true) => ({
	pointerId,
	pointerType: 'touch',
	isPrimary,
	clientX,
	clientY,
	target: null
});

describe('long press', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it('fires once after the delay, where the finger went down', () => {
		const onPress = vi.fn();
		const press = new LongPress(onPress);
		press.pointerDown(finger(1, 100, 200));
		vi.advanceTimersByTime(LONG_PRESS_DELAY - 1);
		expect(onPress).not.toHaveBeenCalled();
		press.pointerMove(finger(1, 104, 203));
		vi.advanceTimersByTime(1);
		expect(onPress).toHaveBeenCalledExactlyOnceWith({ x: 100, y: 200 }, null);
		expect(press.fired).toBe(true);
	});

	it('does not fire when the finger moves past the slop: a pan', () => {
		const onPress = vi.fn();
		const press = new LongPress(onPress);
		press.pointerDown(finger(1, 100, 200));
		press.pointerMove(finger(1, 110, 200));
		vi.advanceTimersByTime(LONG_PRESS_DELAY);
		expect(onPress).not.toHaveBeenCalled();
	});

	it('does not fire with a second finger: a pinch', () => {
		const onPress = vi.fn();
		const press = new LongPress(onPress);
		press.pointerDown(finger(1, 100, 200));
		press.pointerDown(finger(2, 200, 300, false));
		vi.advanceTimersByTime(LONG_PRESS_DELAY);
		expect(onPress).not.toHaveBeenCalled();
	});

	it('does not fire when the finger lifts first: a tap', () => {
		const onPress = vi.fn();
		const press = new LongPress(onPress);
		press.pointerDown(finger(1, 100, 200));
		press.pointerUp();
		vi.advanceTimersByTime(LONG_PRESS_DELAY);
		expect(onPress).not.toHaveBeenCalled();
		expect(press.fired).toBe(false);
	});

	it('never fires for a mouse, and a mouse press forgets the last long press', () => {
		const onPress = vi.fn();
		const press = new LongPress(onPress);
		press.pointerDown(finger(1, 0, 0));
		vi.advanceTimersByTime(LONG_PRESS_DELAY);
		expect(press.fired).toBe(true);
		press.pointerDown({ ...finger(2, 0, 0), pointerType: 'mouse' });
		vi.advanceTimersByTime(LONG_PRESS_DELAY);
		expect(onPress).toHaveBeenCalledOnce();
		expect(press.fired).toBe(false);
	});

	it('fires for the next press after a pinch, whatever became of its pointers', () => {
		const onPress = vi.fn();
		const press = new LongPress(onPress);
		press.pointerDown(finger(1, 0, 0));
		press.pointerDown(finger(2, 50, 50, false));
		press.pointerDown(finger(3, 10, 10));
		vi.advanceTimersByTime(LONG_PRESS_DELAY);
		expect(onPress).toHaveBeenCalledOnce();
	});
});
