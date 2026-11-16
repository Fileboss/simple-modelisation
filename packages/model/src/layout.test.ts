import { describe, expect, it } from 'vitest';
import { estimatedSize, layoutDiagram } from './layout.ts';
import { ProjectDocument } from './project.ts';

const overlapping = (
	positions: Map<string, { x: number; y: number }>,
	size: (id: string) => { width: number; height: number }
) => {
	const boxes = [...positions].map(([id, p]) => ({ ...p, ...size(id) }));
	return boxes.some((a, i) =>
		boxes.some(
			(b, j) =>
				i < j &&
				a.x < b.x + b.width &&
				b.x < a.x + a.width &&
				a.y < b.y + b.height &&
				b.y < a.y + a.height
		)
	);
};

describe('arrange', () => {
	it('moves the nodes in one undo step', () => {
		const project = new ProjectDocument();
		const d = project.addDiagram('system');
		const a = project.addComponent(d, 'service', 'A', 0, 0);
		const b = project.addComponent(d, 'service', 'B', 0, 0);
		project.arrange(
			d,
			new Map([
				[a, { x: 10, y: 20 }],
				[b, { x: 300, y: 20 }]
			])
		);
		expect(project.nodes(d).map((n) => [n.x, n.y])).toEqual([
			[10, 20],
			[300, 20]
		]);
		project.undo();
		expect(project.nodes(d).map((n) => [n.x, n.y])).toEqual([
			[0, 0],
			[0, 0]
		]);
	});
});

describe('layoutDiagram', () => {
	it('lays a System design flow out from left to right, without overlap', () => {
		const project = new ProjectDocument();
		const d = project.addDiagram('system');
		const web = project.addComponent(d, 'client', 'Web', 500, 500);
		const api = project.addComponent(d, 'gateway', 'API', 500, 500);
		const users = project.addComponent(d, 'service', 'Users', 500, 500);
		const tweets = project.addComponent(d, 'service', 'Tweets', 500, 500);
		const db = project.addComponent(d, 'database', 'DB', 500, 500);
		for (const [a, b] of [
			[web, api],
			[api, users],
			[api, tweets],
			[users, db],
			[tweets, db]
		]) {
			project.addConnection(d, a, b);
		}
		const nodes = project.nodes(d);
		const { positions } = layoutDiagram(nodes, project.edges(d), estimatedSize);
		const x = (id: string) => positions.get(id)!.x;
		expect(x(web) < x(api) && x(api) < x(users) && x(users) < x(db)).toBe(true);
		expect(x(users)).toBe(x(tweets));
		const sizeOf = (id: string) => estimatedSize(nodes.find((n) => n.id === id)!);
		expect(overlapping(positions, sizeOf)).toBe(false);
	});

	it('puts each Association between its two Entities in an MCD', () => {
		const project = new ProjectDocument();
		const d = project.addDiagram('mcd');
		const customer = project.addEntity(d, 0, 0, 'Customer');
		const order = project.addEntity(d, 0, 0, 'Order');
		const places = project.addAssociation(d, customer, order, 'places');
		const { positions } = layoutDiagram(project.nodes(d), project.edges(d), estimatedSize);
		const x = (id: string) => positions.get(id)!.x;
		// Which Entity goes left follows the ids (deterministic); the Association sits between.
		const [left, right] = [x(customer), x(order)].sort((a, b) => a - b);
		expect(left < x(places) && x(places) < right).toBe(true);
	});
});

describe('layoutDiagram, more cases', () => {
	it('gives the same layout whatever the order the elements arrive in', () => {
		const project = new ProjectDocument();
		const d = project.addDiagram('mcd');
		const a = project.addEntity(d, 0, 0, 'A');
		const b = project.addEntity(d, 0, 0, 'B');
		const c = project.addEntity(d, 0, 0, 'C');
		project.addAssociation(d, a, b, 'ab');
		project.addAssociation(d, b, c, 'bc');
		const nodes = project.nodes(d);
		const edges = project.edges(d);
		const forward = layoutDiagram(nodes, edges, estimatedSize);
		const backward = layoutDiagram([...nodes].reverse(), [...edges].reverse(), estimatedSize);
		expect([...backward.positions].sort()).toEqual([...forward.positions].sort());
		expect([...backward.routes].sort()).toEqual([...forward.routes].sort());
	});

	it('puts elements without links on a grid underneath, not in one column', () => {
		const project = new ProjectDocument();
		const d = project.addDiagram('mcd');
		for (let i = 0; i < 12; i++) project.addEntity(d, 0, 0, `E${i}`);
		const positions = [
			...layoutDiagram(project.nodes(d), project.edges(d), estimatedSize).positions.values()
		];
		expect(new Set(positions.map((p) => p.y)).size).toBe(3);
	});
});

describe('arrange, unchanged positions', () => {
	it('writes nothing and adds no undo step when everything is in place', () => {
		const project = new ProjectDocument();
		const d = project.addDiagram('system');
		const a = project.addComponent(d, 'service', 'A', 10, 20);
		project.stopCapturing();
		project.renameNode(d, a, 'B');
		let updates = 0;
		project.subscribe(() => updates++);
		project.arrange(d, new Map([[a, { x: 10, y: 20 }]]));
		expect(updates).toBe(0);
		project.undo();
		expect(project.nodes(d)[0].name).toBe('A');
	});
});

describe('routes', () => {
	it('stores routes with a Tidy up and drops them when an end moves', () => {
		const project = new ProjectDocument();
		const d = project.addDiagram('system');
		const a = project.addComponent(d, 'service', 'A', 0, 0);
		const b = project.addComponent(d, 'database', 'B', 0, 0);
		const link = project.addConnection(d, a, b)!;
		const { positions, routes } = layoutDiagram(project.nodes(d), project.edges(d), estimatedSize);
		project.arrange(d, positions, routes);
		expect(project.edges(d)[0].points).toEqual(routes.get(link));
		project.moveNode(d, b, 900, 900);
		expect(project.edges(d)[0].points).toBeUndefined();
	});
});

describe('layoutDiagram, Clients', () => {
	it('keeps Clients first when a Connection goes back to them', () => {
		const project = new ProjectDocument();
		const d = project.addDiagram('system');
		const web = project.addComponent(d, 'client', 'Web', 0, 0);
		const api = project.addComponent(d, 'gateway', 'API', 0, 0);
		const notify = project.addComponent(d, 'service', 'Notify', 0, 0);
		project.addConnection(d, web, api);
		project.addConnection(d, api, notify);
		const push = project.addConnection(d, notify, web)!;
		const { positions, routes } = layoutDiagram(project.nodes(d), project.edges(d), estimatedSize);
		const x = (id: string) => positions.get(id)!.x;
		expect(x(web) < x(api) && x(api) < x(notify)).toBe(true);
		// The push is still drawn from Notify to Web.
		const route = routes.get(push) ?? [];
		if (route.length > 1) expect(route[0].x > route.at(-1)!.x).toBe(true);
	});
});
