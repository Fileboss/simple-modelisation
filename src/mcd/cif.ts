import type { Edge } from '@xyflow/react';
import { cifConstraints, cifLinks } from '@simple-modelisation/model/mcd-drawing.ts';
import { diagramEdges, diagramNodes, type Layout } from '../canvas/layout';

/** Set on the line from a CIF to an Entity: an arrow when that Entity is the determined one. */
export type CifLink = { determined: boolean };

/** Set on an N-ary Association in UML: its CIFs written as constraints, `{a, b → c}`. */
export type UmlConstraints = { umlConstraints?: { id: string; text: string }[] };

/**
 * Merise: a line from each CIF to the Entities of its determinant Legs and an
 * arrow to the determined one. Drawn, not stored: neither selectable nor deletable.
 */
export const withCifLinks: Layout = (nodes, edges) => {
	const counts = new Map<string, number>();
	const links = cifLinks(diagramNodes(nodes), diagramEdges(edges)).map((link): Edge => {
		const i = counts.get(link.cif) ?? 0;
		counts.set(link.cif, i + 1);
		return {
			id: `cif:${link.cif}:${i}`,
			type: 'cifLink',
			source: link.cif,
			target: link.entity,
			selectable: false,
			deletable: false,
			focusable: false,
			data: { determined: link.determined } satisfies CifLink
		};
	});
	return { nodes, edges: [...edges, ...links] };
};

/**
 * UML has no symbol for a CIF: each one is written under its Association's
 * diamond as a constraint, and the CIF itself is not drawn.
 */
export const withCifConstraints: Layout = (nodes, edges) => {
	const constraints = cifConstraints(diagramNodes(nodes), diagramEdges(edges));
	return {
		nodes: nodes.map((node) => {
			// Not drawn, so not to be selected (Cmd+A) or deleted unseen either.
			if (node.type === 'cif') {
				return { ...node, hidden: true, selectable: false, deletable: false, selected: false };
			}
			const umlConstraints = constraints.get(node.id);
			return umlConstraints ? { ...node, data: { ...node.data, umlConstraints } } : node;
		}),
		edges
	};
};
