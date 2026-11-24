import { describe, expect, it } from 'vitest';
import {
	estimatedSize,
	layoutDiagram,
	layoutFingerprint,
	NOTE_WIDTH,
	noteLines,
	noteSize,
	noteWidth
} from './layout.ts';
import { CIF_OFFSET, NOTE_WIDTHS, ProjectDocument } from './project.ts';

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
	it('moves the nodes in one undo step', async () => {
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
	it('lays a System design flow out from left to right, without overlap', async () => {
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
		const { positions } = await layoutDiagram(
			nodes,
			project.edges(d),
			estimatedSize,
			project.diagram(d)!.kind
		);
		const x = (id: string) => positions.get(id)!.x;
		expect(x(web) < x(api) && x(api) < x(users) && x(users) < x(db)).toBe(true);
		expect(x(users)).toBe(x(tweets));
		const sizeOf = (id: string) => estimatedSize(nodes.find((n) => n.id === id)!);
		expect(overlapping(positions, sizeOf)).toBe(false);
	});

	it('widens only the gap a long Connection label crosses, enough for its pill', async () => {
		const project = new ProjectDocument();
		const d = project.addDiagram('system');
		const app = project.addComponent(d, 'service', 'platform', 0, 0);
		const images = project.addComponent(d, 'service', 'getImage', 0, 0);
		const store = project.addComponent(d, 'storage', 'bucket', 0, 0);
		const c = project.addConnection(d, app, images)!;
		project.addConnection(d, images, store);
		const gaps = async () => {
			const nodes = project.nodes(d);
			const { positions } = await layoutDiagram(nodes, project.edges(d), estimatedSize, 'system');
			const right = (id: string) =>
				positions.get(id)!.x + estimatedSize(nodes.find((n) => n.id === id)!).width;
			return [positions.get(images)!.x - right(app), positions.get(store)!.x - right(images)];
		};
		const [plain, other] = await gaps();
		project.setEdgeLabel(d, c, 'REST, nightly, with retries');
		project.setConnectionFlow(d, c, 'read');
		const [labelled, untouched] = await gaps();
		// "Read · REST, nightly, with retries" at 6.5px a character, in its 14px pill.
		expect(labelled).toBeGreaterThanOrEqual(34 * 6.5 + 14);
		expect(labelled).toBeGreaterThan(plain);
		expect(untouched).toBe(other);
	});

	it('puts each Association between its two Entities in an MCD', async () => {
		const project = new ProjectDocument();
		const d = project.addDiagram('mcd');
		const customer = project.addEntity(d, 0, 0, 'Customer');
		const order = project.addEntity(d, 0, 0, 'Order');
		const places = project.addAssociation(d, customer, order, 'places');
		const { positions } = await layoutDiagram(
			project.nodes(d),
			project.edges(d),
			estimatedSize,
			project.diagram(d)!.kind
		);
		const x = (id: string) => positions.get(id)!.x;
		// Which Entity goes left follows the ids (deterministic); the Association sits between.
		const [left, right] = [x(customer), x(order)].sort((a, b) => a - b);
		expect(left < x(places) && x(places) < right).toBe(true);
	});
});

describe('layoutDiagram, more cases', () => {
	it('gives the same layout whatever the order the elements arrive in', async () => {
		const project = new ProjectDocument();
		const d = project.addDiagram('mcd');
		const a = project.addEntity(d, 0, 0, 'A');
		const b = project.addEntity(d, 0, 0, 'B');
		const c = project.addEntity(d, 0, 0, 'C');
		project.addAssociation(d, a, b, 'ab');
		project.addAssociation(d, b, c, 'bc');
		const nodes = project.nodes(d);
		const edges = project.edges(d);
		const forward = await layoutDiagram(nodes, edges, estimatedSize, project.diagram(d)!.kind);
		const backward = await layoutDiagram(
			[...nodes].reverse(),
			[...edges].reverse(),
			estimatedSize,
			project.diagram(d)!.kind
		);
		expect([...backward.positions].sort()).toEqual([...forward.positions].sort());
		expect([...backward.routes].sort()).toEqual([...forward.routes].sort());
	});

	it('puts elements without links on a grid underneath, not in one column', async () => {
		const project = new ProjectDocument();
		const d = project.addDiagram('mcd');
		for (let i = 0; i < 12; i++) project.addEntity(d, 0, 0, `E${i}`);
		const positions = [
			...(
				await layoutDiagram(
					project.nodes(d),
					project.edges(d),
					estimatedSize,
					project.diagram(d)!.kind
				)
			).positions.values()
		];
		expect(new Set(positions.map((p) => p.y)).size).toBe(3);
	});
});

