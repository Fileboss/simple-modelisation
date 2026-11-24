import { dataType, type DataType } from '../data-types.ts';
import { MAX_NAME, namesColumn } from './constraints.ts';
import type {
	AssociationNode,
	Attribute,
	Cardinality,
	CifNode,
	InheritanceNode,
	IsaEdge,
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
	/** The Check of its Attribute. */
	condition?: string;
	comment?: string;
};

export type ForeignKey = {
	/** Unique in its table: the one given on the Leg or Inheritance link, else made from its columns. */
	name?: string;
	/** The Comment of the Association it translates. */
	comment?: string;
	columns: string[];
	table: string;
	references: string[];
};

export type Table = {
	name: string;
	columns: Column[];
	primaryKey: string[];
	foreignKeys: ForeignKey[];
	/** Column groups that must be unique (a 1-1 Association's foreign key, unique Attributes and groups). */
	unique: string[][];
	comment?: string;
};

/**
 * The relational model of an MCD: its tables, referenced ones first, what is
 * wrong with it, and what the tables do not enforce (notes).
 */
export type Mld = { tables: Table[]; warnings: string[]; notes: string[] };

const maxIsOne = (cardinality: Cardinality) => cardinality.endsWith(',1');

/**
 * Of the two Legs of a binary Association with a max of 1, the one whose Entity
 * takes the foreign key: the 1,1 one when both have a max of 1, else the second.
 */
function receivingLeg(a: LegEdge, b: LegEdge): LegEdge {
	if (maxIsOne(a.cardinality) && maxIsOne(b.cardinality)) {
		return a.cardinality === '1,1' && b.cardinality !== '1,1' ? a : b;
	}
	return maxIsOne(a.cardinality) ? a : b;
}

/**
 * The foreign key a Leg of an Association (`legs`, all its own) stands for: the
 * Entity it references, and whether the Leg is the one that makes it (the other
 * Leg of a binary Association stands for the same key).
 */
export function foreignKeyOf(
	legs: LegEdge[],
	leg: LegEdge
): { references: string; makes: boolean } {
	const [a, b] = legs;
	if (legs.length !== 2 || (!maxIsOne(a.cardinality) && !maxIsOne(b.cardinality))) {
		return { references: leg.target, makes: true };
	}
	// A relative identifier's key goes to its own Entity.
	const receiving = legs.find((l) => l.relative) ?? receivingLeg(a, b);
	return { references: (receiving === a ? b : a).target, makes: receiving.id === leg.id };
}

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
	// Kept apart: an Inheritance's child says its own with the table it ends up in.
	const entityWarnings = new Map<string, string[]>();
	for (const entity of entities) {
		const own: string[] = [];
		tables.set(entity.id, entityTable(entity, own));
		entityWarnings.set(entity.id, own);
	}
	const entityNames = new Map(entities.map((e) => [e.id, e.name]));
	const notes: string[] = [];
	const parentIds = new Set(
		nodes.filter((n) => n.type === 'inheritance').map((n) => String(n.parent))
	);
	const isParent = (id: string) => parentIds.has(id);
	// Relative identifiers go around the Inheritances: before, so that a dependent parent's
	// children reference its whole key; after, those whose strong Entity is a child (or
	// depends on one), whose key comes from the Inheritance.
	const childIds = new Set(edges.filter((e) => e.type === 'isa').map((e) => e.target));
	const downParents = new Set(
		nodes
			.filter((n) => n.type === 'inheritance' && n.translation === 'down')
			.map((n) => String(n.parent))
	);
	const relative = relativeLinks(associations, legs, childIds, entityNames, warnings);
	const late = new Set(relative.filter((l) => childIds.has(l.strong)).map((l) => l.weak));
	for (let grew = true; grew;) {
		grew = false;
		for (const link of relative) {
			if (late.has(link.strong) && !late.has(link.weak)) {
				late.add(link.weak);
				grew = true;
			}
		}
	}
	const state = { handled: new Set<string>(), leading: new Map<Table, string[]>() };
	applyRelativeLinks(
		relative.filter((l) => !late.has(l.weak)),
		tables,
		downParents,
		state,
		entityNames,
		warnings
	);
	const { pushedDown, children } = applyInheritances(
		entities,
		nodes,
		edges,
		tables,
		warnings,
		notes
	);
	for (const [id, own] of entityWarnings) if (!children.has(id)) warnings.push(...own);
	const lateLinks = relative.filter((l) => late.has(l.weak));
	for (const link of lateLinks.filter((l) => isParent(l.weak))) {
		warnings.push(
			`The relative identifier of ${entityNames.get(link.weak)} is ignored: it would come after its Inheritance children took its key.`
		);
	}
	applyRelativeLinks(
		lateLinks.filter((l) => !isParent(l.weak)),
		tables,
		pushedDown,
		state,
		entityNames,
		warnings
	);
	const handled = state.handled;
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
		if (handled.has(association.id)) continue;
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
			const receiving = receivingLeg(a, b);
			const other = receiving === a ? b : a;
			const table = target(receiving)!;
			const referenced = target(other)!;
			const optional = receiving.cardinality === '0,1';
			const both = maxIsOne(a.cardinality) && maxIsOne(b.cardinality);
			const columns = addForeignKey(table, referenced, association.name, optional, warnings, {
				name: receiving.fkName ?? other.fkName,
				comment: association.comment
			});
			// Without its foreign key, the table would hold data for a link it cannot express.
			if (!columns) continue;
			if (both) table.unique.push(columns);
			addAttributes(table, association.attributes ?? [], optional, warnings);
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
		nameForeignKeys(table, warnings);
		table.unique = distinctUniques(table);
	}
	return { tables: ordered, warnings, notes };
}

