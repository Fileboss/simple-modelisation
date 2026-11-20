import { dataType, type DataType } from '../data-types.ts';
import type {
	AssociationNode,
	Attribute,
	Cardinality,
	CifNode,
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
 * have max 1; any other Association, and every N-ary one, becomes a table
 * keyed by its foreign keys.
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

	const entityNames = new Map(entities.map((e) => [e.id, e.name]));
	const cifs = nodes.filter((n): n is CifNode => n.type === 'cif');
	const associationTables: Table[] = [];
	for (const association of associations) {
		const own = legs.filter((l) => l.source === association.id);
		const target = (leg: LegEdge) => tables.get(leg.target);
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
