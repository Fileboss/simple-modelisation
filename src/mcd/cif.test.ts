import type { Edge, Node } from '@xyflow/react';
import { describe, expect, it } from 'vitest';
import { withCifConstraints, withCifLinks } from './cif';

const node = (id: string, type: string, data: Record<string, unknown>): Node => ({
	id,
	type,
	position: { x: 0, y: 0 },
	data: { id, type, ...data }
});
const leg = (id: string, target: string): Edge => ({
	id,
	type: 'leg',
	source: 'teaches',
	target,
	data: { cardinality: '0,n' }
});

const nodes = [
	node('teacher', 'entity', { name: 'Teacher' }),
	node('class', 'entity', { name: 'Class' }),
	node('subject', 'entity', { name: 'Subject' }),
	node('teaches', 'association', { name: 'teaches' }),
	node('cif', 'cif', { association: 'teaches', determinants: ['l2', 'l3'], determined: 'l1' })
];
const edges = [leg('l1', 'teacher'), leg('l2', 'class'), leg('l3', 'subject')];

describe('CIF drawing', () => {
	it('draws a line to each determinant Entity and an arrow to the determined one in Merise', () => {
		const links = withCifLinks(nodes, edges).edges.filter((e) => e.type === 'cifLink');
		expect(
			links.map((e) => [e.source, e.target, (e.data as { determined: boolean }).determined])
		).toEqual([
			['cif', 'class', false],
			['cif', 'subject', false],
			['cif', 'teacher', true]
		]);
		expect(links.every((e) => e.selectable === false && e.deletable === false)).toBe(true);
	});

	it('skips a Leg that is no longer its Association’s', () => {
		const links = withCifLinks(nodes, edges.slice(1)).edges.filter((e) => e.type === 'cifLink');
		expect(links.map((e) => e.target)).toEqual(['class', 'subject']);
	});

	it('writes the CIF as a constraint under the diamond in UML, and hides it', () => {
		const laid = withCifConstraints(nodes, edges);
		expect(laid.nodes.find((n) => n.id === 'teaches')?.data).toMatchObject({
			umlConstraints: [{ id: 'cif', text: '{Class, Subject → Teacher}' }]
		});
		expect(laid.nodes.find((n) => n.id === 'cif')).toMatchObject({
			hidden: true,
			selectable: false,
			deletable: false
		});
		expect(laid.edges).toBe(edges);
	});
});
