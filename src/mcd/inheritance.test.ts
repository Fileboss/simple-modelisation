import type { Edge, Node } from '@xyflow/react';
import { describe, expect, it } from 'vitest';
import { withGeneralizations, withInheritanceLines } from './inheritance';

const node = (id: string, type: string, data: Record<string, unknown> = {}): Node => ({
	id,
	type,
	position: { x: 0, y: 0 },
	data: { id, type, ...data }
});
const isa = (id: string, target: string): Edge => ({ id, type: 'isa', source: 'inh', target });

const nodes = [
	node('person', 'entity'),
	node('student', 'entity'),
	node('teacher', 'entity'),
	node('inh', 'inheritance', { parent: 'person', constraint: 'XT' })
];
const edges = [isa('e1', 'student'), isa('e2', 'teacher')];

describe('Inheritance drawing', () => {
	it('adds the line up to the parent in Merise, not selectable', () => {
		const laid = withInheritanceLines(nodes, edges);
		expect(laid.edges.slice(2)).toMatchObject([
			{ id: 'parent:inh', source: 'inh', target: 'person', selectable: false, deletable: false }
		]);
	});

	it('turns the children into UML generalisations, the constraint on the first', () => {
		const laid = withGeneralizations(nodes, edges);
		expect(laid.edges.map((e) => [e.type, e.source, e.target, e.data?.constraint])).toEqual([
			['generalization', 'student', 'person', '{disjoint, complete}'],
			['generalization', 'teacher', 'person', undefined]
		]);
		expect(laid.nodes.find((n) => n.id === 'inh')).toMatchObject({
			hidden: true,
			selectable: false
		});
	});
});
