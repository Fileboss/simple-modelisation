import { dataType, type DataType } from '../data-types.ts';
import type {
	AssociationNode,
	Attribute,
	Cardinality,
	CifNode,
	InheritanceNode,
	DiagramEdge,
	DiagramNode,
	EntityNode,
	LegEdge
} from '../project.ts';

export type Column = {
	name: string;
	type: DataType;
	nullable: boolean;
	/** Set on the columns of a foreign key. */
	foreign?: boolean;
	/** The only values allowed (an Inheritance's type column). */
	check?: string[];
};

export type ForeignKey = {
	columns: string[];
	table: string;
	references: string[];
};

export type Table = {
	name: string;
	columns: Column[];
	primaryKey: string[];
	foreignKeys: ForeignKey[];
	/** Column groups that must be unique (the foreign key of a 1-1 Association). */
	unique: string[][];
};

/**
 * The relational model of an MCD: its tables, referenced ones first, what is
 * wrong with it, and what the tables do not enforce (notes).
 */
export type Mld = { tables: Table[]; warnings: string[]; notes: string[] };

const maxIsOne = (cardinality: Cardinality) => cardinality.endsWith(',1');

/**
 * Derives the MLD of an MCD with the Merise rules: an Entity is a table keyed
 * by its Identifier; a binary Association with a Leg of max 1 adds a foreign
 * key (and its Attributes) to the Entity on that side, UNIQUE when both Legs
 * have max 1; any other Association, and every N-ary one, becomes a table
 * keyed by its foreign keys.
 */
export function deriveMld(nodes: DiagramNode[], edges: DiagramEdge[]): Mld {
	const warnings: string[] = [];
	const entities = nodes.filter((n): n is EntityNode => n.type === 'entity');
	const associations = nodes.filter((n): n is AssociationNode => n.type === 'association');
	const legs = edges.filter((e): e is LegEdge => e.type === 'leg');

	const tables = new Map<string, Table>();
	for (const entity of entities) tables.set(entity.id, entityTable(entity));
	const entityNames = new Map(entities.map((e) => [e.id, e.name]));
	const notes: string[] = [];
	const { pushedDown, children } = applyInheritances(
		entities,
		nodes,
		edges,
		tables,
		warnings,
		notes
	);
	for (const entity of entities) {
		const table = tables.get(entity.id);
		if (table && !children.has(entity.id) && table.primaryKey.length === 0) {
			warnings.push(
				`Entity "${entity.name}" has no Identifier: table ${table.name} has no primary key.`
			);
		}
	}

	const cifs = nodes.filter((n): n is CifNode => n.type === 'cif');
	const associationTables: Table[] = [];
	for (const association of associations) {
		const own = legs.filter((l) => l.source === association.id);
		const target = (leg: LegEdge) => tables.get(leg.target);
		const gone = own.find((leg) => pushedDown.has(leg.target));
		if (gone) {
			warnings.push(
				`Association "${association.name}" is left out: ${entityNames.get(gone.target)} is pushed down into its children.`
			);
			continue;
		}
		if (own.length < 2 || own.some((leg) => !target(leg))) continue;
		const [a, b] = own;

		const itsCifs = cifs.filter((c) => c.association === association.id);
		if (own.length > 2) {
			// N-ary: always a table, keyed by the foreign keys of the Legs no CIF determines.
			// A CIF applies, in order, only while its determinants are all still in the key:
			// the key then stays unique and never empty.
			const ownIds = new Set(own.map((l) => l.id));
			const determined = new Set<string>();
			for (const cif of itsCifs) {
				if (!ownIds.has(cif.determined) || determined.has(cif.determined)) continue;
				const determinants = cif.determinants.filter((l) => ownIds.has(l));
				const gone = determinants.find((l) => determined.has(l));
				if (determinants.length === 0) continue;
				if (gone) {
					const leg = own.find((l) => l.id === gone)!;
					warnings.push(
						`A CIF on "${association.name}" is not applied: ${entityNames.get(leg.target)} is no longer in the key.`
					);
					continue;
				}
				determined.add(cif.determined);
			}
			for (const leg of own.filter((l) => maxIsOne(l.cardinality) && !determined.has(l.id))) {
				warnings.push(
					`Association "${association.name}" joins ${own.length} Entities with a max of 1 on ${entityNames.get(leg.target)}: add a CIF to take it out of the key.`
				);
			}
			associationTables.push(associationTable(association, own, target, warnings, determined));
			continue;
		}
		if (itsCifs.length > 0) {
			warnings.push(
				`The CIF on "${association.name}" is ignored: a CIF needs an Association with three Legs or more.`
			);
		}
		if (maxIsOne(a.cardinality) || maxIsOne(b.cardinality)) {
			// The key goes to a side of max 1: the 1,1 one when both are, else the second.
			const receiving =
				maxIsOne(a.cardinality) && maxIsOne(b.cardinality)
					? a.cardinality === '1,1' && b.cardinality !== '1,1'
						? a
						: b
					: maxIsOne(a.cardinality)
						? a
						: b;
			const other = receiving === a ? b : a;
			const table = target(receiving)!;
			const referenced = target(other)!;
			const optional = receiving.cardinality === '0,1';
			const both = maxIsOne(a.cardinality) && maxIsOne(b.cardinality);
			const columns = addForeignKey(table, referenced, association.name, optional, warnings);
			// Without its foreign key, the table would hold data for a link it cannot express.
			if (!columns) continue;
			if (both) table.unique.push(columns);
			for (const attribute of association.attributes ?? []) {
				table.columns.push(attributeColumn(table, attribute, optional));
			}
		} else {
			associationTables.push(associationTable(association, own, target, warnings));
		}
	}

	// A child pushed up shares its parent's table: each table once.
	const ordered = [...referencedFirst([...new Set(tables.values())]), ...associationTables];
	const seen = new Set<string>();
	for (const table of ordered) {
		if (seen.has(table.name)) warnings.push(`Two tables are named ${table.name}.`);
		seen.add(table.name);
	}
	return { tables: ordered, warnings, notes };
}

