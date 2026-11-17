import { expect, it } from 'vitest';
import { exportFrame, pngScale } from './export-image';

it('frames the whole Diagram with a margin, wherever it sits', () => {
	expect(exportFrame({ x: -120, y: 40, width: 800, height: 300.4 })).toEqual({
		width: 864,
		height: 365,
		transform: 'translate(152px, -8px) scale(1)',
		x: -152,
		y: 8
	});
});

it('draws the PNG at scale 2, less when the canvas would be too large', () => {
	expect(pngScale({ width: 2000, height: 700 })).toBe(2);
	expect(pngScale({ width: 12000, height: 400 })).toBeCloseTo(16384 / 12000);
	const big = { width: 6000, height: 5000 };
	const scale = pngScale(big);
	expect(big.width * scale * big.height * scale).toBeLessThanOrEqual(16777216 + 1);
});
