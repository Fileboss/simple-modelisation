export type ImageFormat = 'png' | 'svg';

type Rect = { x: number; y: number; width: number; height: number };

/**
 * The image's size, the viewport transform that puts the whole Diagram in it,
 * and the top-left corner of the framed area in Diagram coordinates.
 */
export type Frame = { width: number; height: number; transform: string; x: number; y: number };

/** Frames a Diagram's bounds with a margin, at zoom 1. */
export function exportFrame(bounds: Rect, margin = 32): Frame {
	return {
		width: Math.ceil(bounds.width + margin * 2),
		height: Math.ceil(bounds.height + margin * 2),
		transform: `translate(${margin - bounds.x}px, ${margin - bounds.y}px) scale(1)`,
		x: bounds.x - margin,
		y: bounds.y - margin
	};
}

// Canvas limits every browser accepts: Safari caps the area, Chrome and Firefox each side.
const MAX_SIDE = 16384;
const MAX_AREA = 16777216;

/** The PNG's scale: 2 for sharp text, less when a large Diagram would go past the canvas limits. */
export function pngScale(frame: Pick<Frame, 'width' | 'height'>): number {
	return Math.min(
		2,
		MAX_SIDE / Math.max(frame.width, frame.height),
		Math.sqrt(MAX_AREA / (frame.width * frame.height))
	);
}

/** Two rectangles' union. */
const union = (a: Rect, b: Rect): Rect => {
	const x = Math.min(a.x, b.x);
	const y = Math.min(a.y, b.y);
	return {
		x,
		y,
		width: Math.max(a.x + a.width, b.x + b.width) - x,
		height: Math.max(a.y + a.height, b.y + b.height) - y
	};
};

/**
 * What the Diagram covers, in Diagram coordinates: its boxes, but also the
 * edges and labels drawn beyond them. Null when it is empty.
 */
export function drawnBounds(
	viewport: HTMLElement,
	toFlow: (point: { x: number; y: number }) => { x: number; y: number }
): Rect | null {
	const drawn = viewport.querySelectorAll(
		'.react-flow__node, .react-flow__edge path, .react-flow__edgelabel-renderer > *'
	);
	let bounds: Rect | null = null;
	for (const element of drawn) {
		const rect = element.getBoundingClientRect();
		if (rect.width === 0 && rect.height === 0) continue;
		const start = toFlow({ x: rect.left, y: rect.top });
		const end = toFlow({ x: rect.right, y: rect.bottom });
		const flowRect = { x: start.x, y: start.y, width: end.x - start.x, height: end.y - start.y };
		bounds = bounds ? union(bounds, flowRect) : flowRect;
	}
	return bounds;
}

// Interface that must not appear in the image.
const LEFT_OUT = ['react-flow__handle', 'remote-cursor', 'hosting-picker'];

/** Marks the edges' SVGs during a capture, so that their copies can be enlarged. */
const EDGE_MARK = 'data-export-edge';

/**
 * Captures the canvas viewport as a PNG or SVG file, on white, framed by
 * `frame`. The capture library loads on the first export.
 */
export async function captureViewport(
	viewport: HTMLElement,
	frame: Frame,
	format: ImageFormat
): Promise<Blob> {
	const { domToBlob, domToForeignObjectSvg } = await import('modern-screenshot');
	// Each edge is a small SVG drawing outside its box (overflow: visible), which the
	// capture would crop: in the copy, stretch it over the whole frame, its view box
	// shifted to match, so that the lines stay where they are.
	const edges = [...viewport.querySelectorAll<SVGSVGElement>('.react-flow__edges > svg')];
	for (const svg of edges) svg.setAttribute(EDGE_MARK, '');
	const options = {
		width: frame.width,
		height: frame.height,
		backgroundColor: '#ffffff',
		style: {
			width: `${frame.width}px`,
			height: `${frame.height}px`,
			transform: frame.transform
		},
		filter: (node: Node) =>
			!(node instanceof Element && LEFT_OUT.some((name) => node.classList.contains(name))),
		onCloneEachNode: (cloned: Node) => {
			if (!(cloned instanceof SVGSVGElement) || !cloned.hasAttribute(EDGE_MARK)) return;
			// Moved by a transform: the capture does not keep a left / top set here.
			cloned.style.transform = `translate(${frame.x}px, ${frame.y}px)`;
			cloned.style.transformOrigin = '0 0';
			// The size goes in the style too: the capture keeps the computed 300 × 150 otherwise.
			cloned.style.width = `${frame.width}px`;
			cloned.style.height = `${frame.height}px`;
			cloned.setAttribute('width', String(frame.width));
			cloned.setAttribute('height', String(frame.height));
			cloned.setAttribute('viewBox', `${frame.x} ${frame.y} ${frame.width} ${frame.height}`);
		}
	};
	try {
		if (format === 'png') return await domToBlob(viewport, { ...options, scale: pngScale(frame) });
		// The page itself, not its picture (domToSvg wraps a PNG): sharp at any size.
		const svg = await domToForeignObjectSvg(viewport, options);
		return new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' });
	} finally {
		for (const svg of edges) svg.removeAttribute(EDGE_MARK);
	}
}
