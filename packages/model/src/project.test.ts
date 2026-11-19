import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import type { DataType } from './data-types.ts';
import { ProjectDocument, type Attribute } from './project.ts';

describe('ProjectDocument', () => {
	it('keeps its name in the document, renames it and undoes the rename', () => {
		const project = new ProjectDocument();
		project.rename('Shop');
		project.stopCapturing();
		project.rename('  Webshop ');
		expect(project.name()).toBe('Webshop');
		project.undo();
		expect(project.name()).toBe('Shop');
	});

	it('adopts a name once, without making it undoable', () => {
		const project = new ProjectDocument();
		project.adoptName('Legacy');
		project.adoptName('Other');
		expect(project.name()).toBe('Legacy');
		project.undo();
		expect(project.name()).toBe('Legacy');
	});

	it('adds a Diagram of each kind with a default name, in creation order', () => {
		const project = new ProjectDocument();
		project.addDiagram('system');
		project.addDiagram('mcd', 'Shop data');
		expect(project.diagrams().map((d) => [d.kind, d.name])).toEqual([
			['system', 'System design'],
			['mcd', 'Shop data']
		]);
	});

	it('renames and deletes a Diagram', () => {
		const project = new ProjectDocument();
		const id = project.addDiagram('mcd');
		project.renameDiagram(id, 'Orders');
		expect(project.diagram(id)?.name).toBe('Orders');
		project.deleteDiagram(id);
		expect(project.diagrams()).toEqual([]);
	});

	it('undoes and redoes an operation', () => {
		const project = new ProjectDocument();
		const id = project.addDiagram('system');
		project.stopCapturing();
		project.renameDiagram(id, 'Checkout');

		project.undo();
		expect(project.diagram(id)?.name).toBe('System design');
		project.redo();
		expect(project.diagram(id)?.name).toBe('Checkout');
	});

	it('exports to a file and imports it back', () => {
		const project = new ProjectDocument();
		const id = project.addDiagram('system', 'Checkout');
		project.addDiagram('mcd');

		project.rename('Shop');

		const file = JSON.parse(JSON.stringify(project.toFile()));
		const imported = ProjectDocument.fromFile(file);

		expect(imported.name()).toBe('Shop');
		expect(imported.toFile()).toEqual(file);
		expect(imported.diagram(id)?.name).toBe('Checkout');
	});

	it('rejects a file it did not write', () => {
		expect(() => ProjectDocument.fromFile({ hello: 'world' })).toThrow();
		expect(() =>
			ProjectDocument.fromFile({
				format: 'simple-modelisation',
				version: 1,
				name: 'x',
				diagrams: [{ id: 'd', kind: 'gantt' }]
			})
		).toThrow();
	});
});

describe('System design diagram', () => {
	const setup = () => {
		const project = new ProjectDocument();
		const diagram = project.addDiagram('system');
		const api = project.addComponent(diagram, 'service', 'API', 0, 0);
		const db = project.addComponent(diagram, 'database', 'Database', 200, 0);
		return { project, diagram, api, db };
	};

	it('applies and clears a Skin', () => {
		const { project, diagram, db } = setup();
		project.setSkin(diagram, db, 'postgresql');
		expect(project.nodes(diagram).find((n) => n.id === db)?.skin).toBe('postgresql');
		project.setSkin(diagram, db, null);
		expect(project.nodes(diagram).find((n) => n.id === db)?.skin).toBeNull();
	});

	it('labels a Connection and deletes it with its Component', () => {
		const { project, diagram, api, db } = setup();
		const connection = project.addConnection(diagram, api, db)!;
		project.setEdgeLabel(diagram, connection, ' SQL ');
		expect(project.edges(diagram)).toMatchObject([{ source: api, target: db, label: 'SQL' }]);

		project.deleteElements(diagram, [db], []);
		expect(project.nodes(diagram).map((n) => n.id)).toEqual([api]);
		expect(project.edges(diagram)).toEqual([]);
	});

	it('refuses a Connection from a Component to itself', () => {
		const { project, diagram, api } = setup();
		expect(project.addConnection(diagram, api, api)).toBeNull();
	});
});

