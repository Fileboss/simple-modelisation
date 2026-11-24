import type { Edge } from '@xyflow/react';
import {
	pillSize,
	pillText,
	placeLabels,
	roughWidth,
	type MeasureText,
	type PillSize
} from '@simple-modelisation/model/label-placement.ts';
import type { ConnectionEdge } from '@simple-modelisation/model/project.ts';
import { strings } from '../ui/strings';
import type { Box, Point } from '../canvas/geometry';
import type { Layout } from '../canvas/layout';

/** Set on a Connection by the drawing step: where its label is drawn. */
export type PlacedLabel = { labelAt?: Point };

const LABEL_FONT = '12px system-ui, "Segoe UI", Roboto, sans-serif';
let context: CanvasRenderingContext2D | null | undefined;
const widths = new Map<string, number>();

/** The label text's width in the canvas font (0.75rem system-ui), measured once per text. */
export const measureInPage: MeasureText = (text) => {
	const known = widths.get(text);
	if (known !== undefined) return known;
	const width = measureOnce(text);
	if (widths.size >= KEPT) widths.clear();
	widths.set(text, width);
	return width;
};

// Wrapping measures many parts of a label: its result is kept rather than theirs.
const sizes = new Map<string, PillSize>();
/** How many of each are kept: far more than a Diagram shows. */
const KEPT = 2000;

const measureOnce: MeasureText = (text) => {
	context ??= document.createElement('canvas').getContext('2d');
	if (!context) return roughWidth(text);
	context.font = LABEL_FONT;
	return context.measureText(text).width;
};

/** A pill's lines and size in the page, worked out once per text. */
export function pillInPage(text: string): PillSize {
	const known = sizes.get(text);
	if (known) return known;
	const size = pillSize(text, measureOnce);
	if (sizes.size >= KEPT) sizes.clear();
	sizes.set(text, size);
	return size;
}

/** A Connection's pill text, its Flow's name first, as drawn and measured. */
export const connectionPill = (connection: Partial<ConnectionEdge> | undefined) =>
	pillText(
		String(connection?.label ?? ''),
		connection?.flow && Object.hasOwn(strings.flow.names, connection.flow)
			? strings.flow.names[connection.flow]
			: undefined
	);

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
			label: connectionPill(e.data as Partial<ConnectionEdge> | undefined),
			points: (e.data as Partial<ConnectionEdge> | undefined)?.points,
			labelPosition: (e.data as Partial<ConnectionEdge> | undefined)?.labelPosition
		})),
		measureInPage,
		pillInPage
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
