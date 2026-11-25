import { describe, expect, it } from 'vitest';
import type { DataType } from '../data-types.ts';
import { ProjectDocument, type Cardinality } from '../project.ts';
import { deriveMld, snakeCase } from './mld.ts';
import { mldText, postgresScript } from './postgres.ts';

/** Builds an MCD through the Project document, as the app does. */
function mcd() {
	const project = new ProjectDocument();
	const diagram = project.addDiagram('mcd');
	const builder = {
		entity(name: string, attributes: [string, DataType?][] = []) {
			const id = project.addEntity(diagram, 0, 0, name);
			for (const [attribute, type] of attributes) {
				const attributeId = project.addAttribute(diagram, id, attribute);
				if (type) project.setAttributeType(diagram, id, attributeId, type);
			}
			return id;
		},
		/** A binary Association with its Legs' Cardinalities, and optional Attributes. */
		associate(
			name: string,
			[a, cardA]: [string, Cardinality],
			[b, cardB]: [string, Cardinality],
			attributes: string[] = []
		) {
			const id = project.addAssociation(diagram, a, b, name);
			const [legA, legB] = project.edges(diagram).filter((e) => e.source === id);
			project.setCardinality(diagram, legA.id, cardA);
			project.setCardinality(diagram, legB.id, cardB);
			for (const attribute of attributes) project.addAttribute(diagram, id, attribute);
			return id;
		},
		project,
		diagram,
		mld: () => deriveMld(project.nodes(diagram), project.edges(diagram))
	};
	return builder;
}

const int: DataType = { kind: 'integer' };