describe('MCD', () => {
	const setup = () => {
		const project = new ProjectDocument();
		const diagram = project.addDiagram('mcd');
		const customer = project.addEntity(diagram, 0, 0, 'Customer');
		const order = project.addEntity(diagram, 400, 0, 'Order');
		return { project, diagram, customer, order };
	};
	const legsOf = (project: ProjectDocument, diagram: string) =>
		project.edges(diagram).filter((e) => e.type === 'leg');

	it('creates a binary Association with two 0,n Legs', () => {
		const { project, diagram, customer, order } = setup();
		const places = project.addAssociation(diagram, customer, order, 'places');
		expect(project.nodes(diagram).find((n) => n.id === places)).toMatchObject({
			type: 'association',
			name: 'places',
			x: 200
		});
		expect(legsOf(project, diagram)).toMatchObject([
			{ source: places, target: customer, cardinality: '0,n' },
			{ source: places, target: order, cardinality: '0,n' }
		]);
	});

	it('creates a reflexive Association', () => {
		const { project, diagram, customer } = setup();
		const sponsors = project.addAssociation(diagram, customer, customer, 'sponsors');
		expect(legsOf(project, diagram).map((l) => [l.source, l.target])).toEqual([
			[sponsors, customer],
			[sponsors, customer]
		]);
	});

	it('cycles a Cardinality through 0,1 → 1,1 → 0,n → 1,n', () => {
		const { project, diagram, customer, order } = setup();
		project.addAssociation(diagram, customer, order);
		const leg = legsOf(project, diagram)[0].id;
		const seen = [];
		for (let i = 0; i < 4; i++) {
			project.cycleCardinality(diagram, leg);
			seen.push(legsOf(project, diagram).find((l) => l.id === leg)?.cardinality);
		}
		expect(seen).toEqual(['1,n', '0,1', '1,1', '0,n']);
	});

	it('deletes the Legs and Associations of a deleted Entity', () => {
		const { project, diagram, customer, order } = setup();
		project.addAssociation(diagram, customer, order);
		project.addAssociation(diagram, customer, customer);

		project.deleteElements(diagram, [customer], []);
		expect(project.nodes(diagram).map((n) => n.id)).toEqual([order]);
		expect(project.edges(diagram)).toEqual([]);
	});

	it('edits the Attributes and Identifier of an Entity', () => {
		const { project, diagram, customer } = setup();
		const email = project.addAttribute(diagram, customer, 'email');
		const name = project.addAttribute(diagram, customer, 'name');
		project.moveAttribute(diagram, customer, name, -1);
		project.toggleIdentifier(diagram, customer, email);
		project.renameAttribute(diagram, customer, email, 'mail');

		const entity = project.nodes(diagram).find((n) => n.id === customer);
		expect(entity?.attributes).toMatchObject([
			{ name: 'id', identifier: true },
			{ name: 'name', identifier: false },
			{ name: 'mail', identifier: true }
		]);
	});
});

describe('Import validation', () => {
	it('rejects an Entity without Attributes and a Leg to a missing Entity', () => {
		const project = new ProjectDocument();
		const diagram = project.addDiagram('mcd');
		const a = project.addEntity(diagram, 0, 0);
		const b = project.addEntity(diagram, 300, 0);
		project.addAssociation(diagram, a, b);
		const file = JSON.parse(JSON.stringify(project.toFile()));

		const noAttributes = structuredClone(file);
		delete noAttributes.diagrams[0].nodes[0].attributes;
		expect(() => ProjectDocument.fromFile(noAttributes)).toThrow();

		const danglingLeg = structuredClone(file);
		danglingLeg.diagrams[0].edges[0].target = 'nowhere';
		expect(() => ProjectDocument.fromFile(danglingLeg)).toThrow();

		expect(() => ProjectDocument.fromFile(file)).not.toThrow();
	});
});

