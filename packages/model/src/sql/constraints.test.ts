import { describe, expect, it } from 'vitest';
import { pasteable, ProjectDocument, type Attribute, type EntityNode } from '../project.ts';
import { checkProblem, cleanCheck, cleanComment, isForeignKeyName } from './constraints.ts';
import { deriveMld } from './mld.ts';
import { postgresScript } from './postgres.ts';

function setup() {
	const project = new ProjectDocument();
	project.rename('Shop');
	const diagram = project.addDiagram('mcd');
	const entity = (name: string, ...attributes: string[]) => {
		const id = project.addEntity(diagram, 0, 0, name);
		for (const a of attributes) project.addAttribute(diagram, id, a);
		return id;
	};
	const node = (id: string) => project.nodes(diagram).find((n) => n.id === id) as EntityNode;
	const attribute = (id: string, name: string) =>
		node(id).attributes.find((a) => a.name === name) as Attribute;
	const mld = () => deriveMld(project.nodes(diagram), project.edges(diagram));
	const sql = () => postgresScript(mld(), 'MCD');
	const legs = (association: string) =>
		project.edges(diagram).filter((e) => e.source === association);
	const link = (a: string, ca: '0,1' | '1,1' | '0,n', b: string, cb: '0,1' | '1,1' | '0,n') => {
		const id = project.addAssociation(diagram, a, b, 'links');
		const [la, lb] = legs(id);
		project.setCardinality(diagram, la.id, ca);
		project.setCardinality(diagram, lb.id, cb);
		return id;
	};
	return { project, diagram, entity, node, attribute, mld, sql, legs, link };
}

describe('Check rules', () => {
	it.each([
		'price >= 0',
		"status IN ('new', 'it''s; done --ok /* $ \\ )')",
		'char_length(name) > (2 + 1)',
		`"order" <> 'x'`,
		"email ~ '^\\w+@'",
		"type = 'e' AND name <> 'a'"
	])('takes %s', (text) => expect(checkProblem(text)).toBeNull());

	it.each([
		'',
		'a > 0); DROP TABLE customer; --',
		'a > 0) OR (b > 0',
		'(a > 0',
		'a > 0;',
		'a > 0 -- rest',
		'a > 0 /* rest',
		"a = 'open",
		'"open = 1',
		'a = $$x$$',
		'a = \\echo',
		"a = E'x\\') ; DROP TABLE t; --'",
		"a = e'x'",
		"a = 'x\\'",
		"a = 'x\\'' ",
		'a > 0\nOR TRUE',
		'x'.repeat(501)
	])('refuses %j', (text) => expect(checkProblem(text)).toBeTypeOf('string'));

	it('cleans a long text in one pass, and keeps line breaks in quotes to refuse them', () => {
		const started = Date.now();
		cleanCheck(`x${' '.repeat(200_000)}x`);
		expect(Date.now() - started).toBeLessThan(500);
		expect(checkProblem(cleanCheck("a <> 'x\n  y'"))).toBe('lines');
	});

	it('stores one line', () =>
		expect(cleanCheck(' a > 0\r\n  AND b > 0 ')).toBe('a > 0    AND b > 0'));
});

describe('Comment and foreign key name rules', () => {
	it('cleans a Comment', () => {
		expect(cleanComment(' a\r\nb\u0000 ')).toBe('a\nb');
		expect(cleanComment('x'.repeat(2000))).toHaveLength(1000);
	});
	it('takes plain names only', () => {
		for (const ok of ['fk_a', '_x', 'FK_Order2', 'x'.repeat(63)]) {
			expect(isForeignKeyName(ok)).toBe(true);
		}
		for (const bad of ['', '2x', 'a b', 'a"b', 'é', 'x'.repeat(64), 3, null]) {
			expect(isForeignKeyName(bad)).toBe(false);
		}
	});
});