describe('MLD', () => {
	it('moves the key of the n side into the table of the 1,1 side', () => {
		const m = mcd();
		const customer = m.entity('Customer', [['name']]);
		const invoice = m.entity('Invoice', [['total', { kind: 'decimal', precision: 10, scale: 2 }]]);
		m.associate('issued to', [invoice, '1,1'], [customer, '0,n']);
		expect(mldText(m.mld())).toBe(
			[
				'customer = (id SERIAL, name TEXT);',
				'invoice = (id SERIAL, total NUMERIC(10,2), #customer_id);'
			].join('\n')
		);
	});

	it('makes an n-n Association a table keyed by both foreign keys, with its Attributes', () => {
		const m = mcd();
		const invoice = m.entity('Invoice');
		const product = m.entity('Product');
		m.associate('Contains', [invoice, '1,n'], [product, '0,n'], ['quantity']);
		const mld = m.mld();
		expect(mldText(mld)).toBe(
			[
				'invoice = (id SERIAL);',
				'product = (id SERIAL);',
				'contains = (#invoice_id, #product_id, quantity TEXT);'
			].join('\n')
		);
		expect(mld.tables[2].primaryKey).toEqual(['invoice_id', 'product_id']);
	});

	it('puts a 1-1 key on the 1,1 side with UNIQUE, on the second Entity when tied', () => {
		const m = mcd();
		const person = m.entity('Person');
		const passport = m.entity('Passport');
		m.associate('holds', [person, '0,1'], [passport, '1,1']);
		const mld = m.mld();
		expect(mldText(mld)).toContain('passport = (id SERIAL, #person_id);');
		expect(mld.tables.find((t) => t.name === 'passport')?.unique).toEqual([['person_id']]);

		const n = mcd();
		const a = n.entity('A');
		const b = n.entity('B');
		n.associate('pairs', [a, '1,1'], [b, '1,1']);
		expect(mldText(n.mld())).toContain('b = (id SERIAL, #a_id);');
	});

	it('makes the key and the Attributes of an Association optional on a 0,1 Leg', () => {
		const m = mcd();
		const desk = m.entity('Desk');
		const employee = m.entity('Employee');
		m.associate('sits at', [employee, '0,1'], [desk, '0,n'], ['since']);
		const employeeTable = m.mld().tables.find((t) => t.name === 'employee')!;
		expect(employeeTable.columns.map((c) => [c.name, c.nullable])).toEqual([
			['id', false],
			['desk_id', true],
			['since', true]
		]);
	});

	it('handles reflexive Associations, 1-n and n-n', () => {
		const m = mcd();
		const employee = m.entity('Employee');
		m.associate('manages', [employee, '0,n'], [employee, '0,1']);
		expect(mldText(m.mld())).toBe('employee = (id SERIAL, #employee_id*);');

		const n = mcd();
		const person = n.entity('Person');
		n.associate('knows', [person, '0,n'], [person, '0,n']);
		expect(mldText(n.mld())).toContain('knows = (#person_id, #person_id_knows);');
	});

	it('names the foreign keys of two Associations between the same Entities apart', () => {
		const m = mcd();
		const city = m.entity('City');
		const person = m.entity('Person');
		m.associate('born in', [person, '1,1'], [city, '0,n']);
		m.associate('lives in', [person, '0,1'], [city, '0,n']);
		expect(mldText(m.mld())).toContain('person = (id SERIAL, #city_id, #city_id_lives_in*);');
	});

	it('references a composite key with all its columns', () => {
		const m = mcd();
		const line = m.entity('Line', [['rank', int]]);
		const id = m.project.nodes(m.diagram).find((n) => n.id === line)!;
		const rank = (id.attributes as { id: string; name: string }[]).find((a) => a.name === 'rank')!;
		m.project.toggleIdentifier(m.diagram, line, rank.id);
		const note = m.entity('Note');
		m.associate('about', [note, '1,1'], [line, '0,n']);
		const mld = m.mld();
		expect(mld.tables.find((t) => t.name === 'line')?.primaryKey).toEqual(['id', 'rank']);
		expect(mldText(mld)).toContain('note = (id SERIAL, #line_id, #line_rank);');
	});

	it('warns about an Entity without Identifier and duplicate table names', () => {
		const m = mcd();
		const loose = m.entity('Loose');
		const node = m.project.nodes(m.diagram).find((n) => n.id === loose)!;
		const id = (node.attributes as { id: string }[])[0].id;
		m.project.toggleIdentifier(m.diagram, loose, id);
		m.entity('Customer');
		m.entity('customer');
		const tag = m.entity('Tag');
		m.associate('tags', [tag, '1,1'], [loose, '0,n']);
		const { warnings, tables } = m.mld();
		expect(tables.find((t) => t.name === 'loose')?.primaryKey).toEqual([]);
		expect(warnings).toEqual([
			'Entity "Loose" has no Identifier: table loose has no primary key.',
			'Association "tags" cannot reference loose, which has no primary key.',
			'Two tables are named customer.'
		]);
	});

	it("leaves out an Association's Attributes when it cannot reference its Entity", () => {
		const m = mcd();
		const loose = m.entity('Loose');
		const node = m.project.nodes(m.diagram).find((n) => n.id === loose)!;
		m.project.toggleIdentifier(m.diagram, loose, (node.attributes as { id: string }[])[0].id);
		const tag = m.entity('Tag');
		m.associate('tags', [tag, '1,1'], [loose, '0,n'], ['since']);
		expect(mldText(m.mld())).toContain('tag = (id SERIAL);');
	});

	it('makes an N-ary Association a table keyed by all its foreign keys', () => {
		const m = mcd();
		const teacher = m.entity('Teacher');
		const room = m.entity('Room');
		const slot = m.entity('Slot');
		const teaches = m.associate('teaches', [teacher, '0,n'], [room, '0,n'], ['subject']);
		m.project.addLeg(m.diagram, teaches, slot);
		const { tables, warnings } = m.mld();
		expect(tables.find((t) => t.name === 'teaches')).toMatchObject({
			primaryKey: ['teacher_id', 'room_id', 'slot_id'],
			foreignKeys: [
				{ columns: ['teacher_id'], table: 'teacher' },
				{ columns: ['room_id'], table: 'room' },
				{ columns: ['slot_id'], table: 'slot' }
			]
		});
		expect(mldText(m.mld())).toContain(
			'teaches = (#teacher_id, #room_id, #slot_id, subject TEXT);'
		);
		expect(warnings).toEqual([]);
	});

	it('gives each Leg of an N-ary Association to the same Entity its own column', () => {
		const m = mcd();
		const person = m.entity('Person');
		const event = m.entity('Event');
		const introduces = m.associate('introduces', [person, '0,n'], [person, '0,n']);
		m.project.addLeg(m.diagram, introduces, event);
		const table = m.mld().tables.find((t) => t.name === 'introduces')!;
		expect(new Set(table.primaryKey).size).toBe(3);
	});

	it('takes an N-ary Association to a table even with a max of 1, and warns', () => {
		const m = mcd();
		const teacher = m.entity('Teacher');
		const room = m.entity('Room');
		const slot = m.entity('Slot');
		const teaches = m.associate('teaches', [teacher, '1,1'], [room, '0,n']);
		m.project.addLeg(m.diagram, teaches, slot);
		const { tables, warnings } = m.mld();
		expect(tables.find((t) => t.name === 'teaches')?.primaryKey).toHaveLength(3);
		expect(tables.find((t) => t.name === 'teacher')?.columns.map((c) => c.name)).toEqual(['id']);
		expect(warnings).toEqual([
			'Association "teaches" joins 3 Entities with a max of 1 on Teacher: add a CIF to take it out of the key.'
		]);
	});

	describe('CIF', () => {
		const teaches = (cardinalities: [Cardinality, Cardinality, Cardinality]) => {
			const m = mcd();
			const teacher = m.entity('Teacher');
			const klass = m.entity('Class');
			const subject = m.entity('Subject');
			const id = m.associate('teaches', [teacher, cardinalities[0]], [klass, cardinalities[1]]);
			m.project.addLeg(m.diagram, id, subject);
			const legs = m.project.edges(m.diagram).filter((e) => e.source === id);
			m.project.setCardinality(m.diagram, legs[2].id, cardinalities[2]);
			return { m, id, legs };
		};

		it('takes the determined Leg out of the key, as a NOT NULL column', () => {
			const { m, id, legs } = teaches(['1,1', '0,n', '0,n']);
			const cif = m.project.addCif(m.diagram, id);
			expect(m.project.nodes(m.diagram).find((n) => n.id === cif)).toMatchObject({
				determined: legs[0].id
			});
			const { tables, warnings } = m.mld();
			expect(tables.find((t) => t.name === 'teaches')).toMatchObject({
				primaryKey: ['class_id', 'subject_id'],
				columns: [
					{ name: 'teacher_id', nullable: false },
					{ name: 'class_id' },
					{ name: 'subject_id' }
				]
			});
			expect(warnings).toEqual([]);
			expect(postgresScript(m.mld(), 'School')).toContain('   teacher_id INTEGER NOT NULL,');
		});

		it('keeps the other Legs of a 4-ary in the key with a partial CIF', () => {
			const { m, id, legs } = teaches(['0,n', '0,n', '0,n']);
			const room = m.entity('Room');
			const roomLeg = m.project.addLeg(m.diagram, id, room);
			const cif = m.project.addCif(m.diagram, id);
			// {Teacher, Class} → Subject; Room not involved.
			m.project.setCifRole(m.diagram, cif, legs[2].id, 'determined');
			m.project.setCifRole(m.diagram, cif, roomLeg, 'none');
			expect(m.mld().tables.find((t) => t.name === 'teaches')?.primaryKey).toEqual([
				'teacher_id',
				'class_id',
				'room_id'
			]);
		});

		it('applies a further CIF only while its determinants are still in the key', () => {
			const { m, id, legs } = teaches(['0,n', '0,n', '0,n']);
			// {Teacher, Class} → Subject, then {Teacher, Subject} → Class: Subject has left the key.
			const first = m.project.addCif(m.diagram, id);
			const second = m.project.addCif(m.diagram, id);
			m.project.setCifRole(m.diagram, second, legs[1].id, 'determined');
			m.project.setCifRole(m.diagram, second, legs[2].id, 'determinant');
			expect(m.project.nodes(m.diagram).find((n) => n.id === first)).toMatchObject({
				determined: legs[2].id
			});
			const { tables, warnings } = m.mld();
			expect(tables.find((t) => t.name === 'teaches')?.primaryKey).toEqual([
				'teacher_id',
				'class_id'
			]);
			expect(warnings).toEqual([
				'A CIF on "teaches" is not applied: Subject is no longer in the key.'
			]);
		});

		it('is ignored, with a warning, on an Association that is binary again', () => {
			const { m, id, legs } = teaches(['0,n', '0,n', '0,n']);
			m.project.addCif(m.diagram, id);
			m.project.deleteElements(m.diagram, [], [legs[0].id]);
			const { tables, warnings } = m.mld();
			expect(tables.find((t) => t.name === 'teaches')?.primaryKey).toEqual([
				'class_id',
				'subject_id'
			]);
			expect(warnings).toEqual([
				'The CIF on "teaches" is ignored: a CIF needs an Association with three Legs or more.'
			]);
		});
	});

	describe('Relative identifier', () => {
		/** An Entity whose only Attribute is a plain Identifier, not an auto-increment. */
		const keyed = (m: ReturnType<typeof mcd>, name: string, key: string) => {
			const id = m.entity(name, [[key, { kind: 'integer' }]]);
			const node = m.project.nodes(m.diagram).find((n) => n.id === id)!;
			const [auto, own] = node.attributes as { id: string }[];
			m.project.removeAttribute(m.diagram, id, auto.id);
			m.project.toggleIdentifier(m.diagram, id, own.id);
			return id;
		};
		/** `weak` identified relative to `strong` through a 1,1 R / 0,n Association. */
		const relate = (m: ReturnType<typeof mcd>, name: string, weak: string, strong: string) => {
			const id = m.associate(name, [weak, '1,1'], [strong, '0,n']);
			const leg = m.project.edges(m.diagram).find((e) => e.source === id && e.target === weak)!;
			m.project.setRelative(m.diagram, leg.id, true);
			return id;
		};

		it('keys the dependent table by the foreign key, then its own Identifier', () => {
			const m = mcd();
			const order = m.entity('Order');
			const line = keyed(m, 'Line', 'number');
			relate(m, 'of', line, order);
			expect(mldText(m.mld())).toBe(
				['order = (id SERIAL);', 'line = (#order_id, number INTEGER);'].join('\n')
			);
			expect(m.mld().tables[1].primaryKey).toEqual(['order_id', 'number']);
			expect(m.mld().warnings).toEqual([]);
		});

		it('composes chains and gives a foreign key to a dependent Entity its whole key', () => {
			const m = mcd();
			const building = m.entity('Building');
			const floor = keyed(m, 'Floor', 'level');
			const room = keyed(m, 'Room', 'number');
			const booking = m.entity('Booking');
			// Room first, so that the pass has to wait for Floor.
			relate(m, 'on', room, floor);
			relate(m, 'in', floor, building);
			m.associate('books', [booking, '1,1'], [room, '0,n']);
			const tables = m.mld().tables;
			expect(tables.find((t) => t.name === 'room')?.primaryKey).toEqual([
				'floor_building_id',
				'floor_level',
				'number'
			]);
			expect(tables.find((t) => t.name === 'booking')?.foreignKeys).toEqual([
				{
					name: 'fk_booking_room_floor_building_id_room_floor_level_room_number',
					columns: ['room_floor_building_id', 'room_floor_level', 'room_number'],
					table: 'room',
					references: ['floor_building_id', 'floor_level', 'number']
				}
			]);
		});

		it('keys an Entity by every Entity it is relative to', () => {
			const m = mcd();
			const student = m.entity('Student');
			const session = m.entity('Session');
			const enrolment = keyed(m, 'Enrolment', 'rank');
			relate(m, 'by', enrolment, student);
			relate(m, 'for', enrolment, session);
			expect(m.mld().tables.find((t) => t.name === 'enrolment')?.primaryKey).toEqual([
				'student_id',
				'session_id',
				'rank'
			]);
		});

		it('gives a dependent parent’s children its whole key', () => {
			const m = mcd();
			const order = m.entity('Order');
			const line = keyed(m, 'Line', 'number');
			relate(m, 'of', line, order);
			const special = m.entity('Special');
			const node = m.project.nodes(m.diagram).find((n) => n.id === special)!;
			m.project.removeAttribute(m.diagram, special, (node.attributes as { id: string }[])[0].id);
			m.project.setParent(m.diagram, special, line);
			expect(m.mld().tables.find((t) => t.name === 'special')?.foreignKeys).toEqual([
				{
					name: 'fk_special_line_order_id_line_number',
					columns: ['line_order_id', 'line_number'],
					table: 'line',
					references: ['order_id', 'number']
				}
			]);
		});

		it('ignores the relative identifier of an Inheritance child', () => {
			const m = mcd();
			const person = m.entity('Person');
			const school = m.entity('School');
			const student = keyed(m, 'Student', 'rank');
			m.project.setParent(m.diagram, student, person);
			relate(m, 'at', student, school);
			expect(m.mld().warnings).toContain(
				'The relative identifier of Student is ignored: an Inheritance child takes its key from its parent.'
			);
		});

		it('says once that a strong Entity without key cannot be referenced', () => {
			const m = mcd();
			const order = m.entity('Order');
			const node = m.project.nodes(m.diagram).find((n) => n.id === order)!;
			m.project.toggleIdentifier(m.diagram, order, (node.attributes as { id: string }[])[0].id);
			const line = keyed(m, 'Line', 'number');
			relate(m, 'of', line, order);
			expect(
				m.mld().warnings.filter((w) => w.startsWith('Association "of" cannot reference'))
			).toHaveLength(1);
		});

		it('ignores a cycle of relative identifiers, naming apart what depends on it', () => {
			const m = mcd();
			const a = keyed(m, 'A', 'x');
			const b = keyed(m, 'B', 'y');
			const c = keyed(m, 'C', 'z');
			relate(m, 'ab', a, b);
			relate(m, 'ba', b, a);
			relate(m, 'ca', c, a);
			expect(m.mld().warnings).toContain(
				'The relative identifiers of A, B form a cycle: they are ignored, with those depending on them (C).'
			);
		});

		it('ignores a cycle of relative identifiers, with a warning', () => {
			const m = mcd();
			const a = keyed(m, 'A', 'x');
			const b = keyed(m, 'B', 'y');
			relate(m, 'ab', a, b);
			relate(m, 'ba', b, a);
			expect(m.mld().warnings).toContain(
				'The relative identifiers of A, B form a cycle: they are ignored.'
			);
			expect(m.mld().tables.find((t) => t.name === 'a')?.primaryKey).toEqual(['x']);
		});
	});

	describe('Inheritance', () => {
		/** Person (id, name) with children Student (school) and Teacher (subject), no Identifier of their own. */
		const people = () => {
			const m = mcd();
			const person = m.entity('Person', [['name']]);
			const child = (name: string, attribute: string) => {
				const id = m.entity(name, [[attribute]]);
				const node = m.project.nodes(m.diagram).find((n) => n.id === id)!;
				const own = (node.attributes as { id: string; identifier: boolean }[]).find(
					(a) => a.identifier
				)!;
				m.project.toggleIdentifier(m.diagram, id, own.id);
				m.project.removeAttribute(m.diagram, id, own.id);
				m.project.setParent(m.diagram, id, person);
				return id;
			};
			const student = child('Student', 'school');
			const teacher = child('Teacher', 'subject');
			const inheritance = m.project.nodes(m.diagram).find((n) => n.type === 'inheritance')!.id;
			return { m, person, student, teacher, inheritance };
		};

		it('by reference: each child keyed by a foreign key to its parent', () => {
			const { m } = people();
			expect(mldText(m.mld())).toBe(
				[
					'person = (id SERIAL, name TEXT);',
					'student = (#person_id, school TEXT);',
					'teacher = (#person_id, subject TEXT);'
				].join('\n')
			);
			expect(m.mld().warnings).toEqual([]);
		});

		it('by reference, nested: a grandchild references its parent’s table', () => {
			const { m, student } = people();
			const phd = m.entity('Phd', [['thesis']]);
			const node = m.project.nodes(m.diagram).find((n) => n.id === phd)!;
			m.project.removeAttribute(m.diagram, phd, (node.attributes as { id: string }[])[0].id);
			m.project.setParent(m.diagram, phd, student);
			expect(mldText(m.mld())).toContain('phd = (#student_person_id, thesis TEXT);');
		});

		it('warns that a child’s own Identifier is ignored', () => {
			const m = mcd();
			const person = m.entity('Person');
			const student = m.entity('Student');
			m.project.setParent(m.diagram, student, person);
			expect(m.mld().warnings).toEqual([
				'Entity "Student" inherits its Identifier from Person: its own is ignored.'
			]);
			expect(mldText(m.mld())).toContain('student = (#person_id);');
		});

		it('push down: no parent table, its Attributes in each child; an Association to it is left out', () => {
			const { m, person, inheritance } = people();
			m.project.setInheritanceTranslation(m.diagram, inheritance, 'down');
			const city = m.entity('City');
			m.associate('lives in', [person, '1,1'], [city, '0,n']);
			const { tables, warnings } = m.mld();
			expect(mldText(m.mld())).toBe(
				[
					'student = (id SERIAL, name TEXT, school TEXT);',
					'teacher = (id SERIAL, name TEXT, subject TEXT);',
					'city = (id SERIAL);'
				].join('\n')
			);
			expect(tables.some((t) => t.name === 'person')).toBe(false);
			expect(warnings).toEqual([
				'Association "lives in" is left out: Person is pushed down into its children.'
			]);
		});

		it('push up: one parent table with the children’s Attributes and a checked type column', () => {
			const { m, person, student, inheritance } = people();
			m.project.setInheritanceTranslation(m.diagram, inheritance, 'up');
			m.project.setInheritanceConstraint(m.diagram, inheritance, 'XT');
			const school = m.entity('School');
			m.associate('enrolled', [student, '1,1'], [school, '0,n']);
			const { tables } = m.mld();
			expect(tables.map((t) => t.name)).toEqual(['school', 'person']);
			expect(tables[1].columns).toMatchObject([
				{ name: 'id' },
				{ name: 'name' },
				{ name: 'person_type', nullable: false, check: ['Student', 'Teacher'] },
				{ name: 'school', nullable: true },
				{ name: 'subject', nullable: true },
				{ name: 'school_id', foreign: true }
			]);
			const script = postgresScript(m.mld(), 'People');
			expect(script).toContain(
				"   person_type VARCHAR(50) NOT NULL CHECK (person_type IN ('Student', 'Teacher')),"
			);
			void person;
		});

		it('push down: notes the Persons it cannot store, and warns of a parent without key', () => {
			const { m, person, inheritance } = people();
			m.project.setInheritanceTranslation(m.diagram, inheritance, 'down');
			expect(m.mld().notes).toEqual([
				'Inheritance of Person pushed down: a Person that is none of Student, Teacher cannot be stored.'
			]);
			const node = m.project.nodes(m.diagram).find((n) => n.id === person)!;
			const id = (node.attributes as { id: string; identifier: boolean }[]).find(
				(a) => a.identifier
			)!;
			m.project.toggleIdentifier(m.diagram, person, id.id);
			expect(m.mld().warnings).toEqual([
				'Entity "Person" has no Identifier: the tables it is pushed down into have no primary key.'
			]);
		});

		it('translates by reference a push down under a pushed-up parent', () => {
			const { m, student, inheritance } = people();
			m.project.setInheritanceTranslation(m.diagram, inheritance, 'up');
			const phd = m.entity('Phd', [['thesis']]);
			const node = m.project.nodes(m.diagram).find((n) => n.id === phd)!;
			m.project.removeAttribute(m.diagram, phd, (node.attributes as { id: string }[])[0].id);
			m.project.setParent(m.diagram, phd, student);
			const below = m.project
				.nodes(m.diagram)
				.find((n) => n.type === 'inheritance' && n.parent === student)!.id;
			m.project.setInheritanceTranslation(m.diagram, below, 'down');
			expect(m.mld().warnings).toContain(
				'Inheritance of Student cannot be pushed down: Student is pushed up into its own parent. Translated by reference.'
			);
			expect(mldText(m.mld())).toContain('phd = (#person_id, thesis TEXT);');
		});

		it('notes in the script what a translation does not enforce', () => {
			const { m, inheritance } = people();
			m.project.setInheritanceConstraint(m.diagram, inheritance, 'XT');
			expect(m.mld().notes).toEqual([
				'Inheritance of Person: XT (a Person is exactly one of Student, Teacher) is not enforced by this script.'
			]);
			expect(postgresScript(m.mld(), 'People')).toContain(
				'-- Note: Inheritance of Person: XT (a Person is exactly one of Student, Teacher) is not enforced by this script.'
			);
			m.project.setInheritanceTranslation(m.diagram, inheritance, 'up');
			m.project.setInheritanceConstraint(m.diagram, inheritance, 'T');
			expect(m.mld().notes).toEqual([
				'Inheritance of Person pushed up: one type per row, so a Person is at most one of Student, Teacher.'
			]);
		});
	});

	it('names tables and columns in snake_case', () => {
		expect(snakeCase('Bon de commande')).toBe('bon_de_commande');
		expect(snakeCase('Adresse électronique')).toBe('adresse_electronique');
		expect(snakeCase('orderLine')).toBe('order_line');
		expect(snakeCase('2025 sales')).toBe('_2025_sales');
		expect(snakeCase('!!')).toBe('unnamed');
	});
});

