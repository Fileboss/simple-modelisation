import { describe, expect, it } from 'vitest';
import type { DataType } from '../document/data-types';
import { ProjectDocument, type Cardinality } from '../document/project';
import { deriveMld, snakeCase } from './mld';
import { mldText, postgresScript } from './postgres';

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
				'CREATE TABLE "order" (\n   id SERIAL,\n   placed_at TIMESTAMP NOT NULL,\n   customer_id INTEGER NOT NULL,\n   PRIMARY KEY (id),\n   FOREIGN KEY (customer_id) REFERENCES customer (id)\n);'
			].join('\n\n') + '\n'
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
		expect(script).toContain('   FOREIGN KEY (a_id) REFERENCES a (id)\n);');
		expect(
			script.trimEnd().endsWith('ALTER TABLE a ADD FOREIGN KEY (b_id) REFERENCES b (id);')
		).toBe(true);
	});

	it('puts the warnings at the top as comments', () => {
		const m = mcd();
		m.entity('Customer');
		m.entity('customer');
		expect(postgresScript(m.mld(), 'MCD')).toContain('-- Warning: Two tables are named customer.');
	});
});