describe('Constraints in the SQL', () => {
	it('writes UNIQUE, CHECK and COMMENT ON', () => {
		const { project, diagram, entity, attribute, sql } = setup();
		const id = entity('Product', 'sku', 'year', 'number', 'unit price');
		project.setAttributeUnique(diagram, id, attribute(id, 'sku').id, true);
		project.setAttributeCheck(diagram, id, attribute(id, 'unit price').id, 'unit_price >= 0');
		project.setAttributeComment(diagram, id, attribute(id, 'sku').id, "The shop's code");
		project.setComment(diagram, id, 'What we sell');
		project.setUniqueGroups(diagram, id, [[attribute(id, 'year').id, attribute(id, 'number').id]]);
		expect(sql()).toContain('   unit_price TEXT NOT NULL CHECK (unit_price >= 0)');
		expect(sql()).toContain('   UNIQUE (sku),\n   UNIQUE (year, number)\n);');
		expect(sql()).toContain(
			"COMMENT ON TABLE product IS 'What we sell';\nCOMMENT ON COLUMN product.sku IS 'The shop''s code';"
		);
	});

	it('does not write UNIQUE on the primary key, nor twice', () => {
		const { project, diagram, entity, attribute, sql } = setup();
		const id = entity('Product', 'a', 'b');
		project.setAttributeUnique(diagram, id, attribute(id, 'id').id, true);
		const [a, b] = [attribute(id, 'a').id, attribute(id, 'b').id];
		project.setUniqueGroups(diagram, id, [[a, b], [b, a], [a], [a, 'gone']]);
		expect(sql().match(/UNIQUE/g)).toHaveLength(1);
	});

	it('warns when a Check no longer names its column', () => {
		const { project, diagram, entity, attribute, mld } = setup();
		const id = entity('Product', 'price');
		project.setAttributeCheck(diagram, id, attribute(id, 'price').id, 'price >= 0');
		expect(mld().warnings).toEqual([]);
		project.renameAttribute(diagram, id, attribute(id, 'price').id, 'cost');
		expect(mld().warnings).toEqual([
			'The Check of "cost" in product does not name its column cost.'
		]);
	});

	it('takes the name of the Leg that receives the key, else the other one', () => {
		const { project, diagram, entity, sql, legs, link } = setup();
		const invoice = entity('Invoice');
		const customer = entity('Customer');
		const association = link(invoice, '1,1', customer, '0,n');
		project.setComment(diagram, association, 'Who pays');
		expect(sql()).toContain('CONSTRAINT fk_invoice_customer_id FOREIGN KEY');
		const [own, other] = legs(association);
		project.setForeignKeyName(diagram, other.id, 'fk_other');
		expect(sql()).toContain('CONSTRAINT fk_other FOREIGN KEY');
		project.setForeignKeyName(diagram, own.id, 'FK_Payer');
		expect(sql()).toContain('CONSTRAINT "FK_Payer" FOREIGN KEY');
		expect(sql()).toContain(`COMMENT ON CONSTRAINT "FK_Payer" ON invoice IS 'Who pays';`);
		project.setForeignKeyName(diagram, own.id, null);
		project.setForeignKeyName(diagram, other.id, null);
		expect(sql()).toContain('CONSTRAINT fk_invoice_customer_id FOREIGN KEY');
		expect(() => project.setForeignKeyName(diagram, own.id, 'a b')).toThrow('foreign key name');
	});

	it('names each key of an Association table, and numbers a name given twice', () => {
		const { project, diagram, entity, sql, mld, legs, link } = setup();
		const association = link(entity('A'), '0,n', entity('B'), '0,n');
		for (const leg of legs(association)) project.setForeignKeyName(diagram, leg.id, 'fk_same');
		expect(sql()).toContain('CONSTRAINT fk_same FOREIGN KEY (a_id)');
		expect(sql()).toContain('CONSTRAINT fk_same_2 FOREIGN KEY (b_id)');
		expect(mld().warnings).toEqual([
			'Two foreign keys of links are named fk_same: one is numbered.'
		]);
	});

	it('never numbers a repeat into a name given to another key', () => {
		const { project, diagram, entity, sql, legs, link } = setup();
		const association = link(entity('A'), '0,n', entity('B'), '0,n');
		project.addLeg(diagram, association, entity('C'));
		const names = ['fk_a', 'fk_a', 'fk_a_2'];
		legs(association).forEach((leg, i) => project.setForeignKeyName(diagram, leg.id, names[i]));
		expect(sql()).toContain('CONSTRAINT fk_a_3 FOREIGN KEY');
		expect(sql()).toContain('CONSTRAINT fk_a_2 FOREIGN KEY (c_id)');
	});

	it('writes a Comment with a backslash so that it reads the same everywhere', () => {
		const { project, diagram, entity, sql } = setup();
		project.setComment(diagram, entity('A'), "a\\'; DROP TABLE x; --");
		expect(sql()).toContain("IS E'a\\\\''; DROP TABLE x; --';");
	});

	it('says what is wrong with a child Entity once, in the table it ends up in', () => {
		const { project, diagram, entity, attribute, mld } = setup();
		const child = entity('Employee', 'badge');
		project.setAttributeCheck(diagram, child, attribute(child, 'badge').id, 'x > 0');
		project.setParent(diagram, child, entity('Person'));
		const inheritance = project.nodes(diagram).find((n) => n.type === 'inheritance')!;
		const checks = () => mld().warnings.filter((w) => w.includes('Check'));
		expect(checks()).toEqual([expect.stringContaining('in employee')]);
		project.setInheritanceTranslation(diagram, inheritance.id, 'down');
		expect(checks()).toEqual([expect.stringContaining('in employee')]);
		project.setInheritanceTranslation(diagram, inheritance.id, 'up');
		expect(checks()).toEqual([expect.stringContaining('in person')]);
	});

	it('cuts a long generated name to what PostgreSQL keeps', () => {
		const { entity, mld, link } = setup();
		link(entity('Invoice'), '1,1', entity('A'.padEnd(80, 'b')), '0,n');
		expect(mld().tables.find((t) => t.name === 'invoice')!.foreignKeys[0].name).toHaveLength(63);
	});

	it('follows an Inheritance: the link names the key, a Comment without a table is said', () => {
		const { project, diagram, entity, attribute, mld, sql } = setup();
		const person = entity('Person');
		const employee = entity('Employee', 'badge');
		project.setComment(diagram, employee, 'On payroll');
		project.setAttributeUnique(diagram, employee, attribute(employee, 'badge').id, true);
		project.setParent(diagram, employee, person);
		const isa = () => project.edges(diagram).find((e) => e.type === 'isa')!;
		project.setForeignKeyName(diagram, isa().id, 'fk_is_person');
		project.setParent(diagram, employee, person);
		expect(sql()).toContain('CONSTRAINT fk_is_person FOREIGN KEY (person_id)');
		expect(sql()).toContain("COMMENT ON TABLE employee IS 'On payroll';");
		const inheritance = project.nodes(diagram).find((n) => n.type === 'inheritance')!;
		project.setInheritanceTranslation(diagram, inheritance.id, 'up');
		expect(sql()).toContain('UNIQUE (badge)');
		expect(sql()).not.toContain('COMMENT ON');
		expect(mld().notes).toContain(
			'The Comment of Employee is left out: it has no table of its own, its columns are in Person.'
		);
	});
});

