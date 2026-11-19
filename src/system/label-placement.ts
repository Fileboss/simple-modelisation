import type { Edge } from '@xyflow/react';
import {
	placeLabels,
	roughWidth,
	type MeasureText
} from '@simple-modelisation/model/label-placement.ts';
import type { Box, Point } from '../canvas/geometry';
import type { Layout } from '../canvas/layout';

/** Set on a Connection by the drawing step: where its label is drawn. */
export type PlacedLabel = { labelAt?: Point };

let context: CanvasRenderingContext2D | null | undefined;
const widths = new Map<string, number>();

/** The label text's width in the canvas font (0.75rem system-ui), measured once per text. */
export const measureInPage: MeasureText = (text) => {
	const known = widths.get(text);
	if (known !== undefined) return known;
	context ??= document.createElement('canvas').getContext('2d');
	if (!context) return roughWidth(text);
	context.font = '12px system-ui, "Segoe UI", Roboto, sans-serif';
	const width = context.measureText(text).width;
	widths.set(text, width);
	return width;
};

// The edge drawn last time for an input edge and label position, so unchanged ones keep
// their identity and React Flow can skip re-rendering them (during a drag, for instance).
const drawnEdges = new WeakMap<Edge, Edge>();

/**
 * The System design drawing step: every Connection gets the position its label
 * is drawn at (`labelAt`), from the boxes as React Flow measured them.
 */
export const placeConnectionLabels: Layout = (nodes, edges) => {
	// Zones hold labels rather than block them.
	const boxes = new Map<string, Box>(
		nodes
			.filter((n) => n.type !== 'zone')
			.map((n) => [
				n.id,
				{ ...n.position, width: n.measured?.width ?? 0, height: n.measured?.height ?? 0 }
			])
	);
	const placed = placeLabels(
		boxes,
		edges.map((e) => ({
			id: e.id,
			source: e.source,
			target: e.target,
			label: String((e.data as { label?: string } | undefined)?.label ?? ''),
			points: (e.data as { points?: Point[] } | undefined)?.points
		})),
		measureInPage
	);
	return {
		nodes,
		edges: edges.map((e) => {
			const at = placed.get(e.id);
			if (!at) return e;
			const previous = drawnEdges.get(e);
			const before = (previous?.data as PlacedLabel | undefined)?.labelAt;
			if (previous && before && before.x === at.x && before.y === at.y) return previous;
			const drawn = { ...e, data: { ...e.data, labelAt: at } };
			drawnEdges.set(e, drawn);
			return drawn;
		})
	};
};
