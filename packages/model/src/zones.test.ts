import { expect, it } from 'vitest';
import type { DiagramNode } from './project.ts';
import { zoneContent, zoneParents } from './zones.ts';

const component = (id: string, x: number, y: number): DiagramNode => ({
	id,
	type: 'component',
	x,
	y
});
const zone = (id: string, x: number, y: number, width: number, height: number): DiagramNode => ({
	id,
	type: 'zone',
	x,
	y,
	width,
	height
});
const size = () => ({ width: 100, height: 50 });

it('puts each node in the innermost Zone that wholly holds it', () => {
	const nodes = [
		zone('region', 0, 0, 1000, 600),
		zone('vpc', 50, 50, 600, 400),
		component('api', 100, 100),
		component('cdn', 700, 100),
		// Partly outside the VPC: in the region only.
		component('edge', 600, 300),
		component('outside', 1200, 0)
	];
	const parents = zoneParents(nodes, size);
	expect(Object.fromEntries(parents)).toEqual({
		vpc: 'region',
		api: 'vpc',
		cdn: 'region',
		edge: 'region'
	});
	expect(zoneContent(parents, 'region').sort()).toEqual(['api', 'cdn', 'edge', 'vpc']);
	expect(zoneContent(parents, 'vpc')).toEqual(['api']);
});

it('nests two Zones with the same box by id, never in themselves', () => {
	const parents = zoneParents(
		[zone('b', 0, 0, 300, 200), zone('a', 0, 0, 300, 200), component('x', 10, 10)],
		size
	);
	expect(Object.fromEntries(parents)).toEqual({ b: 'a', x: 'b' });
});
