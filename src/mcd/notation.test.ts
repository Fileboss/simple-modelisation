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

	it('puts the label of a reflexive Association beside its class', () => {
		const { nodes } = umlLayout(
			[node('employee', 'entity', 0, 0), node('manages', 'association', 500, 500, 60, 20)],
			[leg('l1', 'manages', 'employee', '0,n'), leg('l2', 'manages', 'employee', '0,1')]
		);
		// The label starts 70 px right of the class (which ends at x 100), centred on its height.
		expect(nodes[1].position).toEqual({ x: 170, y: 15 });
	});
});