const CONSTRAINT_WORDS = { X: 'at most', T: 'at least', XT: 'exactly' } as const;

/**
 * Translates the Inheritances, parents first so that chains compose: by
 * reference, a child's table is keyed by a foreign key to its parent's; pushed
 * down, it copies its parent's table, which then goes; pushed up, the child's
 * Attributes join its parent's table, with a type column. A child's own
 * Identifier is ignored. Returns the Entities pushed down and the children.
 */
function applyInheritances(
	entities: EntityNode[],
	nodes: DiagramNode[],
	edges: DiagramEdge[],
	tables: Map<string, Table>,
	warnings: string[],
	notes: string[]
): { pushedDown: Set<string>; children: Set<string> } {
	const byId = new Map(entities.map((e) => [e.id, e]));
	// One Inheritance per parent, its first by id, should two peers have made two at once.
	const canonical = new Map<string, InheritanceNode>();
	const found = nodes
		.filter((n): n is InheritanceNode => n.type === 'inheritance' && byId.has(String(n.parent)))
		.sort((a, b) => a.id.localeCompare(b.id));
	for (const node of found) if (!canonical.has(node.parent)) canonical.set(node.parent, node);
	const inheritances = new Map(found.map((n) => [n.id, canonical.get(n.parent)!]));
	// One parent per child: the first Inheritance a file or a peer gave it.
	const inheritanceOf = new Map<string, InheritanceNode>();
	for (const edge of edges) {
		const inheritance = inheritances.get(edge.source);
		if (
			edge.type === 'isa' &&
			inheritance &&
			byId.has(edge.target) &&
			!inheritanceOf.has(edge.target)
		) {
			inheritanceOf.set(edge.target, inheritance);
		}
	}
	const depth = (id: string): number => {
		let steps = 0;
		for (
			let at = inheritanceOf.get(id);
			at && steps <= byId.size;
			at = inheritanceOf.get(at.parent)
		) {
			steps++;
		}
		return steps;
	};
	// A cycle (from a file or a peer) has no depth that ends: left out.
	const children = [...inheritanceOf.keys()]
		.filter((id) => depth(id) <= byId.size)
		.sort((a, b) => depth(a) - depth(b));

	const pushedDown = new Set<string>();
	const pushedUp = new Set<string>();
	const typed = new Set<string>();
	// Warned once: by Inheritance or by parent.
	const warned = new Set<string>();
	for (const childId of children) {
		const child = byId.get(childId)!;
		const inheritance = inheritanceOf.get(childId)!;
		const parent = byId.get(inheritance.parent)!;
		const parentTable = tables.get(parent.id)!;
		if ((child.attributes ?? []).some((a) => a.identifier)) {
			warnings.push(
				`Entity "${child.name}" inherits its Identifier from ${parent.name}: its own is ignored.`
			);
		}
		const own = (child.attributes ?? []).filter((a) => !a.identifier);
		let translation = inheritance.translation ?? 'reference';
		// Its rows are in its own parent's table: nothing of its own to push down.
		if (translation === 'down' && pushedUp.has(parent.id)) {
			if (!warned.has(inheritance.id)) {
				warned.add(inheritance.id);
				warnings.push(
					`Inheritance of ${parent.name} cannot be pushed down: ${parent.name} is pushed up into its own parent. Translated by reference.`
				);
			}
			translation = 'reference';
		}
		if (translation === 'up') {
			if (!typed.has(inheritance.id)) {
				typed.add(inheritance.id);
				const total = inheritance.constraint === 'T' || inheritance.constraint === 'XT';
				parentTable.columns.push({
					name: uniqueName(parentTable, `${snakeCase(parent.name)}_type`),
					type: { kind: 'varchar', length: 50 },
					nullable: !total,
					check: children
						.filter((c) => inheritanceOf.get(c) === inheritance)
						.map((c) => byId.get(c)!.name)
				});
			}
			for (const attribute of own)
				parentTable.columns.push(attributeColumn(parentTable, attribute, true));
			tables.set(childId, parentTable);
			pushedUp.add(childId);
			continue;
		}
		const table: Table =
			translation === 'down'
				? {
						name: snakeCase(child.name),
						columns: parentTable.columns.map((c) => ({ ...c })),
						primaryKey: [...parentTable.primaryKey],
						foreignKeys: parentTable.foreignKeys.map((fk) => ({ ...fk })),
						unique: parentTable.unique.map((u) => [...u])
					}
				: { name: snakeCase(child.name), columns: [], primaryKey: [], foreignKeys: [], unique: [] };
		if (translation === 'down') {
			pushedDown.add(parent.id);
			if (parentTable.primaryKey.length === 0 && !warned.has(parent.id)) {
				warned.add(parent.id);
				warnings.push(
					`Entity "${parent.name}" has no Identifier: the tables it is pushed down into have no primary key.`
				);
			}
		} else if (parentTable.primaryKey.length === 0) {
			warnings.push(
				`Entity "${child.name}" cannot reference its parent ${parent.name}, which has no primary key.`
			);
		} else {
			table.primaryKey.push(...addForeignKey(table, parentTable, child.name, false, warnings)!);
		}
		for (const attribute of own) table.columns.push(attributeColumn(table, attribute, false));
		tables.set(childId, table);
	}
	for (const id of pushedDown) tables.delete(id);

	for (const inheritance of new Set(children.map((c) => inheritanceOf.get(c)!))) {
		const parent = byId.get(inheritance.parent)!.name;
		const names = children
			.filter((c) => inheritanceOf.get(c) === inheritance)
			.map((c) => byId.get(c)!.name)
			.join(', ');
		const constraint = inheritance.constraint;
		const total = constraint === 'T' || constraint === 'XT';
		if (inheritance.translation === 'up') {
			if (constraint !== 'X' && constraint !== 'XT') {
				notes.push(
					`Inheritance of ${parent} pushed up: one type per row, so a ${parent} is at most one of ${names}.`
				);
			}
		} else if (inheritance.translation === 'down' && !pushedUp.has(inheritance.parent)) {
			if (!total) {
				notes.push(
					`Inheritance of ${parent} pushed down: a ${parent} that is none of ${names} cannot be stored.`
				);
			}
			if (constraint === 'X' || constraint === 'XT') {
				notes.push(
					`Inheritance of ${parent}: X (a ${parent} is at most one of ${names}) is not enforced by this script.`
				);
			}
		} else if (constraint) {
			notes.push(
				`Inheritance of ${parent}: ${constraint} (a ${parent} is ${CONSTRAINT_WORDS[constraint]} one of ${names}) is not enforced by this script.`
			);
		}
	}
	return { pushedDown, children: new Set(children) };
}

