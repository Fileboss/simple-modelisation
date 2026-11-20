import type { Edge, Node } from '@xyflow/react';
import { describe, expect, it } from 'vitest';
import { dataType } from '@simple-modelisation/model/data-types.ts';
import { umlAttribute, umlLayout, umlMultiplicity } from './notation';

describe('UML notation', () => {
	it('turns Cardinalities into multiplicities', () => {
		expect(['0,1', '1,1', '0,n', '1,n'].map((c) => umlMultiplicity(c as never))).toEqual([
			'0..1',
			'1',
			'0..*',
			'1..*'
		]);
	});

	it('writes Attributes as name : Type with {id} and [0..1]', () => {
		const attribute = {
			id: 'a',
			name: 'id',
			identifier: true,
			type: dataType('serial'),
			optional: false
		};
		expect(umlAttribute(attribute)).toBe('id : Auto-increment {id}');
		expect(
			umlAttribute({
				...attribute,
				name: 'email',
				identifier: false,
				type: { kind: 'varchar', length: 120 },
				optional: true
			})
		).toBe('email : Text(120) [0..1]');
		expect(
			umlAttribute({ ...attribute, name: 'total', identifier: false, type: dataType('decimal') })
		).toBe('total : Decimal(10,2)');
	});

	const node = (
		id: string,
		type: string,
		x: number,
		y: number,
		width = 100,
		height = 50
	): Node => ({
		id,
		type,
		position: { x, y },
		measured: { width, height },
		data: {}
	});
	const leg = (id: string, source: string, target: string, cardinality: string): Edge => ({
		id,
		type: 'leg',
		source,
		target,
		data: { cardinality }
	});

	it('puts the label of an Association between its classes and gives each Leg its peer', () => {
		const { nodes, edges } = umlLayout(
			[
				node('customer', 'entity', 0, 0),
				node('order', 'entity', 400, 200),
				node('places', 'association', 900, 900, 60, 20)
			],
			[leg('l1', 'places', 'customer', '0,n'), leg('l2', 'places', 'order', '1,1')]
		);
		// Centers (50, 25) and (450, 225): midpoint (250, 125), minus half the label.
		expect(nodes[2]).toMatchObject({
			position: { x: 220, y: 115 },
			draggable: false,
			data: { umlSide: 'top' }
		});
		expect(edges.map((e) => (e.data as { peer: unknown }).peer)).toEqual([
			{ id: 'l2', cardinality: '1,1' },
			{ id: 'l1', cardinality: '0,n' }
		]);
	});

	it('marks a composition on the Leg to the Entity another is relative to', () => {
		const relative = {
			...leg('l1', 'of', 'line', '1,1'),
			data: { cardinality: '1,1', relative: true }
		};
		const { edges } = umlLayout(
			[
				node('line', 'entity', 0, 0),
				node('order', 'entity', 400, 0),
				node('of', 'association', 0, 0)
			],
			[relative, leg('l2', 'of', 'order', '0,n')]
		);
		expect(edges.map((e) => (e.data as { composition?: boolean }).composition)).toEqual([
			undefined,
			true
		]);
	});

	it('puts the label of a reflexive Association beside its class', () => {
		const { nodes } = umlLayout(
			[node('employee', 'entity', 0, 0), node('manages', 'association', 500, 500, 60, 20)],
			[leg('l1', 'manages', 'employee', '0,n'), leg('l2', 'manages', 'employee', '0,1')]
		);
		// The label starts 70 px right of the class (which ends at x 100), centred on its height.
		expect(nodes[1].position).toEqual({ x: 170, y: 15 });
	});

	it('leaves an N-ary Association where it is stored, as a diamond, each Leg showing its own multiplicity', () => {
		const stored = node('teaches', 'association', 300, 300, 44, 44);
		const { nodes, edges } = umlLayout(
			[
				node('teacher', 'entity', 0, 0),
				node('room', 'entity', 600, 0),
				node('slot', 'entity', 300, 600),
				stored
			],
			[
				leg('l1', 'teaches', 'teacher', '0,n'),
				leg('l2', 'teaches', 'room', '1,n'),
				leg('l3', 'teaches', 'slot', '0,1')
			]
		);
		expect(nodes[3].position).toEqual({ x: 300, y: 300 });
		expect(nodes[3].draggable).toBeUndefined();
		// Teacher and Room are above the diamond: its association class goes to the right.
		expect(nodes[3].data).toEqual({ umlNary: true, umlSide: 'right' });
		expect(edges.map((e) => (e.data as { peer: unknown }).peer)).toEqual([
			{ id: 'l1', cardinality: '0,n' },
			{ id: 'l2', cardinality: '1,n' },
			{ id: 'l3', cardinality: '0,1' }
		]);
	});
});
