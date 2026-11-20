import type { Edge } from '@xyflow/react';
import type { CifNode } from '@simple-modelisation/model/project.ts';
import type { Layout } from '../canvas/layout';

/** Set on the line from a CIF to an Entity: an arrow when that Entity is the determined one. */
export type CifLink = { determined: boolean };

/** Set on an N-ary Association in UML: its CIFs written as constraints, `{a, b → c}`. */
export type UmlConstraints = { umlConstraints?: { id: string; text: string }[] };

/** A CIF's Legs that are still its Association's, read as the Entities they join. */
function cifEnds(cif: CifNode, legs: Map<string, Edge>) {
	const entityOf = (legId: string) => {
		const leg = legs.get(legId);
		return leg && leg.source === cif.association ? leg.target : undefined;
	};
	return {
		determinants: cif.determinants.map(entityOf).filter((e): e is string => e !== undefined),
		determined: entityOf(cif.determined)
	};
}

const legsById = (edges: Edge[]) =>
	new Map(edges.filter((e) => e.type === 'leg').map((e) => [e.id, e]));

/**
 * Merise: a line from each CIF to the Entities of its determinant Legs and an
 * arrow to the determined one. Drawn, not stored: neither selectable nor deletable.
 */
export const withCifLinks: Layout = (nodes, edges) => {
	const legs = legsById(edges);
	const links: Edge[] = [];
	for (const node of nodes) {
		if (node.type !== 'cif') continue;
		const { determinants, determined } = cifEnds(node.data as CifNode, legs);
		const ends = [
			...determinants.map((entity) => ({ entity, determined: false })),
			...(determined ? [{ entity: determined, determined: true }] : [])
		];
		ends.forEach(({ entity, determined }, i) =>
			links.push({
				id: `cif:${node.id}:${i}`,
				type: 'cifLink',
				source: node.id,
				target: entity,
				selectable: false,
				deletable: false,
				focusable: false,
				data: { determined } satisfies CifLink
			})
		);
	}
	return { nodes, edges: [...edges, ...links] };
};

/**
 * UML has no symbol for a CIF: each one is written under its Association's
 * diamond as a constraint, and the CIF itself is not drawn.
 */
export const withCifConstraints: Layout = (nodes, edges) => {
	const legs = legsById(edges);
	const names = new Map(nodes.map((n) => [n.id, String((n.data as { name?: string }).name ?? '')]));
	const constraints = new Map<string, { id: string; text: string }[]>();
	for (const node of nodes) {
		if (node.type !== 'cif') continue;
		const cif = node.data as CifNode;
		const { determinants, determined } = cifEnds(cif, legs);
		if (!determined || determinants.length === 0) continue;
		const text = `{${determinants.map((e) => names.get(e)).join(', ')} → ${names.get(determined)}}`;
		constraints.set(cif.association, [
			...(constraints.get(cif.association) ?? []),
			{ id: node.id, text }
		]);
	}
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