describe('Constraints in the Project document', () => {
	it('takes a removed Attribute out of the Unique groups, undone together', () => {
		const { project, diagram, entity, attribute, node } = setup();
		const id = entity('Product', 'a', 'b', 'c');
		const ids = ['a', 'b', 'c'].map((name) => attribute(id, name).id);
		project.setUniqueGroups(diagram, id, [ids, [ids[0], ids[1]]]);
		project.stopCapturing();
		project.removeAttribute(diagram, id, ids[0]);
		expect(node(id).uniques).toEqual([[ids[1], ids[2]]]);
		project.undo();
		expect(node(id).uniques).toEqual([ids, [ids[0], ids[1]]]);
	});

	it('refuses a bad Check, clears with an empty one', () => {
		const { project, diagram, entity, attribute } = setup();
		const id = entity('Product', 'a');
		const a = attribute(id, 'a').id;
		expect(() => project.setAttributeCheck(diagram, id, a, 'a > 0)')).toThrow('parentheses');
		project.setAttributeCheck(diagram, id, a, 'a > 0');
		project.setAttributeCheck(diagram, id, a, ' ');
		expect(attribute(id, 'a')).not.toHaveProperty('check');
	});

	it('keeps everything through a file and a paste', () => {
		const { project, diagram, entity, attribute, node, legs, link } = setup();
		const id = entity('Product', 'a', 'b');
		const [a, b] = [attribute(id, 'a').id, attribute(id, 'b').id];
		project.setAttributeUnique(diagram, id, a, true);
		project.setAttributeCheck(diagram, id, a, "a <> ''");
		project.setAttributeComment(diagram, id, a, 'A');
		project.setComment(diagram, id, 'P');
		project.setUniqueGroups(diagram, id, [[a, b]]);
		const association = link(id, '1,1', entity('Other'), '0,n');
		project.setForeignKeyName(diagram, legs(association)[0].id, 'fk_x');
		const file = JSON.parse(JSON.stringify(project.toFile()));
		expect(ProjectDocument.fromFile(file).toFile()).toEqual(project.toFile());
		const pasted = pasteable(
			{ nodes: project.nodes(diagram), edges: project.edges(diagram) },
			'mcd'
		);
		expect(pasted.nodes.find((n) => n.id === id)).toEqual(node(id));
		expect(pasted.edges.find((e) => e.fkName)).toMatchObject({ fkName: 'fk_x' });
	});

	it('leaves out what a file or a peer should not have written', () => {
		const { project, diagram, entity, attribute, node, legs, link, sql } = setup();
		const id = entity('Product', 'a');
		const association = link(id, '1,1', entity('Other'), '0,n');
		const raw = project.doc.getMap('diagrams').get(diagram) as never as {
			get(key: string): {
				get(id: string): { get(k: string): never; set(k: string, v: unknown): void };
			};
		};
		const bad = { unique: 'yes', check: 'a > 0); DROP TABLE x; --', comment: 3 };
		raw
			.get('nodes')
			.get(id)
			.set('attributes', [{ ...attribute(id, 'a'), ...bad }]);
		raw.get('nodes').get(id).set('uniques', 'nope');
		raw.get('nodes').get(id).set('comment', { a: 1 });
		raw.get('edges').get(legs(association)[0].id).set('fkName', 'x; DROP TABLE y');
		expect(Object.keys(node(id).attributes[0]).sort()).toEqual(
			['id', 'identifier', 'name', 'optional', 'type'].sort()
		);
		expect(node(id)).not.toHaveProperty('uniques');
		expect(node(id)).not.toHaveProperty('comment');
		expect(sql()).not.toContain('DROP');
	});
});
