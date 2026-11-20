import type { Edge } from '@xyflow/react';
import type { InheritanceConstraint, InheritanceNode } from '@simple-modelisation/model/project.ts';
import type { Layout } from '../canvas/layout';

/** UML's words for an Inheritance's constraint, beside the generalisation's triangle. */
export const UML_CONSTRAINTS: Record<Exclude<InheritanceConstraint, 'none'>, string> = {
	X: '{disjoint}',
	T: '{complete}',
	XT: '{disjoint, complete}'
};

/** Set on a generalisation: the constraint it shows, on one line per parent. */
export type Generalization = { constraint?: string };

/**
 * Merise: the line from each Inheritance up to its parent, drawn, not stored:
 * neither selectable nor deletable. The lines to the children are its stored
 * `isa` edges.
 */
export const withInheritanceLines: Layout = (nodes, edges) => {
	const lines: Edge[] = nodes
		.filter((n) => n.type === 'inheritance')
		.map((n) => ({
			id: `parent:${n.id}`,
			type: 'isa',
			source: n.id,
			target: (n.data as InheritanceNode).parent,
			selectable: false,
			deletable: false,
			focusable: false
		}));
	return { nodes, edges: [...edges, ...lines] };
};

/**
 * UML: no triangle node; each child joined to its parent by a generalisation,
 * a hollow triangle at the parent, the constraint written on the first one.
 */
export const withGeneralizations: Layout = (nodes, edges) => {
	const inheritances = new Map(
		nodes.filter((n) => n.type === 'inheritance').map((n) => [n.id, n.data as InheritanceNode])
	);
	const labelled = new Set<string>();
	const generalizations: Edge[] = [];
	const kept = edges.filter((edge) => {
		const inheritance = edge.type === 'isa' ? inheritances.get(edge.source) : undefined;
		if (!inheritance) return true;
		const first = !labelled.has(inheritance.id);
		labelled.add(inheritance.id);
		generalizations.push({
			id: `generalization:${edge.id}`,
			type: 'generalization',
			source: edge.target,
			target: inheritance.parent,
			selectable: false,
			deletable: false,
			focusable: false,
			data: {
				constraint:
					first && inheritance.constraint ? UML_CONSTRAINTS[inheritance.constraint] : undefined
			} satisfies Generalization
		});
		return false;
	});
	return {
		nodes: nodes.map((node) =>
			node.type === 'inheritance'
				? { ...node, hidden: true, selectable: false, deletable: false, selected: false }
				: node
		),
		edges: [...kept, ...generalizations]
	};
};