describe('Local edits', () => {
	it("reports this user's operations and undo, not changes received from a collaborator", () => {
		const mine = new ProjectDocument();
		const theirs = new ProjectDocument();
		let edits = 0;
		mine.subscribeLocalEdits(() => edits++);

		mine.addDiagram('system');
		mine.undo();
		expect(edits).toBe(2);

		theirs.addDiagram('mcd');
		Y.applyUpdate(mine.doc, Y.encodeStateAsUpdate(theirs.doc), 'provider');
		expect(edits).toBe(2);
	});
});

describe('Attribute Data types', () => {
	it('reads an untyped Attribute received from a peer with the same rules', () => {
		const project = new ProjectDocument();
		const diagram = project.addDiagram('mcd');
		const entity = project.addEntity(diagram, 0, 0, 'Customer');
		const node = (project.doc.getMap('diagrams').get(diagram) as Y.Map<Y.Map<Y.Map<unknown>>>)
			.get('nodes')!
			.get(entity)!;
		node.set('attributes', [{ id: 'old', name: 'id', identifier: true }]);
		expect(project.nodes(diagram)[0].attributes).toEqual([
			{ id: 'old', name: 'id', identifier: true, type: { kind: 'serial' }, optional: false }
		]);
	});

	it('never lets an Auto-increment column be optional', () => {
		const project = new ProjectDocument();
		const diagram = project.addDiagram('mcd');
		const entity = project.addEntity(diagram, 0, 0, 'Customer');
		const count = project.addAttribute(diagram, entity, 'count');
		project.setAttributeOptional(diagram, entity, count, true);
		project.setAttributeType(diagram, entity, count, { kind: 'serial' });
		project.setAttributeOptional(diagram, entity, count, true);
		expect((project.nodes(diagram)[0].attributes as Attribute[])[1].optional).toBe(false);
	});

	const setup = () => {
		const project = new ProjectDocument();
		const diagram = project.addDiagram('mcd');
		const entity = project.addEntity(diagram, 0, 0, 'Customer');
		const attributes = () => project.nodes(diagram)[0].attributes as Attribute[];
		return { project, diagram, entity, attributes };
	};

	it('gives a new Entity an Auto-increment id and new Attributes required Text', () => {
		const { project, diagram, entity, attributes } = setup();
		project.addAttribute(diagram, entity, 'email');
		expect(attributes().map((a) => [a.name, a.type.kind, a.optional])).toEqual([
			['id', 'serial', false],
			['email', 'text', false]
		]);
	});

	it('sets a type with its parameters and makes a column optional, never an Identifier', () => {
		const { project, diagram, entity, attributes } = setup();
		const email = project.addAttribute(diagram, entity, 'email');
		project.setAttributeType(diagram, entity, email, { kind: 'varchar', length: 120 });
		project.setAttributeOptional(diagram, entity, email, true);
		project.setAttributeOptional(diagram, entity, attributes()[0].id, true);
		expect(attributes().map((a) => [a.type, a.optional])).toEqual([
			[{ kind: 'serial' }, false],
			[{ kind: 'varchar', length: 120 }, true]
		]);
		project.setAttributeType(diagram, entity, email, { kind: 'varchar', length: -1 } as DataType);
		expect(attributes()[1].type).toEqual({ kind: 'varchar', length: 120 });
	});

	it('completes Attributes written before Data types, without writing or an undo step', () => {
		const file = {
			format: 'simple-modelisation',
			version: 1,
			name: 'Old',
			diagrams: [
				{
					id: 'd',
					kind: 'mcd',
					name: 'MCD',
					createdAt: 1,
					nodes: [
						{
							id: 'e',
							type: 'entity',
							x: 0,
							y: 0,
							name: 'Customer',
							attributes: [
								{ id: 'a1', name: 'id', identifier: true },
								{ id: 'a2', name: 'name', identifier: false }
							]
						},
						{
							id: 'f',
							type: 'entity',
							x: 0,
							y: 0,
							name: 'Line',
							attributes: [
								{ id: 'b1', name: 'order', identifier: true },
								{ id: 'b2', name: 'rank', identifier: true }
							]
						}
					],
					edges: []
				}
			]
		};
		const project = ProjectDocument.fromFile(file);
		const kinds = project
			.nodes('d')
			.map((n) => (n.attributes as Attribute[]).map((a) => a.type.kind));
		expect(kinds).toEqual([
			['serial', 'text'],
			['text', 'text']
		]);
		project.undo();
		expect(project.nodes('d')[0].attributes).toHaveLength(2);
	});
});