function entityTable(entity: EntityNode): Table {
	const table: Table = {
		name: snakeCase(entity.name),
		columns: [],
		primaryKey: [],
		foreignKeys: [],
		unique: []
	};
	// Identifiers first, as in Looping.
	const attributes = [...(entity.attributes ?? [])].sort(
		(x, y) => Number(y.identifier) - Number(x.identifier)
	);
	for (const attribute of attributes) {
		const column = attributeColumn(table, attribute, false);
		table.columns.push(column);
		if (attribute.identifier) table.primaryKey.push(column.name);
	}
	return table;
}

function attributeColumn(table: Table, attribute: Attribute, forceNullable: boolean): Column {
	const nullable = !attribute.identifier && (forceNullable || attribute.optional);
	return {
		name: uniqueName(table, snakeCase(attribute.name)),
		// An auto-increment column is never NULL: copied onto a 0,1 side, it is a plain integer.
		type: nullable && attribute.type.kind === 'serial' ? dataType('integer') : attribute.type,
		nullable
	};
}

/**
 * An Association's own table: keyed by the foreign keys to its Entities, but
 * those of `determined` Legs, with its Attributes.
 */
function associationTable(
	association: AssociationNode,
	legs: LegEdge[],
	target: (leg: LegEdge) => Table | undefined,
	warnings: string[],
	determined: Set<string> = new Set()
): Table {
	const table: Table = {
		name: snakeCase(association.name),
		columns: [],
		primaryKey: [],
		foreignKeys: [],
		unique: []
	};
	for (const leg of legs) {
		const columns = addForeignKey(table, target(leg)!, association.name, false, warnings);
		// A Leg a CIF determines is a NOT NULL column outside the key.
		if (!determined.has(leg.id)) table.primaryKey.push(...(columns ?? []));
	}
	for (const attribute of association.attributes ?? []) {
		table.columns.push(attributeColumn(table, attribute, false));
	}
	return table;
}