/**
 * Names a table's foreign keys, each once: those given first, then the others
 * from their columns, cut to what PostgreSQL keeps and numbered when taken.
 */
function nameForeignKeys(table: Table, warnings: string[]): void {
	const taken = new Set<string>();
	const free = (wanted: string) => {
		let name = wanted.slice(0, MAX_NAME);
		for (let rank = 2; taken.has(name); rank++) {
			name = `${wanted.slice(0, MAX_NAME - `_${rank}`.length)}_${rank}`;
		}
		taken.add(name);
		return name;
	};
	// Every given name is taken before a repeat is numbered, so it never takes another's.
	const repeats: ForeignKey[] = [];
	for (const fk of table.foreignKeys.filter((f) => f.name)) {
		if (taken.has(fk.name!)) repeats.push(fk);
		else taken.add(fk.name!);
	}
	for (const fk of repeats) {
		warnings.push(`Two foreign keys of ${table.name} are named ${fk.name}: one is numbered.`);
		fk.name = free(fk.name!);
	}
	for (const fk of table.foreignKeys.filter((f) => !f.name)) {
		fk.name = free(`fk_${table.name}_${fk.columns.join('_')}`);
	}
}

/** What is unique beyond the primary key, each once whatever the order of its columns. */
function distinctUniques(table: Table): string[][] {
	const key = (columns: string[]) => [...columns].sort().join();
	const seen = new Set([key(table.primaryKey)]);
	return table.unique.filter((columns) => {
		if (seen.has(key(columns))) return false;
		seen.add(key(columns));
		return true;
	});
}

type RelativeLink = {
	weak: string;
	strong: string;
	association: AssociationNode;
	fkName?: string;
};

/**
 * The relative identifiers that can apply: a 1,1 Leg marked R on a binary
 * Association between two Entities, whose dependent Entity is not an
 * Inheritance child (a child takes its key from its parent). The others warn.
 */
