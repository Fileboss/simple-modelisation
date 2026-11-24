import { describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import type { DataType } from './data-types.ts';
import { estimatedSize } from './layout.ts';
import {
	ProjectDocument,
	type Attribute,
	type Cardinality,
	type CifNode,
	type InheritanceNode,
	type LegEdge
} from './project.ts';
import { effectiveProviders, zoneParents } from './zones.ts';
import { systemSvg } from './svg/system.ts';
import { ENGLISH_NAMES } from './names.ts';

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

	it('adds a 0,n Leg to make an N-ary Association, and only from an Association to an Entity', () => {
		const { project, diagram, customer, order } = setup();
		const product = project.addEntity(diagram, 200, 300, 'Product');
		const lists = project.addAssociation(diagram, customer, order, 'lists');
		const leg = project.addLeg(diagram, lists, product);
		expect(legsOf(project, diagram).find((l) => l.id === leg)).toMatchObject({
			source: lists,
			target: product,
			cardinality: '0,n'
		});
		expect(() => project.addLeg(diagram, customer, product)).toThrow();
		expect(() => project.addLeg(diagram, lists, lists)).toThrow();
		expect(legsOf(project, diagram)).toHaveLength(3);
	});

	it('leaves a binary Association when a Leg of a ternary is deleted', () => {
		const { project, diagram, customer, order } = setup();
		const product = project.addEntity(diagram, 200, 300, 'Product');
		const lists = project.addAssociation(diagram, customer, order, 'lists');
		const leg = project.addLeg(diagram, lists, product);
		project.deleteElements(diagram, [], [leg]);
		expect(project.nodes(diagram).some((n) => n.id === lists)).toBe(true);
		expect(legsOf(project, diagram).map((l) => l.target)).toEqual([customer, order]);
	});

	it('keeps the Legs of an N-ary Association through a file round trip', () => {
		const { project, diagram, customer, order } = setup();
		const lists = project.addAssociation(diagram, customer, order, 'lists');
		project.addLeg(diagram, lists, customer);
		const copy = ProjectDocument.fromFile(project.toFile());
		const [copied] = copy.diagrams();
		expect(copy.edges(copied.id).filter((e) => e.source === lists)).toHaveLength(3);
	});

	describe('CIF', () => {
		const ternary = (cardinalities: Cardinality[] = ['0,n', '0,n', '0,n']) => {
			const { project, diagram, customer, order } = setup();
			const product = project.addEntity(diagram, 200, 300, 'Product');
			const lists = project.addAssociation(diagram, customer, order, 'lists');
			project.addLeg(diagram, lists, product);
			const legs = legsOf(project, diagram);
			legs.forEach((leg, i) => project.setCardinality(diagram, leg.id, cardinalities[i]));
			const cifOf = (id: string) =>
				project.nodes(diagram).find((n) => n.id === id) as CifNode | undefined;
			return { project, diagram, lists, legs, cifOf, customer };
		};

		it('determines the Leg with a max of 1, else the last, by the others', () => {
			const withOne = ternary(['0,n', '1,1', '0,n']);
			const id = withOne.project.addCif(withOne.diagram, withOne.lists);
			expect(withOne.cifOf(id)).toMatchObject({
				type: 'cif',
				association: withOne.lists,
				determined: withOne.legs[1].id,
				determinants: [withOne.legs[0].id, withOne.legs[2].id]
			});
			const plain = ternary();
			const other = plain.project.addCif(plain.diagram, plain.lists);
			expect(plain.cifOf(other)?.determined).toBe(plain.legs[2].id);
		});

		it('is refused on a binary Association', () => {
			const { project, diagram, customer, order } = setup();
			const places = project.addAssociation(diagram, customer, order);
			expect(() => project.addCif(diagram, places)).toThrow();
		});

		it('changes the role of a Leg, one determined at a time, at least one determinant', () => {
			const { project, diagram, lists, legs, cifOf } = ternary();
			const id = project.addCif(diagram, lists);
			project.setCifRole(diagram, id, legs[0].id, 'determined');
			// The former determined Leg is left out; the new one leaves the determinants.
			expect(cifOf(id)).toMatchObject({ determined: legs[0].id, determinants: [legs[1].id] });
			project.setCifRole(diagram, id, legs[2].id, 'determinant');
			expect(cifOf(id)?.determinants).toEqual([legs[1].id, legs[2].id]);
			project.setCifRole(diagram, id, legs[1].id, 'none');
			project.setCifRole(diagram, id, legs[2].id, 'none');
			// The last determinant stays: a CIF needs one.
			expect(cifOf(id)?.determinants).toEqual([legs[2].id]);
		});

		it('goes with its Association or its determined Leg, and loses a deleted determinant', () => {
			const a = ternary();
			const first = a.project.addCif(a.diagram, a.lists);
			a.project.deleteElements(a.diagram, [], [a.legs[0].id]);
			// Binary again: the CIF loses Leg 0 but keeps Leg 1 → Leg 2.
			expect(a.cifOf(first)).toMatchObject({ determinants: [a.legs[1].id] });
			a.project.deleteElements(a.diagram, [], [a.legs[2].id]);
			expect(a.cifOf(first)).toBeUndefined();

			const b = ternary();
			const second = b.project.addCif(b.diagram, b.lists);
			b.project.deleteElements(b.diagram, [b.lists], []);
			expect(b.cifOf(second)).toBeUndefined();

			const c = ternary();
			const third = c.project.addCif(c.diagram, c.lists);
			c.project.deleteElements(c.diagram, [c.customer], []);
			// Deleting an Entity deletes its Leg (a determinant): the CIF keeps the other.
			expect(c.cifOf(third)?.determinants).toEqual([c.legs[1].id]);
		});

		it('keeps a CIF through a file round trip', () => {
			const { project, diagram, lists } = ternary();
			const id = project.addCif(diagram, lists);
			const copy = ProjectDocument.fromFile(project.toFile());
			expect(copy.nodes(copy.diagrams()[0].id).find((n) => n.id === id)).toMatchObject({
				type: 'cif',
				association: lists
			});
		});
	});

	describe('Inheritance', () => {
		const people = () => {
			const project = new ProjectDocument();
			const diagram = project.addDiagram('mcd');
			const person = project.addEntity(diagram, 300, 0, 'Person');
			const student = project.addEntity(diagram, 0, 400, 'Student');
			const teacher = project.addEntity(diagram, 600, 400, 'Teacher');
			const nodes = () => project.nodes(diagram);
			const inheritances = () =>
				nodes().filter((n): n is InheritanceNode => n.type === 'inheritance');
			const childrenOf = (id: string) =>
				project
					.edges(diagram)
					.filter((e) => e.type === 'isa' && e.source === id)
					.map((e) => e.target);
			return { project, diagram, person, student, teacher, inheritances, childrenOf };
		};

		it('makes one Inheritance under the parent, shared by its children', () => {
			const { project, diagram, person, student, teacher, inheritances, childrenOf } = people();
			project.setParent(diagram, student, person);
			project.setParent(diagram, teacher, person);
			const [inheritance] = inheritances();
			expect(inheritances()).toHaveLength(1);
			expect(inheritance).toMatchObject({ parent: person, x: 300, y: 120 });
			expect(childrenOf(inheritance.id)).toEqual([student, teacher]);
			expect(project.parentOf(diagram, teacher)).toBe(person);
		});

		it('moves a child to another parent and deletes an Inheritance left empty', () => {
			const { project, diagram, person, student, teacher, inheritances } = people();
			project.setParent(diagram, student, person);
			project.setParent(diagram, student, teacher);
			expect(inheritances().map((i) => i.parent)).toEqual([teacher]);
			project.setParent(diagram, student, null);
			expect(inheritances()).toEqual([]);
		});

		it('refuses a parent that is the Entity itself or one of its descendants', () => {
			const { project, diagram, person, student, teacher } = people();
			project.setParent(diagram, student, person);
			project.setParent(diagram, teacher, student);
			expect(() => project.setParent(diagram, person, teacher)).toThrow();
			expect(() => project.setParent(diagram, person, person)).toThrow();
		});

		it('merges two Inheritances that peers made for one parent at once', () => {
			const { project, diagram, person, student, teacher, inheritances, childrenOf } = people();
			// A peer starts from the same document, and each side gives Person a child.
			const peer = new ProjectDocument();
			Y.applyUpdate(peer.doc, Y.encodeStateAsUpdate(project.doc));
			project.setParent(diagram, student, person);
			peer.setParent(diagram, teacher, person);
			Y.applyUpdate(project.doc, Y.encodeStateAsUpdate(peer.doc));
			expect(inheritances()).toHaveLength(2);
			// The next change merges them into the first by id.
			project.setInheritanceConstraint(diagram, inheritances()[0].id, 'X');
			project.setParent(diagram, student, person);
			expect(inheritances()).toHaveLength(1);
			expect(childrenOf(inheritances()[0].id).sort()).toEqual([student, teacher].sort());
		});

		it('sets the constraint and the translation, unknown values ignored', () => {
			const { project, diagram, person, student, inheritances } = people();
			project.setParent(diagram, student, person);
			const id = inheritances()[0].id;
			project.setInheritanceConstraint(diagram, id, 'XT');
			project.setInheritanceTranslation(diagram, id, 'up');
			project.setInheritanceConstraint(diagram, id, 'Q' as never);
			expect(inheritances()[0]).toMatchObject({ constraint: 'XT', translation: 'up' });
			project.setInheritanceConstraint(diagram, id, 'none');
			project.setInheritanceTranslation(diagram, id, 'reference');
			expect(inheritances()[0].constraint).toBeUndefined();
			expect(inheritances()[0].translation).toBeUndefined();
		});

		it('goes with its parent or its last child, and frees its children when deleted', () => {
			const a = people();
			a.project.setParent(a.diagram, a.student, a.person);
			a.project.deleteElements(a.diagram, [a.person], []);
			expect(a.inheritances()).toEqual([]);

			const b = people();
			b.project.setParent(b.diagram, b.student, b.person);
			b.project.deleteElements(b.diagram, [b.student], []);
			expect(b.inheritances()).toEqual([]);

			const c = people();
			c.project.setParent(c.diagram, c.student, c.person);
			c.project.deleteElements(c.diagram, [c.inheritances()[0].id], []);
			expect(c.project.parentOf(c.diagram, c.student)).toBeNull();
			expect(c.project.edges(c.diagram)).toEqual([]);
		});

		it('keeps an Inheritance through a file round trip and a paste', () => {
			const { project, diagram, person, student, inheritances } = people();
			project.setParent(diagram, student, person);
			const copy = ProjectDocument.fromFile(project.toFile());
			expect(copy.parentOf(copy.diagrams()[0].id, student)).toBe(person);

			const pasted = project.paste(
				diagram,
				{ nodes: project.nodes(diagram), edges: project.edges(diagram) },
				0,
				600
			);
			expect(inheritances()).toHaveLength(2);
			const pastedStudent = pasted.find(
				(id) => project.nodes(diagram).find((n) => n.id === id)?.name === 'Student'
			)!;
			const pastedPerson = pasted.find(
				(id) => project.nodes(diagram).find((n) => n.id === id)?.name === 'Person'
			)!;
			expect(project.parentOf(diagram, pastedStudent)).toBe(pastedPerson);
		});
	});

	it('marks a 1,1 Leg of a binary Association relative, and clears it with its Cardinality', () => {
		const { project, diagram, customer, order } = setup();
		const product = project.addEntity(diagram, 200, 300, 'Product');
		const places = project.addAssociation(diagram, order, customer, 'places');
		const [orderLeg, customerLeg] = legsOf(project, diagram);
		const relativeOf = (id: string) =>
			(legsOf(project, diagram).find((l) => l.id === id) as LegEdge).relative;
		expect(() => project.setRelative(diagram, orderLeg.id, true)).toThrow();
		project.setCardinality(diagram, orderLeg.id, '1,1');
		project.setRelative(diagram, orderLeg.id, true);
		expect(relativeOf(orderLeg.id)).toBe(true);
		const copy = ProjectDocument.fromFile(project.toFile());
		expect(
			(copy.edges(copy.diagrams()[0].id).find((e) => e.id === orderLeg.id) as LegEdge).relative
		).toBe(true);
		// Clicking the Cardinality moves it on from 1,1: the R goes too.
		project.cycleCardinality(diagram, orderLeg.id);
		expect(relativeOf(orderLeg.id)).toBeUndefined();
		project.setCardinality(diagram, orderLeg.id, '1,1');
		project.setRelative(diagram, orderLeg.id, true);
		project.setRelative(diagram, orderLeg.id, false);
		expect(relativeOf(orderLeg.id)).toBeUndefined();
		// A third Leg makes it N-ary: the R goes, and is no longer offered.
		project.setRelative(diagram, orderLeg.id, true);
		project.addLeg(diagram, places, product);
		expect(relativeOf(orderLeg.id)).toBeUndefined();
		expect(() => project.setRelative(diagram, orderLeg.id, true)).toThrow();
		void customerLeg;
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

	it('moves an Attribute to an index, clamped to the list', () => {
		const { project, diagram, customer } = setup();
		const email = project.addAttribute(diagram, customer, 'email');
		project.addAttribute(diagram, customer, 'name');
		const names = () =>
			(project.nodes(diagram).find((n) => n.id === customer)!.attributes as { name: string }[]).map(
				(a) => a.name
			);

		project.moveAttributeTo(diagram, customer, email, 0);
		expect(names()).toEqual(['email', 'id', 'name']);
		project.moveAttributeTo(diagram, customer, email, 99);
		expect(names()).toEqual(['id', 'name', 'email']);
		project.moveAttributeTo(diagram, customer, email, -3);
		expect(names()).toEqual(['email', 'id', 'name']);
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

describe('Malformed shared entries', () => {
	/** A document with a good System design diagram and every kind of entry a peer could break. */
	const broken = () => {
		const project = new ProjectDocument();
		const good = project.addDiagram('system', 'Good');
		const web = project.addComponent(good, 'client', 'Web', 0, 0);
		const api = project.addComponent(good, 'service', 'API', 300, 0);
		project.addConnection(good, web, api);
		const diagrams = project.doc.getMap('diagrams');
		const nodes = (diagrams.get(good) as Y.Map<unknown>).get('nodes') as Y.Map<unknown>;
		const edges = (diagrams.get(good) as Y.Map<unknown>).get('edges') as Y.Map<unknown>;
		project.doc.transact(() => {
			diagrams.set('number', 42);
			const unknownKind = new Y.Map<unknown>();
			unknownKind.set('id', 'weird');
			unknownKind.set('kind', 'sequence');
			unknownKind.set('nodes', new Y.Map());
			unknownKind.set('edges', new Y.Map());
			diagrams.set('weird', unknownKind);
			const flat = new Y.Map<unknown>();
			flat.set('id', 'flat');
			flat.set('kind', 'mcd');
			flat.set('nodes', 'not a map');
			flat.set('edges', new Y.Map());
			diagrams.set('flat', flat);
			nodes.set('string', 'a node?');
			const elsewhere = new Y.Map<unknown>();
			for (const [key, value] of Object.entries({
				id: 'real-id',
				type: 'component',
				x: 0,
				y: 0,
				name: 'Ghost',
				componentType: 'service',
				skin: null
			})) {
				elsewhere.set(key, value);
			}
			nodes.set('other-key', elsewhere);
			edges.set('number', 7);
			(diagrams.get(good) as Y.Map<unknown>).set('name', 12);
			project.doc.getMap('meta').set('name', { not: 'text' });
		});
		return { project, good, diagrams };
	};

	it('reads around them without throwing, and leaves them out', () => {
		const { project, good } = broken();
		// Its name is a number: read as the kind's default.
		expect(project.diagrams().map((d) => [d.id, d.name])).toEqual([[good, 'System design']]);
		expect(project.nodes(good).map((n) => n.name)).toEqual(['Web', 'API']);
		expect(project.edges(good)).toHaveLength(1);
		expect(project.name()).toBe('');
		expect(() => project.toFile()).not.toThrow();
		expect(() => project.nodes('flat')).toThrow();
	});

	it('never writes through an entry stored under another key', () => {
		const project = new ProjectDocument();
		const mcd = project.addDiagram('mcd');
		const a = project.addEntity(mcd, 0, 0, 'A');
		const b = project.addEntity(mcd, 300, 0, 'B');
		const ab = project.addAssociation(mcd, a, b);
		const [legA] = project.edges(mcd);
		const edges = (project.doc.getMap('diagrams').get(mcd) as Y.Map<unknown>).get(
			'edges'
		) as Y.Map<unknown>;
		// A ghost under another key, claiming the id of a real Leg.
		const ghost = new Y.Map<unknown>();
		for (const [key, value] of Object.entries({
			id: legA.id,
			type: 'leg',
			source: ab,
			target: a,
			cardinality: '0,n'
		})) {
			ghost.set(key, value);
		}
		edges.set('ghost', ghost);
		project.setCardinality(mcd, legA.id, '1,1');
		expect(project.edges(mcd).find((e) => e.id === legA.id)?.cardinality).toBe('1,1');
		expect(ghost.get('cardinality')).toBe('0,n');
	});

	it('does not count an edge left dangling by concurrent edits', () => {
		const project = new ProjectDocument();
		const system = project.addDiagram('system');
		const web = project.addComponent(system, 'client', 'Web', 0, 0);
		const api = project.addComponent(system, 'service', 'API', 300, 0);
		project.addConnection(system, web, api);
		const nodes = (project.doc.getMap('diagrams').get(system) as Y.Map<unknown>).get(
			'nodes'
		) as Y.Map<unknown>;
		// As a merge would leave it: the node gone, its Connection still there.
		nodes.delete(api);
		expect(project.edges(system)).toEqual([]);
		expect(project.unreadable(system)).toBe(0);
	});

	it('keeps editing around them', () => {
		const { project, good } = broken();
		const [web] = project.nodes(good);
		expect(() => project.deleteElements(good, [web.id], [])).not.toThrow();
		expect(project.nodes(good).map((n) => n.name)).toEqual(['API']);
		const mcd = project.addDiagram('mcd');
		const person = project.addEntity(mcd, 0, 0, 'Person');
		const student = project.addEntity(mcd, 0, 200, 'Student');
		const mcdNodes = (project.doc.getMap('diagrams').get(mcd) as Y.Map<unknown>).get(
			'nodes'
		) as Y.Map<unknown>;
		const mcdEdges = (project.doc.getMap('diagrams').get(mcd) as Y.Map<unknown>).get(
			'edges'
		) as Y.Map<unknown>;
		mcdNodes.set('junk', 1);
		mcdEdges.set('junk', 'x');
		expect(() => project.setParent(mcd, student, person)).not.toThrow();
		expect(project.parentOf(mcd, student)).toBe(person);
	});

	it('counts what it leaves out, and keeps it in the document', () => {
		const { project, good, diagrams } = broken();
		// 3 diagram entries, then the open Diagram's 2 nodes and 1 edge.
		expect(project.unreadable()).toBe(3);
		expect(project.unreadable(good)).toBe(6);
		expect(diagrams.get('number')).toBe(42);
		expect(diagrams.size).toBe(4);
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

describe('fields written by a peer', () => {
	/** A node's or edge's shared map, as a peer holding the Share link can write it. */
	const raw = (project: ProjectDocument, diagram: string, kind: 'nodes' | 'edges', id: string) =>
		(project.doc.getMap('diagrams').get(diagram) as Y.Map<Y.Map<Y.Map<unknown>>>)
			.get(kind)!
			.get(id)!;

	it('leaves out an element an imported file would be refused for, and its edges', () => {
		const project = new ProjectDocument();
		const d = project.addDiagram('system');
		const api = project.addComponent(d, 'service', 'API', 0, 0);
		const db = project.addComponent(d, 'database', 'DB', 300, 0);
		project.addConnection(d, api, db);
		raw(project, d, 'nodes', api).set('x', '0" onload="alert(1)');
		expect(project.nodes(d).map((n) => n.name)).toEqual(['DB']);
		expect(project.edges(d)).toEqual([]);
		expect(systemSvg(project.nodes(d), project.edges(d), { names: ENGLISH_NAMES })).not.toContain(
			'onload'
		);
	});

	it('keeps reading when attributes are no list, leaving that Entity out', () => {
		const project = new ProjectDocument();
		const d = project.addDiagram('mcd');
		const customer = project.addEntity(d, 0, 0, 'Customer');
		project.addEntity(d, 300, 0, 'Order');
		raw(project, d, 'nodes', customer).set('attributes', 'oops');
		expect(project.nodes(d).map((n) => n.name)).toEqual(['Order']);
		expect(() => project.toFile()).not.toThrow();
	});

	it('leaves out an edge whose route holds anything but numbers', () => {
		const project = new ProjectDocument();
		const d = project.addDiagram('system');
		const a = project.addComponent(d, 'service', 'A', 0, 0);
		const b = project.addComponent(d, 'service', 'B', 300, 0);
		const connection = project.addConnection(d, a, b)!;
		raw(project, d, 'edges', connection).set('points', [{ x: '1"/><script>', y: 0 }]);
		expect(project.edges(d)).toEqual([]);
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

describe('Flow', () => {
	it("sets, changes and clears what a Connection's data does", () => {
		const project = new ProjectDocument();
		const d = project.addDiagram('system');
		const app = project.addComponent(d, 'service', 'App', 0, 0);
		const db = project.addComponent(d, 'database', 'DB', 300, 0);
		const c = project.addConnection(d, app, db)!;
		const flow = () => project.edges(d)[0].flow;
		expect(flow()).toBeUndefined();
		project.setConnectionFlow(d, c, 'read');
		expect(flow()).toBe('read');
		project.setConnectionFlow(d, c, 'delete' as never);
		expect(flow()).toBe('read');
		project.setConnectionFlow(d, c, 'read-write');
		expect(flow()).toBe('read-write');
		project.setConnectionFlow(d, c, null);
		expect(flow()).toBeUndefined();
	});

	it('keeps a Flow through a file, reading an unknown one as unspecified', () => {
		const project = new ProjectDocument();
		const d = project.addDiagram('system');
		const app = project.addComponent(d, 'service', 'App', 0, 0);
		const db = project.addComponent(d, 'database', 'DB', 300, 0);
		project.setConnectionFlow(d, project.addConnection(d, app, db)!, 'write');
		const file = JSON.parse(JSON.stringify(project.toFile()));
		expect(ProjectDocument.fromFile(file).edges(d)[0].flow).toBe('write');
		file.diagrams[0].edges[0].flow = 'stream';
		expect(ProjectDocument.fromFile(file).edges(d)[0].flow).toBeUndefined();
	});
});

describe('Note', () => {
	it('writes, rewrites and recolors a Note, in either kind of Diagram', () => {
		const project = new ProjectDocument();
		for (const kind of ['system', 'mcd'] as const) {
			const d = project.addDiagram(kind);
			const note = project.addNote(d, 10.4, 20.6, 'Nightly sync  \n\n');
			const read = () => project.nodes(d).find((n) => n.id === note)!;
			expect(read()).toMatchObject({ type: 'note', x: 10, y: 21, text: 'Nightly sync' });
			expect(read()).not.toHaveProperty('color');
			project.setNoteText(d, note, 'At 2 a.m.');
			project.setNoteColor(d, note, 'green');
			expect(read()).toMatchObject({ text: 'At 2 a.m.', color: 'green' });
			project.setNoteColor(d, note, 'black' as never);
			expect(read().color).toBe('green');
			project.setNoteColor(d, note, 'yellow');
			expect(read()).not.toHaveProperty('color');
		}
	});

	it('is no end for a Connection and keeps through a file, an unknown color read as yellow', () => {
		const project = new ProjectDocument();
		const d = project.addDiagram('system');
		const api = project.addComponent(d, 'service', 'API', 0, 0);
		const note = project.addNote(d, 300, 0, 'Being replaced');
		expect(project.addConnection(d, api, note)).toBeNull();
		project.setNoteColor(d, note, 'blue');
		const file = JSON.parse(JSON.stringify(project.toFile()));
		expect(ProjectDocument.fromFile(file).nodes(d)[1]).toMatchObject({
			text: 'Being replaced',
			color: 'blue'
		});
		file.diagrams[0].nodes[1].color = 'black';
		expect(ProjectDocument.fromFile(file).nodes(d)[1]).not.toHaveProperty('color');
		// An empty Note is a Note still.
		file.diagrams[0].nodes[1].text = '';
		expect(() => ProjectDocument.fromFile(file)).not.toThrow();
	});
});

describe('Person', () => {
	it('has no Hosting nor Provider, set, kept from another type, read or taken from a Zone', () => {
		const project = new ProjectDocument();
		const d = project.addDiagram('system');
		const buyer = project.addComponent(d, 'person', 'Buyer', 50, 60);
		const node = (id: string) => project.nodes(d).find((n) => n.id === id)!;
		project.setHosting(d, buyer, 'docker');
		project.setProvider(d, buyer, 'aws');
		expect(node(buyer)).not.toHaveProperty('hosting');
		expect(node(buyer)).not.toHaveProperty('provider');
		project.setSkin(d, buyer, 'customer');
		expect(node(buyer).skin).toBe('customer');

		const api = project.addComponent(d, 'service', 'API', 300, 0);
		project.setHosting(d, api, 'docker');
		project.setProvider(d, api, 'aws');
		project.setComponentType(d, api, 'person');
		expect(node(api)).not.toHaveProperty('hosting');
		expect(node(api)).not.toHaveProperty('provider');

		const file = JSON.parse(JSON.stringify(project.toFile()));
		Object.assign(file.diagrams[0].nodes[0], { hosting: 'vm', provider: 'aws' });
		const read = ProjectDocument.fromFile(file).nodes(d)[0];
		expect(read).not.toHaveProperty('hosting');
		expect(read).not.toHaveProperty('provider');

		const zone = project.addZone(d, 0, 0, 600, 300, 'AWS');
		project.setProvider(d, zone, 'aws');
		const providers = effectiveProviders(
			project.nodes(d),
			zoneParents(project.nodes(d), estimatedSize)
		);
		expect(providers.has(buyer)).toBe(false);
	});
});

describe('Runtime', () => {
	it('sets, changes and clears what runs a Service, only on Services', () => {
		const project = new ProjectDocument();
		const d = project.addDiagram('system');
		const api = project.addComponent(d, 'service', 'API', 0, 0);
		const db = project.addComponent(d, 'database', 'DB', 300, 0);
		const node = (id: string) => project.nodes(d).find((n) => n.id === id)!;
		project.setRuntime(d, api, 'bun');
		expect(node(api).runtime).toBe('bun');
		project.setRuntime(d, api, 'cobol' as never);
		expect(node(api).runtime).toBe('bun');
		project.setRuntime(d, db, 'nodejs');
		expect(node(db).runtime).toBeUndefined();
		project.setRuntime(d, api, null);
		expect(node(api).runtime).toBeUndefined();
	});

	it('goes when the Component is no longer a Service, Skin kept where it fits', () => {
		const project = new ProjectDocument();
		const d = project.addDiagram('system');
		const web = project.addComponent(d, 'service', 'Web', 0, 0);
		project.setSkin(d, web, 'caddy');
		project.setRuntime(d, web, 'go');
		project.setComponentType(d, web, 'gateway');
		expect(project.nodes(d)[0]).toMatchObject({ componentType: 'gateway', skin: 'caddy' });
		expect(project.nodes(d)[0].runtime).toBeUndefined();
	});

	it('does not bring back what the old type hid', () => {
		const project = new ProjectDocument();
		const d = project.addDiagram('system');
		const file = JSON.parse(JSON.stringify(project.toFile()));
		// A Client wearing React, from before React became a Service framework; a Runtime a peer left on a Database.
		file.diagrams[0].nodes = [
			{
				id: 'a',
				type: 'component',
				componentType: 'client',
				name: 'Front',
				skin: 'react',
				x: 0,
				y: 0
			},
			{
				id: 'b',
				type: 'component',
				componentType: 'database',
				name: 'DB',
				skin: null,
				runtime: 'go',
				x: 300,
				y: 0
			}
		];
		const read = ProjectDocument.fromFile(file);
		read.setComponentType(d, 'a', 'service');
		read.setComponentType(d, 'b', 'service');
		expect(read.nodes(d).map((n) => [n.skin, n.runtime])).toEqual([
			[null, undefined],
			[null, undefined]
		]);
	});

	it('imports Runtimes, reading an unknown one or one off a Service as unspecified', () => {
		const project = new ProjectDocument();
		const d = project.addDiagram('system');
		project.setRuntime(d, project.addComponent(d, 'service', 'API', 0, 0), 'rust');
		const file = JSON.parse(JSON.stringify(project.toFile()));
		expect(ProjectDocument.fromFile(file).nodes(d)[0].runtime).toBe('rust');
		file.diagrams[0].nodes[0].runtime = 'cobol';
		expect(ProjectDocument.fromFile(file).nodes(d)[0].runtime).toBeUndefined();
		file.diagrams[0].nodes[0].componentType = 'cache';
		file.diagrams[0].nodes[0].runtime = 'go';
		expect(ProjectDocument.fromFile(file).nodes(d)[0].runtime).toBeUndefined();
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
		// Runtimes were Service Skins once: such a Service reads as generic.
		file.diagrams[0].nodes[0].componentType = 'service';
		file.diagrams[0].nodes[0].skin = 'nodejs';
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

describe('Duplicate a Diagram', () => {
	/** An MCD with everything that links elements together. */
	function mcd() {
		const project = new ProjectDocument();
		project.rename('Shop');
		const d = project.addDiagram('mcd', 'Data');
		const [a, b, c] = ['A', 'B', 'C'].map((name) => project.addEntity(d, 10.4, 20, name));
		const association = project.addAssociation(d, a, b, 'links');
		project.addLeg(d, association, c);
		project.addCif(d, association);
		project.setParent(d, c, b);
		const other = project.addAttribute(d, a, 'code');
		const id = (project.nodes(d).find((n) => n.id === a)!.attributes as { id: string }[])[0].id;
		project.setUniqueGroups(d, a, [[id, other]]);
		project.setForeignKeyName(d, project.edges(d)[0].id, 'fk_x');
		project.addNote(d, 5, 5, 'hello');
		project.setTidyDirection(d, 'vertical');
		return { project, d };
	}
	/** Content with each id replaced by its rank, so that two copies compare equal. */
	const shape = (project: ProjectDocument, d: string) => {
		const nodes = project.nodes(d);
		const edges = project.edges(d);
		let text = JSON.stringify({ nodes, edges });
		[...nodes, ...edges].forEach((e, i) => (text = text.replaceAll(e.id, `#${i}`)));
		return JSON.parse(text);
	};

	it('copies every element with ids of its own, its links inside the copy', () => {
		const { project, d } = mcd();
		const copy = project.duplicateDiagram(d);
		expect(shape(project, copy)).toEqual(shape(project, d));
		expect(project.diagram(copy)).toMatchObject({ kind: 'mcd', tidyDirection: 'vertical' });
		const ids = new Set(project.nodes(d).map((n) => n.id));
		expect(project.nodes(copy).some((n) => ids.has(n.id))).toBe(false);
		const before = shape(project, d);
		project.deleteElements(copy, [project.nodes(copy)[0].id], []);
		expect(shape(project, d)).toEqual(before);
	});

	it('goes right after the original, named after it', () => {
		const project = new ProjectDocument();
		const first = project.addDiagram('system', 'One');
		project.addDiagram('system', 'Two');
		const names = () => project.diagrams().map((d) => d.name);
		const copy = project.duplicateDiagram(first);
		expect(project.diagram(copy)!.name).toBe('One copy');
		project.duplicateDiagram(copy);
		project.duplicateDiagram(first, ' Variant ');
		expect(names()).toEqual(['One', 'Variant', 'One copy', 'One copy 2', 'Two']);
		expect(() => project.duplicateDiagram('gone')).toThrow('Unknown diagram');
	});

	it('keeps the order of the tabs', () => {
		vi.useFakeTimers();
		try {
			const project = new ProjectDocument();
			const ids = ['One', 'Two', 'Three'].map((name) => {
				vi.advanceTimersByTime(1000);
				return project.addDiagram('system', name);
			});
			const names = () => project.diagrams().map((d) => d.name);
			project.duplicateDiagram(ids[0]);
			project.duplicateDiagram(ids[2]);
			expect(names()).toEqual(['One', 'One copy', 'Two', 'Three', 'Three copy']);
			const imported = ProjectDocument.fromFile(JSON.parse(JSON.stringify(project.toFile())));
			expect(imported.diagrams().map((d) => d.name)).toEqual(names());
		} finally {
			vi.useRealTimers();
		}
	});

	it('finds its place whatever the dates: equal, used up, malformed or ahead', () => {
		const project = new ProjectDocument();
		const [a, b, c] = ['A', 'B', 'C'].map((name) => project.addDiagram('system', name));
		const names = () => project.diagrams().map((d) => d.name);
		const stored = project.doc.getMap('diagrams') as never as {
			get(id: string): { set(key: string, value: unknown): void };
		};
		for (const id of [a, b, c]) stored.get(id).set('createdAt', 5);
		const [first, second, third] = names();
		project.duplicateDiagram(project.diagrams()[0].id, 'copy');
		expect(names()).toEqual([first, 'copy', second, third]);
		for (let i = 0; i < 80; i++) project.duplicateDiagram(project.diagrams()[0].id, `c${i}`);
		expect(names().slice(0, 3)).toEqual([first, 'c79', 'c78']);
		expect(names().slice(-3)).toEqual(['copy', second, third]);

		const last = project.diagrams().at(-1)!.id;
		stored.get(last).set('createdAt', Date.now() + 1e9);
		project.duplicateDiagram(last, 'ahead');
		project.addDiagram('system', 'new');
		expect(names().slice(-3)).toEqual([third, 'ahead', 'new']);
	});

	it('names a copy whatever the name', () => {
		const project = new ProjectDocument();
		const copyOf = (name: string) =>
			project.diagram(project.duplicateDiagram(project.addDiagram('system', name)))!.name;
		expect(copyOf('X copy 2')).toBe('X copy 3');
		expect(copyOf('Budget copy 2024')).toBe('Budget copy 2025');
		expect(copyOf('copy')).toBe('copy copy');
		const blank = project.addDiagram('system');
		(project.doc.getMap('diagrams') as never as Map<string, Map<string, unknown>>)
			.get(blank)!
			.set('name', '');
		expect(project.diagram(project.duplicateDiagram(blank))!.name).toBe('copy 2');
	});

	it('is one undo step, apart from the edits around it', () => {
		const { project, d } = mcd();
		const copy = project.duplicateDiagram(d);
		project.renameDiagram(copy, 'Variant');
		project.undo();
		expect(project.diagram(copy)!.name).toBe('Data copy');
		project.undo();
		expect(project.diagrams().map((x) => x.id)).toEqual([d]);
		expect(project.nodes(d).length).toBeGreaterThan(0);
	});
});

describe('Move a Diagram', () => {
	function setup(count = 4) {
		const project = new ProjectDocument();
		project.rename('Shop');
		const ids = [...'ABCDEFGH'].slice(0, count).map((name) => project.addDiagram('mcd', name));
		const names = () =>
			project
				.diagrams()
				.map((d) => d.name)
				.join('');
		return { project, ids, names };
	}

	it('goes anywhere, and nowhere else moves', () => {
		for (let from = 0; from < 4; from++) {
			for (let to = 0; to < 4; to++) {
				const { project, ids, names } = setup();
				project.moveDiagram(ids[from], to);
				const expected = [...'ABCD'];
				expected.splice(to, 0, ...expected.splice(from, 1));
				expect(names()).toBe(expected.join(''));
			}
		}
	});

	it('is clamped, one undo step, kept by a file, and leaves new Diagrams last', () => {
		const { project, ids, names } = setup();
		project.moveDiagram(ids[0], 99);
		expect(names()).toBe('BCDA');
		project.renameDiagram(ids[0], 'Z');
		project.undo();
		expect(names()).toBe('BCDA');
		project.undo();
		expect(names()).toBe('ABCD');
		project.moveDiagram(ids[3], -5);
		const file = JSON.parse(JSON.stringify(project.toFile()));
		expect(
			ProjectDocument.fromFile(file)
				.diagrams()
				.map((d) => d.name)
				.join('')
		).toBe('DABC');
		project.addDiagram('system', 'N');
		expect(names()).toBe('DABCN');
		project.duplicateDiagram(ids[3], 'd');
		expect(names()).toBe('DdABCN');
		expect(() => project.moveDiagram('gone', 0)).toThrow('Unknown diagram');
	});

	it('writes nothing when it does not move', () => {
		const { project, ids } = setup();
		let updates = 0;
		project.subscribe(() => updates++);
		project.moveDiagram(ids[1], 1);
		expect(updates).toBe(0);
	});

	it('finds room whatever the dates, however often', () => {
		const { project, ids, names } = setup(3);
		const stored = project.doc.getMap('diagrams') as never as Map<
			string,
			{ set(key: string, value: unknown): void }
		>;
		for (const id of ids) stored.get(id)!.set('createdAt', 5);
		const start = names();
		const last = project.diagrams()[2].id;
		project.moveDiagram(last, 0);
		expect(names()).toBe(start[2] + start[0] + start[1]);
		// Between the same two, over and over.
		for (let i = 0; i < 200; i++) {
			const [a, b, c] = project.diagrams().map((d) => d.name);
			project.moveDiagram(project.diagrams()[2].id, 1);
			expect(names()).toBe(a + c + b);
		}
		for (const bad of ['bad', 1e17, -1e300, Infinity]) {
			for (const id of ids) stored.get(id)!.set('createdAt', bad);
			const before = names();
			project.moveDiagram(project.diagrams()[0].id, 2);
			expect(names()).toBe(before[1] + before[2] + before[0]);
			project.moveDiagram(project.diagrams()[2].id, 0);
			expect(names()).toBe(before);
		}
	});

	it('two peers moving at once end with one order', () => {
		const { project, ids } = setup();
		const other = new ProjectDocument();
		Y.applyUpdate(other.doc, Y.encodeStateAsUpdate(project.doc));
		project.moveDiagram(ids[0], 3);
		other.moveDiagram(ids[3], 0);
		Y.applyUpdate(other.doc, Y.encodeStateAsUpdate(project.doc));
		Y.applyUpdate(project.doc, Y.encodeStateAsUpdate(other.doc));
		const order = (p: ProjectDocument) => p.diagrams().map((d) => d.name);
		expect(order(project)).toEqual(order(other));
		expect([...order(project)].sort()).toEqual([...'ABCD']);
	});
});

describe('A Connection label put along its line', () => {
	function setup() {
		const project = new ProjectDocument();
		project.rename('Shop');
		const d = project.addDiagram('system');
		const [a, b] = ['A', 'B'].map((n) => project.addComponent(d, 'service', n, 0, 0));
		const id = project.addConnection(d, a, b)!;
		const position = () => project.edges(d)[0].labelPosition;
		return { project, d, id, position };
	}

	it('is set within the line, cleared, and undone in one step', () => {
		const { project, d, id, position } = setup();
		project.setLabelPosition(d, id, 0.33333);
		expect(position()).toBe(0.333);
		project.setLabelPosition(d, id, 7);
		expect(position()).toBe(1);
		project.setLabelPosition(d, id, -7);
		expect(position()).toBe(0);
		project.setLabelPosition(d, id, NaN);
		expect(position()).toBe(0);
		project.setLabelPosition(d, id, null);
		expect(project.edges(d)[0]).not.toHaveProperty('labelPosition');
		project.stopCapturing();
		project.setLabelPosition(d, id, 0.5);
		project.undo();
		expect(project.edges(d)[0]).not.toHaveProperty('labelPosition');
		expect(project.edges(d)).toHaveLength(1);
	});

	it('is kept by a move, a file and a paste', () => {
		const { project, d, id } = setup();
		project.setLabelPosition(d, id, 0.25);
		project.moveNode(d, project.nodes(d)[1].id, 500, 300);
		const file = JSON.parse(JSON.stringify(project.toFile()));
		expect(ProjectDocument.fromFile(file).toFile()).toEqual(project.toFile());
		const copy = project.duplicateDiagram(d);
		expect(project.edges(copy)[0].labelPosition).toBe(0.25);
	});

	it('is left out when a file or a peer wrote something else', () => {
		const { project, d, id, position } = setup();
		const stored = project.doc.getMap('diagrams') as never as Map<
			string,
			Map<string, Map<string, { set(key: string, value: unknown): void }>>
		>;
		for (const bad of ['0.5', -0.1, 1.1, NaN, {}, null]) {
			stored.get(d)!.get('edges')!.get(id)!.set('labelPosition', bad);
			expect(position()).toBeUndefined();
			const file = JSON.parse(JSON.stringify(project.toFile()));
			file.diagrams[0].edges[0].labelPosition = bad;
			const imported = ProjectDocument.fromFile(file);
			expect(imported.edges(d)[0].labelPosition).toBeUndefined();
		}
	});
});

describe('The ends of a Connection', () => {
	function setup() {
		const project = new ProjectDocument();
		project.rename('Shop');
		const d = project.addDiagram('system');
		const [a, b, c] = ['A', 'B', 'C'].map((n, i) =>
			project.addComponent(d, 'service', n, i * 400, 0)
		);
		const id = project.addConnection(d, a, b)!;
		project.setEdgeLabel(d, id, 'GET');
		project.setConnectionFlow(d, id, 'read');
		project.setLabelPosition(d, id, 0.3);
		const connection = () => project.edges(d)[0];
		return { project, d, a, b, c, id, connection };
	}

	it('are attached to an Anchor, then automatic again, in one undo step each', () => {
		const { project, d, a, id, connection } = setup();
		project.stopCapturing();
		expect(project.attachConnection(d, id, 'source', a, 'top-left')).toBe(true);
		expect(connection()).toMatchObject({ source: a, sourceAnchor: 'top-left' });
		expect(connection()).not.toHaveProperty('targetAnchor');
		project.stopCapturing();
		project.attachConnection(d, id, 'source', a, null);
		expect(connection()).not.toHaveProperty('sourceAnchor');
		project.undo();
		expect(connection().sourceAnchor).toBe('top-left');
		project.undo();
		expect(connection()).not.toHaveProperty('sourceAnchor');
	});

	it('go to another Component, keeping the label, its place and the Flow, losing old bends', () => {
		const { project, d, a, b, c, id, connection } = setup();
		project.arrange(d, new Map(), new Map([[id, [{ x: 1, y: 2 }]]]));
		expect(connection().points).toBeDefined();
		expect(project.attachConnection(d, id, 'target', c, 'left')).toBe(true);
		expect(connection()).toEqual({
			id,
			type: 'connection',
			source: a,
			target: c,
			label: 'GET',
			flow: 'read',
			labelPosition: 0.3,
			targetAnchor: 'left'
		});
		expect(project.attachEnds(d, id, { componentId: c }, { componentId: b })).toBe(true);
		expect(connection()).toMatchObject({ source: c, target: b, targetAnchor: 'left' });
		expect(project.attachEnds(d, id, { componentId: b }, { componentId: c, anchor: null })).toBe(
			true
		);
		expect(connection()).toMatchObject({ source: b, target: c });
	});

	it('refuse what makes no sense, writing nothing', () => {
		const { project, d, a, b, c, id } = setup();
		const note = project.addNote(d, 0, 0, 'x');
		const zone = project.addZone(d, 0, 0);
		const file = JSON.stringify(project.toFile());
		let updates = 0;
		project.subscribe(() => updates++);
		expect(project.attachConnection(d, id, 'source', b, 'top')).toBe(false);
		for (const bad of [note, zone, 'gone']) {
			expect(project.attachConnection(d, id, 'target', bad, 'top')).toBe(false);
		}
		expect(project.attachConnection(d, id, 'target', c, 'middle' as never)).toBe(false);
		expect(project.attachConnection(d, 'gone', 'target', c, 'top')).toBe(false);
		expect(
			project.attachEnds(d, id, { componentId: c, anchor: 'top' }, { componentId: 'gone' })
		).toBe(false);
		// Already there.
		expect(project.attachConnection(d, id, 'source', a, null)).toBe(true);
		expect(updates).toBe(0);
		expect(JSON.stringify(project.toFile())).toBe(file);
	});

	it('moved by two peers onto one Component make a loop, which can be changed', () => {
		const { project, d, a, c, id, connection } = setup();
		const other = new ProjectDocument();
		Y.applyUpdate(other.doc, Y.encodeStateAsUpdate(project.doc));
		project.attachConnection(d, id, 'source', c, 'top');
		other.attachConnection(d, id, 'target', c, 'left');
		Y.applyUpdate(project.doc, Y.encodeStateAsUpdate(other.doc));
		expect(connection()).toMatchObject({ source: c, target: c });
		expect(project.attachConnection(d, id, 'target', c, 'bottom')).toBe(true);
		expect(connection()).toMatchObject({ target: c, targetAnchor: 'bottom' });
		expect(project.attachEnds(d, id, { componentId: a }, { componentId: a })).toBe(false);
		expect(project.attachConnection(d, id, 'source', a, null)).toBe(true);
		expect(connection()).toMatchObject({ source: a, target: c });
	});

	it('are kept by a file and a paste; what a file or a peer should not have written is left out', () => {
		const { project, d, a, id, connection } = setup();
		project.attachConnection(d, id, 'source', a, 'bottom-right');
		const file = JSON.parse(JSON.stringify(project.toFile()));
		expect(ProjectDocument.fromFile(file).toFile()).toEqual(project.toFile());
		expect(project.edges(project.duplicateDiagram(d))[0].sourceAnchor).toBe('bottom-right');
		const stored = project.doc.getMap('diagrams') as never as Map<
			string,
			Map<string, Map<string, { set(key: string, value: unknown): void }>>
		>;
		for (const bad of ['middle', 'constructor', 3, {}, null]) {
			stored.get(d)!.get('edges')!.get(id)!.set('sourceAnchor', bad);
			expect(connection()).not.toHaveProperty('sourceAnchor');
			file.diagrams[0].edges[0].sourceAnchor = bad;
			expect(ProjectDocument.fromFile(file).edges(d)[0]).not.toHaveProperty('sourceAnchor');
		}
	});
});
