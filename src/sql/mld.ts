import { dataType, type DataType } from '../document/data-types';
import type {
	AssociationNode,
	Attribute,
	Cardinality,
	DiagramEdge,
	DiagramNode,
	EntityNode,
	LegEdge
} from '../document/project';

export type Column = {
	name: string;
	type: DataType;
	nullable: boolean;
	/** Set on the columns of a foreign key. */
	foreign?: boolean;
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

/** The relational model of an MCD: its tables, referenced ones first, and what is wrong with it. */
export type Mld = { tables: Table[]; warnings: string[] };

const maxIsOne = (cardinality: Cardinality) => cardinality.endsWith(',1');

/**
 * Derives the MLD of an MCD with the Merise rules: an Entity is a table keyed
 * by its Identifier; a binary Association with a Leg of max 1 adds a foreign
 * key (and its Attributes) to the Entity on that side, UNIQUE when both Legs
 * have max 1; any other Association becomes a table keyed by both foreign keys.
 */
export function deriveMld(nodes: DiagramNode[], edges: DiagramEdge[]): Mld {
	const warnings: string[] = [];
	const entities = nodes.filter((n): n is EntityNode => n.type === 'entity');
	const associations = nodes.filter((n): n is AssociationNode => n.type === 'association');
	const legs = edges.filter((e): e is LegEdge => e.type === 'leg');

	const tables = new Map<string, Table>();
	for (const entity of entities) {
		const table = entityTable(entity);
		if (table.primaryKey.length === 0) {
			warnings.push(
				`Entity "${entity.name}" has no Identifier: table ${table.name} has no primary key.`
			);
		}
		tables.set(entity.id, table);
	}

	const associationTables: Table[] = [];
	for (const association of associations) {
		const [a, b] = legs.filter((l) => l.source === association.id);
		if (!a || !b) continue;
		const target = (leg: LegEdge) => tables.get(leg.target);
		const tableA = target(a);
		const tableB = target(b);
		if (!tableA || !tableB) continue;

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
			const table: Table = {
				name: snakeCase(association.name),
				columns: [],
				primaryKey: [],
				foreignKeys: [],
				unique: []
			};
			for (const leg of [a, b]) {
				const columns = addForeignKey(table, target(leg)!, association.name, false, warnings);
				table.primaryKey.push(...(columns ?? []));
			}
			for (const attribute of association.attributes ?? []) {
				table.columns.push(attributeColumn(table, attribute, false));
			}
			associationTables.push(table);
		}
	}

	const ordered = [...referencedFirst([...tables.values()]), ...associationTables];
	const seen = new Set<string>();
	for (const table of ordered) {
		if (seen.has(table.name)) warnings.push(`Two tables are named ${table.name}.`);
		seen.add(table.name);
	}
	return { tables: ordered, warnings };
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