function relativeLinks(
	associations: AssociationNode[],
	legs: LegEdge[],
	children: Set<string>,
	entityNames: Map<string, string>,
	warnings: string[]
): RelativeLink[] {
	const byId = new Map(associations.map((a) => [a.id, a]));
	const legsOf = new Map<string, LegEdge[]>();
	for (const leg of legs) legsOf.set(leg.source, [...(legsOf.get(leg.source) ?? []), leg]);
	const links: RelativeLink[] = [];
	for (const leg of legs.filter((l) => l.relative && l.cardinality === '1,1')) {
		const association = byId.get(leg.source);
		if (!association) continue;
		const own = legsOf.get(leg.source) ?? [];
		const other = own.find((l) => l !== leg);
		if (own.length !== 2 || !other || other.target === leg.target) {
			warnings.push(
				`The relative identifier on "${association.name}" is ignored: it needs a binary Association between two Entities.`
			);
		} else if (children.has(leg.target)) {
			warnings.push(
				`The relative identifier of ${entityNames.get(leg.target)} is ignored: an Inheritance child takes its key from its parent.`
			);
		} else {
			links.push({
				weak: leg.target,
				strong: other.target,
				association,
				fkName: leg.fkName ?? other.fkName
			});
		}
	}
	return links;
}

/**
 * Keys each dependent Entity by the foreign key to its strong Entity's table,
 * in front of its own Identifier, strong Entities first so that chains carry
 * the whole key. What waits once nothing more can go is a cycle, or depends on
 * one: ignored, with a warning. Adds the Associations it translated to `handled`.
 */
