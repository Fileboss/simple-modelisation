export type ImageFormat = 'png' | 'svg';

// Canvas limits every browser accepts: Safari caps the area, Chrome and Firefox each side.
const MAX_SIDE = 16384;
const MAX_AREA = 16777216;

/** The PNG's scale: 2 for sharp text, less when a large Diagram would go past the canvas limits. */
export function pngScale(frame: { width: number; height: number }): number {
	return Math.min(
		2,
		MAX_SIDE / Math.max(frame.width, frame.height),
		Math.sqrt(MAX_AREA / (frame.width * frame.height))
	);
}

/**
 * A plain SVG image (the kind's own drawing) as a PNG, at the scale `pngScale`
 * gives its size: the same image as the SVG, sharp.
 */
export async function rasterizeSvg(svg: string): Promise<Blob> {
	const root = new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement;
	const frame = {
		width: Number(root.getAttribute('width')),
		height: Number(root.getAttribute('height'))
	};
	if (!(frame.width > 0 && frame.height > 0)) throw new Error('The SVG has no size');
	const scale = pngScale(frame);
	const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
	try {
		// onload rather than decode(): Safari's decode() of an SVG may reject, or resolve before it can be drawn.
		const image = new Image();
		await new Promise<void>((resolve, reject) => {
			image.onload = () => resolve();
			image.onerror = () => reject(new Error('The SVG could not be loaded as an image'));
			image.src = url;
		});
		const canvas = document.createElement('canvas');
		canvas.width = Math.floor(frame.width * scale);
		canvas.height = Math.floor(frame.height * scale);
		const context = canvas.getContext('2d');
		if (!context) throw new Error('No canvas to draw the PNG on');
		context.drawImage(image, 0, 0, canvas.width, canvas.height);
		return await new Promise<Blob>((resolve, reject) =>
			canvas.toBlob(
				(blob) => (blob ? resolve(blob) : reject(new Error('PNG encoding failed'))),
				'image/png'
			)
		);
	} finally {
		URL.revokeObjectURL(url);
	}
}
