import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { ProjectDocument } from './project';

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