describe('Hosting', () => {
	it('sets, changes and clears where a Component runs, ignoring unknown values', () => {
		const project = new ProjectDocument();
		const d = project.addDiagram('system');
		const db = project.addComponent(d, 'database', 'DB', 0, 0);
		const hosting = () => project.nodes(d)[0].hosting;
		expect(hosting()).toBeUndefined();
		project.setHosting(d, db, 'docker');
		expect(hosting()).toBe('docker');
		project.setHosting(d, db, 'managed');
		expect(hosting()).toBe('managed');
		project.setHosting(d, db, 'mainframe' as never);
		expect(hosting()).toBe('managed');
		project.setHosting(d, db, null);
		expect(hosting()).toBeUndefined();
	});

	it('keeps the Hosting through export and import, and reads an unknown one as unspecified', () => {
		const project = new ProjectDocument();
		const d = project.addDiagram('system');
		project.setHosting(d, project.addComponent(d, 'cache', 'Cache', 0, 0), 'kubernetes');
		const file = JSON.parse(JSON.stringify(project.toFile()));
		expect(ProjectDocument.fromFile(file).nodes(d)[0].hosting).toBe('kubernetes');
		file.diagrams[0].nodes[0].hosting = 'mainframe';
		expect(ProjectDocument.fromFile(file).nodes(d)[0].hosting).toBeUndefined();
	});
});

describe('Provider', () => {
	it('sets, changes and clears whose infrastructure a Component runs on, ignoring unknown values', () => {
		const project = new ProjectDocument();
		const d = project.addDiagram('system');
		const db = project.addComponent(d, 'database', 'DB', 0, 0);
		const provider = () => project.nodes(d)[0].provider;
		expect(provider()).toBeUndefined();
		project.setProvider(d, db, 'ovhcloud');
		expect(provider()).toBe('ovhcloud');
		project.setProvider(d, db, 'aws');
		expect(provider()).toBe('aws');
		project.setProvider(d, db, 'self-hosted');
		expect(provider()).toBe('self-hosted');
		project.setProvider(d, db, 'my-garage' as never);
		expect(provider()).toBe('self-hosted');
		project.setProvider(d, db, null);
		expect(provider()).toBeUndefined();
	});

	it('keeps the Provider through export and import, and reads an unknown one as unspecified', () => {
		const project = new ProjectDocument();
		const d = project.addDiagram('system');
		project.setProvider(d, project.addComponent(d, 'cache', 'Cache', 0, 0), 'hetzner');
		const file = JSON.parse(JSON.stringify(project.toFile()));
		expect(ProjectDocument.fromFile(file).nodes(d)[0].provider).toBe('hetzner');
		file.diagrams[0].nodes[0].provider = 'my-garage';
		expect(ProjectDocument.fromFile(file).nodes(d)[0].provider).toBeUndefined();
		for (const unknown of [42, null]) {
			file.diagrams[0].nodes[0].provider = unknown;
			expect(ProjectDocument.fromFile(file).nodes(d)[0].provider).toBeUndefined();
		}
	});
});