describe('PostgreSQL script', () => {
	it('creates the tables with types, NOT NULL, keys and quoted reserved words', () => {
		const m = mcd();
		const customer = m.entity('Customer', [['email', { kind: 'varchar', length: 120 }]]);
		const order = m.entity('Order', [['placed at', { kind: 'datetime' }]]);
		m.associate('places', [order, '1,1'], [customer, '0,n']);
		expect(postgresScript(m.mld(), 'MCD')).toBe(
			[
				'-- MCD\n-- Generated by Simple Modelisation.',
				'CREATE TABLE customer (\n   id SERIAL,\n   email VARCHAR(120) NOT NULL,\n   PRIMARY KEY (id)\n);',
				'CREATE TABLE "order" (\n   id SERIAL,\n   placed_at TIMESTAMP NOT NULL,\n   customer_id INTEGER NOT NULL,\n   PRIMARY KEY (id),\n   CONSTRAINT fk_order_customer_id FOREIGN KEY (customer_id) REFERENCES customer (id)\n);'
			].join('\n\n') + '\n'
		);
	});

	it('writes JSON as JSONB and a Blob as BYTEA', () => {
		const m = mcd();
		m.entity('File', [
			['metadata', { kind: 'json' }],
			['content', { kind: 'blob' }]
		]);
		expect(mldText(m.mld())).toBe('file = (id SERIAL, metadata JSONB, content BYTEA);');
		expect(postgresScript(m.mld(), 'MCD')).toContain(
			'   metadata JSONB NOT NULL,\n   content BYTEA NOT NULL,\n'
		);
	});

	it('adds the foreign keys of a reference cycle after the tables', () => {
		const m = mcd();
		const a = m.entity('A');
		const b = m.entity('B');
		m.associate('a to b', [a, '1,1'], [b, '0,n']);
		m.associate('b to a', [b, '1,1'], [a, '0,n']);
		const script = postgresScript(m.mld(), 'MCD');
		// a is created first: its key to b waits; b's key to a is inline.
		expect(script).toContain('   CONSTRAINT fk_b_a_id FOREIGN KEY (a_id) REFERENCES a (id)\n);');
		expect(
			script
				.trimEnd()
				.endsWith('ALTER TABLE a ADD CONSTRAINT fk_a_b_id FOREIGN KEY (b_id) REFERENCES b (id);')
		).toBe(true);
	});

	it('puts the warnings at the top as comments', () => {
		const m = mcd();
		m.entity('Customer');
		m.entity('customer');
		expect(postgresScript(m.mld(), 'MCD')).toContain('-- Warning: Two tables are named customer.');
	});

	it('keeps names with line breaks inside their comments', () => {
		const m = mcd();
		// An Entity without Identifier and an Association that cannot reference it: both warn with the name.
		const loose = m.entity('Loose\nDROP TABLE x;');
		const node = m.project.nodes(m.diagram).find((n) => n.id === loose)!;
		m.project.toggleIdentifier(m.diagram, loose, (node.attributes as { id: string }[])[0].id);
		const tag = m.entity('Tag');
		m.associate('tags\r\nDROP TABLE y;', [tag, '1,1'], [loose, '0,n']);
		const script = postgresScript(m.mld(), 'Shop\u2028DROP TABLE z;');
		const header = script.slice(0, script.indexOf('CREATE TABLE'));
		expect(
			header
				.trim()
				.split('\n')
				.every((line) => line.startsWith('-- '))
		).toBe(true);
		expect(header).toContain('-- Shop DROP TABLE z;');
		expect(header).toContain('Entity "Loose DROP TABLE x;" has no Identifier');
		expect(header).toContain('Association "tags DROP TABLE y;" cannot reference');
	});
});