describe('arrange, unchanged positions', () => {
	it('writes nothing and adds no undo step when everything is in place', async () => {
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
	it('stores routes with a Tidy up and drops them when an end moves', async () => {
		const project = new ProjectDocument();
		const d = project.addDiagram('system');
		const a = project.addComponent(d, 'service', 'A', 0, 0);
		const b = project.addComponent(d, 'database', 'B', 0, 0);
		const link = project.addConnection(d, a, b)!;
		const { positions, routes } = await layoutDiagram(
			project.nodes(d),
			project.edges(d),
			estimatedSize,
			'system'
		);
		project.arrange(d, positions, routes);
		expect(project.edges(d)[0].points).toEqual(routes.get(link));
		project.moveNode(d, b, 900, 900);
		expect(project.edges(d)[0].points).toBeUndefined();
	});
});

describe('layoutDiagram, right angles', () => {
	it('routes System design Connections with horizontal and vertical segments only', async () => {
		const project = new ProjectDocument();
		const d = project.addDiagram('system');
		const api = project.addComponent(d, 'gateway', 'API', 0, 0);
		const ids = ['A', 'B', 'C'].map((name) => project.addComponent(d, 'service', name, 0, 0));
		for (const id of ids) project.addConnection(d, api, id);
		const { positions, routes } = await layoutDiagram(
			project.nodes(d),
			project.edges(d),
			estimatedSize,
			project.diagram(d)!.kind
		);
		for (const bends of routes.values()) {
			for (let i = 1; i < bends.length; i++) {
				const [a, b] = [bends[i - 1], bends[i]];
				expect(a.x === b.x || a.y === b.y).toBe(true);
			}
		}
		expect(routes.size).toBe(3);
		// The first and last bends are level with their boxes, so the end segments are straight.
		for (const edge of project.edges(d)) {
			const bends = routes.get(edge.id)!;
			const level = (id: string, y: number) => {
				const top = positions.get(id)!.y;
				return (
					y >= top && y <= top + estimatedSize(project.nodes(d).find((n) => n.id === id)!).height
				);
			};
			expect(level(edge.source, bends[0].y) && level(edge.target, bends.at(-1)!.y)).toBe(true);
		}
	});
});

describe('layoutDiagram, Clients', () => {
	it('keeps Clients first when a Connection goes back to them', async () => {
		const project = new ProjectDocument();
		const d = project.addDiagram('system');
		const web = project.addComponent(d, 'client', 'Web', 0, 0);
		const api = project.addComponent(d, 'gateway', 'API', 0, 0);
		const notify = project.addComponent(d, 'service', 'Notify', 0, 0);
		project.addConnection(d, web, api);
		project.addConnection(d, api, notify);
		const push = project.addConnection(d, notify, web)!;
		const { positions, routes } = await layoutDiagram(
			project.nodes(d),
			project.edges(d),
			estimatedSize,
			'system'
		);
		const x = (id: string) => positions.get(id)!.x;
		expect(x(web) < x(api) && x(api) < x(notify)).toBe(true);
		// The push is still drawn from Notify to Web.
		const route = routes.get(push) ?? [];
		if (route.length > 1) expect(route[0].x > route.at(-1)!.x).toBe(true);
	});
});

describe('layoutDiagram, two-way Connections', () => {
	it("cuts a Note's text into lines at words, breaking only a word too long", () => {
		expect(noteLines('Syncs every night at 2 a.m. from KDP')).toEqual([
			'Syncs every night at 2',
			'a.m. from KDP'
		]);
		expect(noteLines('a\n\nb')).toEqual(['a', '', 'b']);
		expect(noteLines('x'.repeat(30))).toEqual(['x'.repeat(22), 'x'.repeat(8)]);
	});

	it('keeps a Note beside the element it explains, on the same side, overlapping nothing', async () => {
		const project = new ProjectDocument();
		const d = project.addDiagram('system');
		const a = project.addComponent(d, 'service', 'A', 500, 500);
		const b = project.addComponent(d, 'database', 'B', 900, 500);
		project.addConnection(d, a, b);
		// Under A, 20px below it.
		const size = estimatedSize(project.nodes(d).find((n) => n.id === a)!);
		const note = project.addNote(d, 500, 500 + size.height + 20, 'Nightly');
		const { positions } = await layoutDiagram(
			project.nodes(d),
			project.edges(d),
			estimatedSize,
			'system'
		);
		const placed = positions.get(note)!;
		const at = positions.get(a)!;
		expect(placed).toEqual({ x: at.x, y: at.y + size.height + 20 });
		const nodes = new Map(project.nodes(d).map((n) => [n.id, n]));
		expect(overlapping(positions, (id) => estimatedSize(nodes.get(id)!))).toBe(false);
	});

	it('puts a Note far from every element with the unlinked elements, under the rest', async () => {
		const project = new ProjectDocument();
		const d = project.addDiagram('system');
		const a = project.addComponent(d, 'service', 'A', 0, 0);
		const b = project.addComponent(d, 'database', 'B', 400, 0);
		project.addConnection(d, a, b);
		const note = project.addNote(d, 2000, 2000, 'Far away');
		const { positions } = await layoutDiagram(
			project.nodes(d),
			project.edges(d),
			estimatedSize,
			'system'
		);
		expect(positions.get(note)!.y).toBeGreaterThan(positions.get(a)!.y);
		expect(positions.get(note)!.x).toBe(0);
	});

	it('keeps a Note in a Zone beside its element, the Zone growing to hold it', async () => {
		const project = new ProjectDocument();
		const d = project.addDiagram('system');
		const zone = project.addZone(d, 0, 0, 900, 400, 'VPC');
		const api = project.addComponent(d, 'service', 'API', 40, 60);
		const db = project.addComponent(d, 'database', 'DB', 400, 60);
		project.addConnection(d, api, db);
		const dbSize = estimatedSize(project.nodes(d).find((n) => n.id === db)!);
		// Right of DB, 30px away.
		const note = project.addNote(d, 400 + dbSize.width + 30, 60, 'Nightly backups');
		const { positions, zoneSizes } = await layoutDiagram(
			project.nodes(d),
			project.edges(d),
			estimatedSize,
			'system'
		);
		const placed = positions.get(note)!;
		expect(placed.x).toBe(positions.get(db)!.x + dbSize.width + 30);
		const box = { ...positions.get(zone)!, ...zoneSizes.get(zone)! };
		const noteSize = estimatedSize(project.nodes(d).find((n) => n.id === note)!);
		expect(placed.x + noteSize.width).toBeLessThanOrEqual(box.x + box.width);
		expect(placed.y + noteSize.height).toBeLessThanOrEqual(box.y + box.height);
	});

	it('puts Persons first, before the Clients they use, even when a Connection goes back to them', async () => {
		const project = new ProjectDocument();
		const d = project.addDiagram('system');
		const app = project.addComponent(d, 'client', 'App', 0, 0);
		const api = project.addComponent(d, 'service', 'API', 0, 0);
		const buyer = project.addComponent(d, 'person', 'Buyer', 0, 0);
		project.addConnection(d, app, api);
		// The app notifies its user: a Connection towards the Person.
		project.addConnection(d, app, buyer);
		const { positions } = await layoutDiagram(
			project.nodes(d),
			project.edges(d),
			estimatedSize,
			'system'
		);
		const x = (id: string) => positions.get(id)!.x;
		expect(x(buyer) < x(app) && x(app) < x(api)).toBe(true);
	});

	it('routes A → B and B → A along one line, in opposite directions', async () => {
		const project = new ProjectDocument();
		const d = project.addDiagram('system');
		const api = project.addComponent(d, 'service', 'API', 0, 0);
		const auth = project.addComponent(d, 'service', 'Auth', 0, 0);
		const db = project.addComponent(d, 'database', 'DB', 0, 0);
		const forth = project.addConnection(d, api, auth)!;
		const back = project.addConnection(d, auth, api)!;
		project.addConnection(d, auth, db);
		const { routes } = await layoutDiagram(
			project.nodes(d),
			project.edges(d),
			estimatedSize,
			'system'
		);
		expect(routes.get(back)).toEqual([...routes.get(forth)!].reverse());
	});
});

describe('layoutDiagram, two-way Connections in the flow', () => {
	it('ranks a two-way pair the way the flow goes, whatever its ids', async () => {
		const project = new ProjectDocument();
		const d = project.addDiagram('system');
		const web = project.addComponent(d, 'client', 'Web', 0, 0);
		const api = project.addComponent(d, 'gateway', 'API', 0, 0);
		const auth = project.addComponent(d, 'service', 'Auth', 0, 0);
		const db = project.addComponent(d, 'database', 'DB', 0, 0);
		// The backward Connections first, so their ids would come first.
		const back = project.addConnection(d, auth, api)!;
		project.addConnection(d, db, auth);
		project.addConnection(d, web, api);
		const forth = project.addConnection(d, api, auth)!;
		project.addConnection(d, auth, db);
		const { positions, routes } = await layoutDiagram(
			project.nodes(d),
			project.edges(d),
			estimatedSize,
			'system'
		);
		const x = (id: string) => positions.get(id)!.x;
		expect(x(web) < x(api) && x(api) < x(auth) && x(auth) < x(db)).toBe(true);
		expect(routes.get(back)).toEqual([...routes.get(forth)!].reverse());
	});
});

describe('layoutDiagram, loops', () => {
	it('keeps a Connection from a Component to itself in the layout', async () => {
		const project = new ProjectDocument();
		const d = project.addDiagram('system');
		const a = project.addComponent(d, 'service', 'A', 0, 0);
		const b = project.addComponent(d, 'service', 'B', 0, 0);
		project.addConnection(d, a, b);
		// The app refuses a loop; an imported file may still hold one.
		const loop = { id: 'loop', type: 'connection', source: a, target: a, label: '' };
		const { routes } = await layoutDiagram(
			project.nodes(d),
			[...project.edges(d), loop],
			estimatedSize,
			'system'
		);
		expect(routes.has('loop')).toBe(true);
	});
});

describe('layoutDiagram with Zones', () => {
	it('lays each Zone out around its content, nested Zones too, siblings apart', async () => {
		const project = new ProjectDocument();
		const d = project.addDiagram('system');
		// Drawn roughly: a region holding a VPC with two services, a cache beside it; a client outside.
		const region = project.addZone(d, 0, 0, 1200, 700, 'Region');
		const vpc = project.addZone(d, 20, 20, 700, 600, 'VPC');
		const other = project.addZone(d, 1400, 0, 400, 300, 'Other region');
		const api = project.addComponent(d, 'service', 'API', 60, 80);
		const db = project.addComponent(d, 'database', 'DB', 60, 300);
		const cache = project.addComponent(d, 'cache', 'Cache', 900, 80);
		const client = project.addComponent(d, 'client', 'Browser', -600, 80);
		const replica = project.addComponent(d, 'database', 'Replica', 1450, 60);
		// In and out of the VPC and back: the shape that made ELK's model order fail.
		const queue = project.addComponent(d, 'queue', 'Events', 300, 80);
		const worker = project.addComponent(d, 'service', 'Worker', 900, 300);
		for (const [a, b] of [
			[client, api],
			[api, db],
			[api, cache],
			[db, replica],
			[api, queue],
			[queue, worker],
			[worker, db]
		]) {
			project.addConnection(d, a, b);
		}
		const nodes = project.nodes(d);
		const { positions, zoneSizes, routes } = await layoutDiagram(
			nodes,
			project.edges(d),
			estimatedSize,
			'system'
		);
		project.arrange(d, positions, routes, zoneSizes);

		const box = (id: string) => {
			const node = project.nodes(d).find((n) => n.id === id)!;
			return { ...node, ...estimatedSize(node) };
		};
		const within = (inner: string, outer: string) => {
			const a = box(inner);
			const b = box(outer);
			return (
				a.x >= b.x &&
				a.y >= b.y &&
				a.x + a.width <= b.x + b.width &&
				a.y + a.height <= b.y + b.height
			);
		};
		expect(within(api, vpc) && within(db, vpc)).toBe(true);
		expect(within(vpc, region) && within(cache, region)).toBe(true);
		expect(within(replica, other)).toBe(true);
		expect(within(client, region) || within(client, other)).toBe(false);
		expect(within(cache, vpc)).toBe(false);
		expect(
			overlapping(
				new Map([
					[region, box(region)],
					[other, box(other)],
					[client, box(client)]
				]),
				(id) => box(id)
			)
		).toBe(false);
		expect(within(queue, vpc) && within(worker, region) && !within(worker, vpc)).toBe(true);
		expect(routes.size).toBe(7);
	});

	it('leaves a CIF out of the layout and puts it back above its Association', async () => {
		const project = new ProjectDocument();
		const d = project.addDiagram('mcd');
		const [a, b, c] = ['A', 'B', 'C'].map((name, i) => project.addEntity(d, i * 500, 900, name));
		const abc = project.addAssociation(d, a, b, 'abc');
		project.addLeg(d, abc, c);
		const cif = project.addCif(d, abc);
		const { positions } = await layoutDiagram(
			project.nodes(d),
			project.edges(d),
			estimatedSize,
			'mcd'
		);
		const at = positions.get(abc)!;
		expect(positions.get(cif)).toEqual({ x: at.x + CIF_OFFSET.x, y: at.y + CIF_OFFSET.y });
	});

	it('ranks an Inheritance after its parent and before its children, its lines unrouted', async () => {
		const project = new ProjectDocument();
		const d = project.addDiagram('mcd');
		const [person, student, teacher] = ['Person', 'Student', 'Teacher'].map((name, i) =>
			project.addEntity(d, i * 300, 0, name)
		);
		project.setParent(d, student, person);
		project.setParent(d, teacher, person);
		const inheritance = project.nodes(d).find((n) => n.type === 'inheritance')!.id;
		const { positions, routes } = await layoutDiagram(
			project.nodes(d),
			project.edges(d),
			estimatedSize,
			'mcd'
		);
		const x = (id: string) => positions.get(id)!.x;
		expect(x(person)).toBeLessThan(x(inheritance));
		expect(x(inheritance)).toBeLessThan(x(student));
		expect(x(inheritance)).toBeLessThan(x(teacher));
		expect(routes.size).toBe(0);
	});
});

describe('Tidy up direction', () => {
	it('lays a vertical MCD out from top to bottom, each Association between its Entities', async () => {
		const project = new ProjectDocument();
		const d = project.addDiagram('mcd');
		const customer = project.addEntity(d, 0, 0, 'Customer');
		const order = project.addEntity(d, 0, 0, 'Order');
		const places = project.addAssociation(d, customer, order, 'places');
		const { positions } = await layoutDiagram(
			project.nodes(d),
			project.edges(d),
			estimatedSize,
			'mcd',
			'vertical'
		);
		const y = (id: string) => positions.get(id)!.y;
		const [top, bottom] = [y(customer), y(order)].sort((a, b) => a - b);
		expect(top < y(places) && y(places) < bottom).toBe(true);
	});

	it('is stored for every Participant, kept by a JSON file, and horizontal by default or when unknown', () => {
		const project = new ProjectDocument();
		const mcd = project.addDiagram('mcd');
		const system = project.addDiagram('system');
		expect(project.diagram(mcd)!.tidyDirection).toBeUndefined();
		project.setTidyDirection(mcd, 'vertical');
		expect(project.diagram(mcd)!.tidyDirection).toBe('vertical');
		const copy = ProjectDocument.fromFile(JSON.parse(JSON.stringify(project.toFile())));
		expect(copy.diagram(mcd)!.tidyDirection).toBe('vertical');
		project.setTidyDirection(mcd, 'horizontal');
		expect(project.diagram(mcd)!.tidyDirection).toBeUndefined();
		expect(() => project.setTidyDirection(system, 'vertical')).toThrow();

		const file = project.toFile();
		file.diagrams[0] = { ...file.diagrams[0], tidyDirection: 'diagonal' as never };
		expect(ProjectDocument.fromFile(file).diagram(mcd)!.tidyDirection).toBeUndefined();
	});
});

describe('layoutFingerprint', () => {
	it('changes with a Connection label or Flow, and with the direction', () => {
		const project = new ProjectDocument();
		const d = project.addDiagram('system');
		const a = project.addComponent(d, 'service', 'A', 0, 0);
		const b = project.addComponent(d, 'database', 'B', 400, 0);
		const c = project.addConnection(d, a, b)!;
		const print = () => layoutFingerprint(project.nodes(d), project.edges(d));
		const before = print();
		project.setEdgeLabel(d, c, 'SQL');
		expect(print()).not.toBe(before);
		const labelled = print();
		project.setConnectionFlow(d, c, 'read');
		expect(print()).not.toBe(labelled);
		expect(layoutFingerprint(project.nodes(d), project.edges(d), 'vertical')).not.toBe(print());
	});
});

describe('Note width', () => {
	it('is stored rounded and within bounds, kept by a JSON file, and read as the default when bad', () => {
		const project = new ProjectDocument();
		const d = project.addDiagram('system');
		const note = project.addNote(d, 100, 100, 'Nightly backups');
		const read = () => project.nodes(d).find((n) => n.id === note)!;
		expect(noteWidth(read())).toBe(NOTE_WIDTH);
		project.setNoteWidth(d, note, 60, 320.4);
		expect(read()).toMatchObject({ x: 60, width: 320 });
		project.setNoteWidth(d, note, 60, 2000);
		expect(read().width).toBe(NOTE_WIDTHS.max);
		project.setNoteWidth(d, note, 60, 10);
		expect(read().width).toBe(NOTE_WIDTHS.min);
		const copy = ProjectDocument.fromFile(JSON.parse(JSON.stringify(project.toFile())));
		expect(copy.nodes(d).find((n) => n.id === note)!.width).toBe(NOTE_WIDTHS.min);
		expect(noteWidth({ ...read(), width: 'wide' })).toBe(NOTE_WIDTH);
	});

	it('wraps the text to the width, the height following it', () => {
		const text = 'Syncs every night at 2 a.m. from KDP, then mails the report to the team';
		expect(noteLines(text, 600)).toHaveLength(1);
		expect(noteLines(text).length).toBeGreaterThan(2);
		expect(noteSize(text, 600)).toEqual({ width: 600, height: 80 });
		const project = new ProjectDocument();
		const d = project.addDiagram('system');
		const note = project.addNote(d, 0, 0, text);
		project.setNoteWidth(d, note, 0, 600);
		expect(estimatedSize(project.nodes(d)[0])).toEqual({ width: 600, height: 80 });
	});
});

describe('Tidy up and Connection labels', () => {
	function diagram(label: string) {
		const project = new ProjectDocument();
		const d = project.addDiagram('system');
		const a = project.addComponent(d, 'service', 'A', 0, 0);
		const b = project.addComponent(d, 'service', 'B', 0, 0);
		const id = project.addConnection(d, a, b)!;
		project.setEdgeLabel(d, id, label);
		return { project, d, id, a, b };
	}
	const gap = async (label: string) => {
		const { project, d, a, b } = diagram(label);
		const { positions } = await layoutDiagram(
			project.nodes(d),
			project.edges(d),
			estimatedSize,
			'system'
		);
		return positions.get(b)!.x - positions.get(a)!.x - estimatedSize(project.nodes(d)[0]).width;
	};

	it('reserves a wrapped label its lines, not its whole text', async () => {
		const wide = await gap('a label long enough to take several lines once it is wrapped, as here');
		expect(wide).toBeGreaterThanOrEqual(100);
		expect(wide).toBeLessThan(400);
		expect(await gap('GET')).toBeLessThan(wide);
	});

	it('starts again when a peer moves a label meanwhile', () => {
		const { project, d, id } = diagram('GET');
		const print = () => layoutFingerprint(project.nodes(d), project.edges(d));
		const before = print();
		project.setLabelPosition(d, id, 0.2);
		expect(print()).not.toBe(before);
	});
});