describe('Zones', () => {
	const setup = () => {
		const project = new ProjectDocument();
		const diagram = project.addDiagram('system');
		const api = project.addComponent(diagram, 'service', 'API', 40, 60);
		const db = project.addComponent(diagram, 'database', 'Database', 240, 60);
		const zone = project.addZone(diagram, 0, 0, 500, 200, ' VPC ');
		const node = (id: string) => project.nodes(diagram).find((n) => n.id === id)!;
		return { project, diagram, api, db, zone, node };
	};

	it('draws, resizes, renames and deletes a Zone, keeping its content', () => {
		const { project, diagram, api, db, zone, node } = setup();
		expect(node(zone)).toMatchObject({ type: 'zone', name: 'VPC', width: 500, height: 200 });

		project.setZoneBox(diagram, zone, { x: -10.4, y: 5, width: 20, height: 300 });
		expect(node(zone)).toMatchObject({ x: -10, y: 5, width: 160, height: 300 });

		project.renameNode(diagram, zone, 'eu-west-1');
		expect(node(zone).name).toBe('eu-west-1');

		project.deleteElements(diagram, [zone], []);
		expect(
			project
				.nodes(diagram)
				.map((n) => n.id)
				.sort()
		).toEqual([api, db].sort());
	});

	it('sets and clears a Zone Provider, ignoring unknown values', () => {
		const { project, diagram, zone, node } = setup();
		project.setProvider(diagram, zone, 'ovhcloud');
		expect(node(zone).provider).toBe('ovhcloud');
		project.setProvider(diagram, zone, 'my-garage' as never);
		expect(node(zone).provider).toBe('ovhcloud');
		const file = JSON.parse(JSON.stringify(project.toFile()));
		file.diagrams[0].nodes.find((n: { id: string }) => n.id === zone).provider = 'my-garage';
		const imported = ProjectDocument.fromFile(file).nodes(diagram);
		expect(imported.find((n) => n.id === zone)!.provider).toBeUndefined();
		project.setProvider(diagram, zone, null);
		expect(node(zone).provider).toBeUndefined();
	});

	it('refuses a Connection to or from a Zone', () => {
		const { project, diagram, api, zone } = setup();
		expect(project.addConnection(diagram, api, zone)).toBeNull();
		expect(project.addConnection(diagram, zone, api)).toBeNull();
	});

	it('shifts a route whose two ends move alike, drops it otherwise', () => {
		const { project, diagram, api, db, zone } = setup();
		const connection = project.addConnection(diagram, api, db)!;
		const route = (points: { x: number; y: number }[]) =>
			project.arrange(diagram, new Map(), new Map([[connection, points]]));
		route([{ x: 200, y: 90 }]);

		project.moveNodes(diagram, [
			{ id: zone, x: 100, y: 50 },
			{ id: api, x: 140, y: 110 },
			{ id: db, x: 340, y: 110 }
		]);
		expect(project.edges(diagram)[0].points).toEqual([{ x: 300, y: 140 }]);

		project.moveNode(diagram, db, 400, 400);
		expect(project.edges(diagram)[0].points).toBeUndefined();
	});

	it('stores the Zone sizes a Tidy up gives', () => {
		const { project, diagram, zone, node } = setup();
		project.arrange(
			diagram,
			new Map([[zone, { x: 10, y: 20 }]]),
			new Map(),
			new Map([[zone, { width: 640, height: 320 }]])
		);
		expect(node(zone)).toMatchObject({ x: 10, y: 20, width: 640, height: 320 });
	});

	it('imports Zones, but no Zone without a size nor a Connection to a Zone', () => {
		const { project, diagram, api, zone } = setup();
		const file = JSON.parse(JSON.stringify(project.toFile()));
		expect(ProjectDocument.fromFile(file).nodes(diagram)).toHaveLength(3);

		const sizeless = structuredClone(file);
		delete sizeless.diagrams[0].nodes.find((n: { id: string }) => n.id === zone).width;
		expect(() => ProjectDocument.fromFile(sizeless)).toThrow();

		const toZone = structuredClone(file);
		toZone.diagrams[0].edges.push({
			id: 'c',
			type: 'connection',
			source: api,
			target: zone,
			label: ''
		});
		expect(() => ProjectDocument.fromFile(toZone)).toThrow();
	});
});

