import type { Edge } from '@xyflow/react';
import type { InheritanceNode } from '@simple-modelisation/model/project.ts';
import { generalizations } from '@simple-modelisation/model/mcd-drawing.ts';
import { diagramEdges, diagramNodes, type Layout } from '../canvas/layout';

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
	const drawn = generalizations(diagramNodes(nodes), diagramEdges(edges));
	const replaced = new Set(drawn.map((g) => g.isa));
	return {
		nodes: nodes.map((node) =>
			node.type === 'inheritance'
				? { ...node, hidden: true, selectable: false, deletable: false, selected: false }
				: node
		),
		edges: [
			...edges.filter((e) => !replaced.has(e.id)),
			...drawn.map((g): Edge => ({
				id: `generalization:${g.isa}`,
				type: 'generalization',
				source: g.child,
				target: g.parent,
				selectable: false,
				deletable: false,
				focusable: false,
				data: { constraint: g.constraint } satisfies Generalization
			}))
		]
	};
};