/** Adds to `table` the columns and foreign key referencing `referenced`; null when it cannot. */
function addForeignKey(
	table: Table,
	referenced: Table,
	associationName: string,
	nullable: boolean,
	warnings: string[]
): string[] | null {
	if (referenced.primaryKey.length === 0) {
		warnings.push(
			`Association "${associationName}" cannot reference ${referenced.name}, which has no primary key.`
		);
		return null;
	}
	const columns = referenced.primaryKey.map((key) => {
		const source = referenced.columns.find((c) => c.name === key)!;
		const wanted = `${referenced.name}_${key}`;
		// A reflexive Association needs two columns for one table: the second takes its name.
		const name = uniqueName(
			table,
			hasColumn(table, wanted) ? `${wanted}_${snakeCase(associationName)}` : wanted
		);
		table.columns.push({ name, type: referenceType(source.type), nullable, foreign: true });
		return name;
	});
	table.foreignKeys.push({
		columns,
		table: referenced.name,
		references: [...referenced.primaryKey]
	});
	return columns;
}

/** The type of a column referencing one of this type: an Auto-increment is a plain integer. */
const referenceType = (type: DataType): DataType =>
	type.kind === 'serial' ? dataType('integer') : type;

const hasColumn = (table: Table, name: string) => table.columns.some((c) => c.name === name);

function uniqueName(table: Table, name: string): string {
	if (!hasColumn(table, name)) return name;
	let rank = 2;
	while (hasColumn(table, `${name}_${rank}`)) rank++;
	return `${name}_${rank}`;
}

/** Tables whose referenced tables come before them; tables in a cycle keep their order at the end. */
function referencedFirst(tables: Table[]): Table[] {
	const ordered: Table[] = [];
	let left = tables;
	while (left.length > 0) {
		const placed = new Set(ordered.map((t) => t.name));
		const ready = left.filter((t) =>
			t.foreignKeys.every((fk) => fk.table === t.name || placed.has(fk.table))
		);
		if (ready.length === 0) return [...ordered, ...left];
		ordered.push(...ready);
		left = left.filter((t) => !ready.includes(t));
	}
	return ordered;
}

/** `Bon de commande` → `bon_de_commande`: lowercase, no accents, words joined by `_`. */
export function snakeCase(name: string): string {
	const words = name
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/([a-z0-9])([A-Z])/g, '$1_$2')
		.toLowerCase()
		.split(/[^a-z0-9]+/)
		.filter(Boolean);
	const joined = words.join('_') || 'unnamed';
	return /^[0-9]/.test(joined) ? `_${joined}` : joined;
}