describe('Disk kind', () => {
	it('sets, changes and clears what a Disk is, only on Disks', () => {
		const project = new ProjectDocument();
		const d = project.addDiagram('system');
		const disk = project.addComponent(d, 'disk', 'SSD 2 To', 0, 0);
		const api = project.addComponent(d, 'service', 'API', 300, 0);
		const node = (id: string) => project.nodes(d).find((n) => n.id === id)!;
		project.setDiskKind(d, disk, 'ssd');
		expect(node(disk).diskKind).toBe('ssd');
		project.setDiskKind(d, disk, 'floppy' as never);
		expect(node(disk).diskKind).toBe('ssd');
		project.setDiskKind(d, api, 'hdd');
		expect(node(api).diskKind).toBeUndefined();
		project.setDiskKind(d, disk, null);
		expect(node(disk).diskKind).toBeUndefined();
	});

	it('imports Disks, reading an unknown Disk kind as unspecified', () => {
		const project = new ProjectDocument();
		const d = project.addDiagram('system');
		project.setDiskKind(d, project.addComponent(d, 'disk', 'USB 12 To', 0, 0), 'usb');
		const file = JSON.parse(JSON.stringify(project.toFile()));
		expect(ProjectDocument.fromFile(file).nodes(d)[0]).toMatchObject({
			componentType: 'disk',
			diskKind: 'usb'
		});
		file.diagrams[0].nodes[0].diskKind = 'floppy';
		expect(ProjectDocument.fromFile(file).nodes(d)[0].diskKind).toBeUndefined();
		// Only a Disk has a kind.
		file.diagrams[0].nodes[0].componentType = 'cache';
		file.diagrams[0].nodes[0].diskKind = 'ssd';
		expect(ProjectDocument.fromFile(file).nodes(d)[0].diskKind).toBeUndefined();
	});
});

describe('Skins read', () => {
	it('reads a Skin the type does not offer as generic', () => {
		const project = new ProjectDocument();
		const d = project.addDiagram('system');
		const db = project.addComponent(d, 'database', 'DB', 0, 0);
		const file = JSON.parse(JSON.stringify(project.toFile()));
		file.diagrams[0].nodes[0].skin = 'nginx';
		expect(ProjectDocument.fromFile(file).nodes(d)[0].skin).toBeNull();
		project.setSkin(d, db, 'postgresql');
		expect(project.nodes(d)[0].skin).toBe('postgresql');
	});
});

describe('Component type change', () => {
	it('keeps what the new type allows, drops the rest', () => {
		const project = new ProjectDocument();
		const d = project.addDiagram('system');
		const store = project.addComponent(d, 'storage', 'Data', 0, 0);
		const api = project.addComponent(d, 'service', 'API', 300, 0);
		const connection = project.addConnection(d, api, store)!;
		project.setSkin(d, store, 'minio');
		project.setHosting(d, store, 'bare-metal');
		const node = () => project.nodes(d).find((n) => n.id === store)!;

		project.setComponentType(d, store, 'disk');
		project.setDiskKind(d, store, 'ssd');
		expect(node()).toMatchObject({
			componentType: 'disk',
			skin: null,
			hosting: 'bare-metal',
			diskKind: 'ssd'
		});
		expect(project.edges(d).map((e) => e.id)).toEqual([connection]);

		project.setComponentType(d, store, 'database');
		expect(node().diskKind).toBeUndefined();
		project.setSkin(d, store, 'postgresql');
		project.setComponentType(d, store, 'cache');
		expect(node().skin).toBeNull();
		project.setComponentType(d, store, 'mainframe' as never);
		expect(node().componentType).toBe('cache');
	});
});
