import type { DiagramEdge, DiagramKind, DiagramNode } from './project.ts';
import { estimatedSize } from './layout.ts';
import { zoneContent, zoneParents } from './zones.ts';

/** What a copy carries: elements of one Diagram, as JSON text in the system clipboard. */
export type Clip = {
	format: typeof CLIP_FORMAT;
	version: 1;
	/** The kind of Diagram copied from; a paste keeps what the target kind takes. */
	kind: DiagramKind;
	nodes: DiagramNode[];
	edges: DiagramEdge[];
};

export const CLIP_FORMAT = 'simple-modelisation/clip';
/** Beyond this many elements, a clip is refused: a paste is a gesture, not an import. */
const MAX_CLIP = 2000;

/**
 * The selected nodes, with what the selected Zones hold, and the edges whose
 * two ends are taken (a Connection to an element left behind stays behind).
 */
export function copyElements(
	nodes: DiagramNode[],
	edges: DiagramEdge[],
	ids: Iterable<string>,
	kind: DiagramKind
): Clip {
	const taken = new Set(ids);
	const parents = zoneParents(nodes, estimatedSize);
	for (const node of nodes) {
		if (taken.has(node.id) && node.type === 'zone') {
			for (const inside of zoneContent(parents, node.id)) taken.add(inside);
		}
	}
	return {
		format: CLIP_FORMAT,
		version: 1,
		kind,
		nodes: nodes.filter((n) => taken.has(n.id)),
		edges: edges.filter((e) => taken.has(e.source) && taken.has(e.target))
	};
}

/** A clip from clipboard text; null for anything else (text from elsewhere, a damaged clip). */
export function readClip(text: string): Clip | null {
	// A paste is a gesture: a megabyte of text is not a clip of this app.
	if (text.length > 1_000_000) return null;
	let data: unknown;
	try {
		data = JSON.parse(text);
	} catch {
		return null;
	}
	const clip = data as Partial<Clip> | null;
	const ok =
		clip?.format === CLIP_FORMAT &&
		clip.version === 1 &&
		(clip.kind === 'system' || clip.kind === 'mcd') &&
		Array.isArray(clip.nodes) &&
		Array.isArray(clip.edges) &&
		clip.nodes.length + clip.edges.length <= MAX_CLIP;
	// Each element is checked again when pasted, as an imported file's are.
	return ok ? (clip as Clip) : null;
}

/** The box around nodes, at the model's sizes: checked ones (see pasteable). */
export function clipBounds(nodes: DiagramNode[]) {
	const boxes = nodes.map((n) => ({ ...estimatedSize(n), x: n.x, y: n.y }));
	const left = Math.min(...boxes.map((b) => b.x));
	const top = Math.min(...boxes.map((b) => b.y));
	return {
		x: left,
		y: top,
		width: Math.max(...boxes.map((b) => b.x + b.width)) - left,
		height: Math.max(...boxes.map((b) => b.y + b.height)) - top
	};
}