function applyRelativeLinks(
	links: RelativeLink[],
	tables: Map<string, Table>,
	skip: Set<string>,
	state: { handled: Set<string>; leading: Map<Table, string[]> },
	entityNames: Map<string, string>,
	warnings: string[]
): void {
	// An Entity pushed down has no table: the Association loop says so.
	let left = links.filter(
		(l) => !skip.has(l.weak) && !skip.has(l.strong) && tables.has(l.weak) && tables.has(l.strong)
	);
	while (left.length > 0) {
		const waiting = new Set(left.map((l) => l.weak));
		// A link is ready once its strong Entity has its whole key.
		const ready = left.filter((l) => !waiting.has(l.strong));
		if (ready.length === 0) break;
		for (const { weak, strong, association, fkName } of ready) {
			// Translated here even when it cannot reference: its warning is said once.
			state.handled.add(association.id);
			const table = tables.get(weak)!;
			const columns = addForeignKey(table, tables.get(strong)!, association.name, false, warnings, {
				name: fkName,
				comment: association.comment
			});
			if (!columns) continue;
			// The foreign keys lead the key and the columns, in the order of the Legs, as
			// Looping writes it; the Entity's own Identifier comes after.
			const leading = [...(state.leading.get(table) ?? []), ...columns];
			state.leading.set(table, leading);
			table.primaryKey = [...leading, ...table.primaryKey.filter((c) => !leading.includes(c))];
			table.columns = [
				...leading.map((name) => table.columns.find((c) => c.name === name)!),
				...table.columns.filter((c) => !leading.includes(c.name))
			];
			addAttributes(table, association.attributes ?? [], false, warnings);
		}
		left = left.filter((l) => !ready.includes(l));
	}
	if (left.length === 0) return;
	// In a cycle: an Entity its strong Entities lead back to; the others only depend on one.
	const strongOf = (id: string) => left.filter((l) => l.weak === id).map((l) => l.strong);
	const inCycle = (start: string) => {
		const seen = new Set<string>();
		const next = [...strongOf(start)];
		while (next.length > 0) {
			const at = next.pop()!;
			if (at === start) return true;
			if (seen.has(at)) continue;
			seen.add(at);
			next.push(...strongOf(at));
		}
		return false;
	};
	const weak = [...new Set(left.map((l) => l.weak))];
	const names = (ids: string[]) =>
		ids
			.map((id) => entityNames.get(id))
			.sort()
			.join(', ');
	const cycle = weak.filter(inCycle);
	const dependent = weak.filter((id) => !cycle.includes(id));
	warnings.push(
		`The relative identifiers of ${names(cycle)} form a cycle: they are ignored` +
			(dependent.length > 0 ? `, with those depending on them (${names(dependent)}).` : '.')
	);
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
	const fkNames = new Map<string, string | undefined>();
	for (const edge of edges) {
		const inheritance = inheritances.get(edge.source);
		if (
			edge.type === 'isa' &&
			inheritance &&
			byId.has(edge.target) &&
			!inheritanceOf.has(edge.target)
		) {
			inheritanceOf.set(edge.target, inheritance);
			fkNames.set(edge.target, (edge as IsaEdge).fkName);
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
			addUniqueGroups(
				parentTable,
				child,
				addAttributes(parentTable, own, true, warnings),
				warnings
			);
			if (child.comment) notes.push(noTable(child.name, parent.name));
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
			table.primaryKey.push(
				...addForeignKey(table, parentTable, child.name, false, warnings, {
					name: fkNames.get(childId)
				})!
			);
		}
		if (child.comment) table.comment = child.comment;
		addUniqueGroups(table, child, addAttributes(table, own, false, warnings), warnings);
		tables.set(childId, table);
	}
	for (const id of pushedDown) {
		tables.delete(id);
		const parent = byId.get(id)!;
		if (parent.comment) notes.push(noTable(parent.name, 'its children'));
	}

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

const noTable = (entity: string, into: string) =>
	`The Comment of ${entity} is left out: it has no table of its own, its columns are in ${into}.`;

function entityTable(entity: EntityNode, warnings: string[]): Table {
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
	const columns = addAttributes(table, attributes, false, warnings);
	for (const attribute of attributes) {
		if (attribute.identifier) table.primaryKey.push(columns.get(attribute.id)!);
	}
	addUniqueGroups(table, entity, columns, warnings);
	if (entity.comment) table.comment = entity.comment;
	return table;
}

/** Adds the columns of Attributes, with what each says of its own; the column of each Attribute. */
function addAttributes(
	table: Table,
	attributes: Attribute[],
	forceNullable: boolean,
	warnings: string[]
): Map<string, string> {
	const columns = new Map<string, string>();
	for (const attribute of attributes) {
		const column = attributeColumn(table, attribute, forceNullable);
		table.columns.push(column);
		columns.set(attribute.id, column.name);
		if (attribute.unique) table.unique.push([column.name]);
		if (column.condition && !namesColumn(column.condition, column.name)) {
			warnings.push(
				`The Check of "${attribute.name}" in ${table.name} does not name its column ${column.name}.`
			);
		}
	}
	return columns;
}

/** An Entity's Unique groups on its table, where its columns are. */
function addUniqueGroups(
	table: Table,
	entity: EntityNode,
	columns: Map<string, string>,
	warnings: string[]
): void {
	for (const group of entity.uniques ?? []) {
		const names = group.map((id) => columns.get(id));
		if (names.every((name) => name !== undefined)) table.unique.push(names);
		else {
			warnings.push(
				`A Unique group of "${entity.name}" is ignored: it holds an Identifier its table does not have.`
			);
		}
	}
}

function attributeColumn(table: Table, attribute: Attribute, forceNullable: boolean): Column {
	const nullable = !attribute.identifier && (forceNullable || attribute.optional);
	return {
		name: uniqueName(table, snakeCase(attribute.name)),
		// An auto-increment column is never NULL: copied onto a 0,1 side, it is a plain integer.
		type: nullable && attribute.type.kind === 'serial' ? dataType('integer') : attribute.type,
		nullable,
		...(attribute.check && { condition: attribute.check }),
		...(attribute.comment && { comment: attribute.comment })
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
		const columns = addForeignKey(table, target(leg)!, association.name, false, warnings, {
			name: leg.fkName
		});
		// A Leg a CIF determines is a NOT NULL column outside the key.
		if (!determined.has(leg.id)) table.primaryKey.push(...(columns ?? []));
	}
	addAttributes(table, association.attributes ?? [], false, warnings);
	if (association.comment) table.comment = association.comment;
	return table;
}

/** Adds to `table` the columns and foreign key referencing `referenced`; null when it cannot. */
function addForeignKey(
	table: Table,
	referenced: Table,
	associationName: string,
	nullable: boolean,
	warnings: string[],
	{ name: given, comment }: Pick<ForeignKey, 'name' | 'comment'>
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
		...(given && { name: given }),
		...(comment && { comment }),
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
