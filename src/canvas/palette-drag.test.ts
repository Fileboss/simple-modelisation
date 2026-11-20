import { afterEach, describe, expect, it, vi } from 'vitest';
import { armedPaletteItem, armPaletteItem, onArmedChange } from './palette-drag';

describe('armed palette item', () => {
	afterEach(() => armPaletteItem(null));

	it('is armed by a tap and disarmed with null', () => {
		armPaletteItem({ item: 'service', diagramId: 'd1' });
		expect(armedPaletteItem()).toEqual({ item: 'service', diagramId: 'd1' });
		armPaletteItem(null);
		expect(armedPaletteItem()).toBeNull();
	});

	it('tells listeners of each change, not of the same item again', () => {
		const listener = vi.fn();
		const stop = onArmedChange(listener);
		armPaletteItem({ item: 'service', diagramId: 'd1' });
		armPaletteItem({ item: 'service', diagramId: 'd1' });
		armPaletteItem({ item: 'service', diagramId: 'd2' });
		armPaletteItem(null);
		expect(listener).toHaveBeenCalledTimes(3);
		stop();
		armPaletteItem({ item: 'service', diagramId: 'd1' });
		expect(listener).toHaveBeenCalledTimes(3);
	});
});
