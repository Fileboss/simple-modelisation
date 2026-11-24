import {
	checkProblem,
	cleanCheck,
	cleanComment,
	ConstraintError,
	isForeignKeyName
} from './sql/constraints.ts';
import * as Y from 'yjs';
import { cleanDataType, dataType, isDataType, type DataType } from './data-types.ts';
import { COMPONENT_TYPE_IDS, isPerson, type ComponentType } from './component-types.ts';
import { skinFits } from './skins.ts';

export type DiagramKind = 'system' | 'mcd';

export type Diagram = {
	id: string;
	kind: DiagramKind;
	name: string;
	createdAt: number;
	/** An MCD tidied from top to bottom; absent, from left to right. */
	tidyDirection?: 'vertical';
};

/** Which way Tidy up lays a Diagram out: only an MCD can be vertical. */
export type TidyDirection = 'horizontal' | 'vertical';

/** A box on a Diagram (Component, Entity, Association): its kind-specific fields sit beside the position. */
export type DiagramNode = { id: string; type: string; x: number; y: number } & Record<
	string,
	unknown
>;

/** A line on a Diagram (Connection, Leg) from one node to another. */
export type DiagramEdge = { id: string; type: string; source: string; target: string } & Record<
	string,
	unknown
>;

export { COMPONENT_TYPE_IDS, type ComponentType };

export type ComponentNode = DiagramNode & {
	type: 'component';
	componentType: ComponentType;
	name: string;
	/** A Skin id from the catalog, or null for the generic look. */
	skin: string | null;
	/** Where the Component runs; absent or null when unspecified. */
	hosting?: Hosting | null;
	/** Whose infrastructure it runs on; absent when unspecified. */
	provider?: Provider;
	/** A Disk's kind; absent when unspecified. */
	diskKind?: DiskKind;
	/** What runs a Service's code; absent when unspecified, and on other types. */
	runtime?: Runtime;
};

/** Where a Component runs, from the most concrete to the most abstract. */
export const HOSTINGS = [
	'bare-metal',
	'vm',
	'docker',
	'kubernetes',
	'managed',
	'serverless',
	'external'
] as const;
export type Hosting = (typeof HOSTINGS)[number];

/**
 * Whose infrastructure a Component runs on: one's own machines, the
 * hyperscalers, then European, then other clouds and platforms.
 */
export const PROVIDERS = [
	'self-hosted',
	'aws',
	'google-cloud',
	'azure',
	'ovhcloud',
	'scaleway',
	'hetzner',
	'ionos',
	'clever-cloud',
	'digitalocean',
	'vultr',
	'akamai',
	'alibaba-cloud',
	'cloudflare',
	'vercel',
	'netlify',
	'fly',
	'render',
	'railway'
] as const;
export type Provider = (typeof PROVIDERS)[number];

/**
 * What executes a Service's code on the server, or the language for a native
 * binary (Go, Rust): JavaScript runtimes, then VMs and interpreters, then compiled.
 */
export const RUNTIMES = [
	'nodejs',
	'bun',
	'java',
	'dotnet',
	'python',
	'php',
	'ruby',
	'go',
	'rust'
] as const;
export type Runtime = (typeof RUNTIMES)[number];

/** What a Disk is: spinning, solid-state, NVMe, or plugged in over USB. */
export const DISK_KINDS = ['hdd', 'ssd', 'nvme', 'usb'] as const;
export type DiskKind = (typeof DISK_KINDS)[number];

export type Point = { x: number; y: number };
type Box = Point & { width: number; height: number };

/**
 * The bends a Tidy up routed a Connection or a Leg through, around the boxes;
 * its ends attach to the boxes as drawn. Cleared when an end moves.
 */
export type Route = { points?: Point[] };

/**
 * What a Connection's data does, seen from the initiator the arrow starts at:
 * it comes back (read), it goes to the target (write), or both.
 */
export const FLOWS = ['read', 'write', 'read-write'] as const;
export type Flow = (typeof FLOWS)[number];

export type ConnectionEdge = DiagramEdge &
	Route & {
		type: 'connection';
		label: string;
		/** Absent when unspecified. */
		flow?: Flow;
		/** How far along its line its label was put, from 0 to 1; absent: placed automatically. */
		labelPosition?: number;
	};

/** A named area grouping the Components drawn inside it (a region, a VPC, a subnet). */
export type ZoneNode = DiagramNode & {
	type: 'zone';
	name: string;
	width: number;
	height: number;
	/** Taken by the Components inside that have none of their own. */
	provider?: Provider;
};

/** A Note's paper colors; absent means yellow. */
export const NOTE_COLORS = ['yellow', 'pink', 'green', 'blue', 'purple'] as const;
export type NoteColor = (typeof NOTE_COLORS)[number];

/**
 * Free text on a sticky note, on either kind of Diagram: it explains the
 * Diagram and is not part of it (no Connections, left alone by Tidy up and the MLD).
 */
/** `width` absent: the default; the height always follows the text. */
export type NoteNode = DiagramNode & {
	type: 'note';
	text: string;
	color?: NoteColor;
	width?: number;
};

export const AREA_COLORS = [
	'blue',
	'teal',
	'green',
	'yellow',
	'orange',
	'red',
	'pink',
	'purple'
] as const;
export type AreaColor = (typeof AREA_COLORS)[number];

/**
 * A colored rectangle behind an MCD, to point at a part of it: no membership,
 * left alone by Tidy up and the MLD. `color` absent: blue.
 */
export type AreaNode = DiagramNode & {
	type: 'area';
	label: string;
	width: number;
	height: number;
	color?: AreaColor;
};

/** The smallest Area, so that its handles stay apart. */
export const AREA_MIN = { width: 40, height: 24 };
/** A new Area's size. */
export const AREA_DEFAULT = { width: 360, height: 240 };
/** The longest label of an Area. */
export const MAX_AREA_LABEL = 200;

/** How wide a Note can be made, and how wide it is unless resized. */
export const NOTE_WIDTHS = { min: 120, default: 180, max: 600 };

/** A width as a Note may have it: rounded, within NOTE_WIDTHS. */
export const boundedNoteWidth = (width: number) =>
	Math.min(NOTE_WIDTHS.max, Math.max(NOTE_WIDTHS.min, Math.round(width)));

/** The smallest Zone, so that it still holds a title and a Component. */
export const ZONE_MIN = { width: 160, height: 100 };
/** A new Zone's size. */
export const ZONE_DEFAULT = { width: 400, height: 280 };
/** Room a Zone keeps around its content, under its title bar. */
export const ZONE_PADDING = { top: 48, side: 24 };

export type Attribute = {
	id: string;
	name: string;
	identifier: boolean;
	type: DataType;
	/** Whether the column accepts NULL; an Identifier is never optional. */
	optional: boolean;
	unique?: true;
	/** An SQL condition its values must meet, with the script's column names (ADR 0010). */
	check?: string;
	/** What it means, kept in the database (COMMENT ON). */
	comment?: string;
};

export type EntityNode = DiagramNode & {
	type: 'entity';
	name: string;
	attributes: Attribute[];
	comment?: string;
	/** Unique groups: the ids of two of its Attributes or more, unique together. */
	uniques?: string[][];
};

export type AssociationNode = DiagramNode & {
	type: 'association';
	name: string;
	/** Attributes carried by the Association; their `identifier` flag is always false. */
	attributes: Attribute[];
	comment?: string;
};

export const CARDINALITIES = ['0,1', '1,1', '0,n', '1,n'] as const;
export type Cardinality = (typeof CARDINALITIES)[number];

/**
 * A CIF on an N-ary Association: the Entities on its determinant Legs fix the
 * one on its determined Leg. Legs rather than Entities: an Entity may be on two.
 */
export type CifNode = DiagramNode & {
	type: 'cif';
	association: string;
	determinants: string[];
	determined: string;
};

/** Where a CIF sits from its Association's corner, when made and after a Tidy up. */
export const CIF_OFFSET = { x: 20, y: -70 };
/** A CIF's circle. */
export const CIF_SIZE = { width: 44, height: 44 };

export const INHERITANCE_CONSTRAINTS = ['none', 'X', 'T', 'XT'] as const;
/** X: a parent is at most one child; T: at least one; XT: exactly one. */
export type InheritanceConstraint = (typeof INHERITANCE_CONSTRAINTS)[number];
export const INHERITANCE_TRANSLATIONS = ['reference', 'down', 'up'] as const;
/** How the MLD translates an Inheritance: child tables referencing the parent's, or one side's table only. */
export type InheritanceTranslation = (typeof INHERITANCE_TRANSLATIONS)[number];

/**
 * A parent Entity specialised by child Entities (its `isa` edges). Constraint
 * and translation absent mean none and by reference.
 */
export type InheritanceNode = DiagramNode & {
	type: 'inheritance';
	parent: string;
	constraint?: Exclude<InheritanceConstraint, 'none'>;
	translation?: Exclude<InheritanceTranslation, 'reference'>;
};

/**
 * Joins an Inheritance (source) to one of its child Entities (target); `fkName`
 * names the foreign key it makes, by reference.
 */
export type IsaEdge = DiagramEdge & { type: 'isa'; fkName?: string };

/** Where a new Inheritance sits from its parent's corner. */
export const INHERITANCE_OFFSET = { x: 0, y: 120 };
/** An Inheritance's triangle. */
export const INHERITANCE_SIZE = { width: 56, height: 40 };

/** Whether a Leg can be marked relative: 1,1, on a binary Association between two Entities. */
export function canBeRelative(edges: DiagramEdge[], legId: string): boolean {
	const leg = edges.find((e) => e.id === legId) as LegEdge | undefined;
	if (leg?.type !== 'leg' || leg.cardinality !== '1,1') return false;
	const legs = edges.filter((e) => e.type === 'leg' && e.source === leg.source);
	return legs.length === 2 && legs[0].target !== legs[1].target;
}

/** A Leg's part in a CIF. */
export type CifRole = 'determinant' | 'determined' | 'none';

/**
 * Joins an Association (source) to one of its Entities (target). `relative`, on
 * a 1,1 Leg of a binary Association: that Entity is identified relative to the
 * other one. `fkName` names the foreign key it makes.
 */
export type LegEdge = DiagramEdge &
	Route & { type: 'leg'; cardinality: Cardinality; relative?: true; fkName?: string };

/** The JSON file a Project exports to and imports from. */
export type ProjectFile = {
	format: typeof FILE_FORMAT;
	version: typeof FILE_VERSION;
	name: string;
	diagrams: (Diagram & { nodes: DiagramNode[]; edges: DiagramEdge[] })[];
};

const FILE_FORMAT = 'simple-modelisation';
/** Transaction origin of migrations, which undo does not track. */
const MIGRATION = Symbol('migration');
const FILE_VERSION = 1;
const DIAGRAM_KINDS: readonly DiagramKind[] = ['system', 'mcd'];

export const DEFAULT_DIAGRAM_NAMES: Record<DiagramKind, string> = {
	system: 'System design',
	mcd: 'MCD'
};

// Each element is a Y.Map of its fields, so concurrent edits of different fields merge.
type Fields = Y.Map<unknown>;

/**
 * A Project's content, held in a Yjs document (ADR 0001). The UI reads and
 * changes a Project only through these operations; undo and redo cover them all.
 */
export class ProjectDocument {
	readonly doc: Y.Doc;
	private readonly meta: Y.Map<unknown>;
	private readonly diagramMap: Y.Map<Fields>;
	private readonly undoManager: Y.UndoManager;

	/** Without `undo`, nothing is tracked: what an edit replaces is freed at once (the server's use). */
	constructor(doc: Y.Doc = new Y.Doc(), { undo = true }: { undo?: boolean } = {}) {
		this.doc = doc;
		this.meta = doc.getMap('meta');
		this.diagramMap = doc.getMap('diagrams');
		this.undoManager = new Y.UndoManager([this.meta, this.diagramMap], {
			captureTransaction: () => undo
		});
	}

	// Project

	/** The Project's name; empty only in a document created before names lived in it. */
	name(): string {
		const name = this.meta.get('name');
		return typeof name === 'string' ? name : '';
	}

	rename(name: string): void {
		if (name.trim()) this.meta.set('name', name.trim());
	}

	/**
	 * Gives a name to a document that has none (created before names lived in
	 * documents). It is a migration, not an edit: undo does not revert it.
	 */
	adoptName(name: string): void {
		if (!this.name()) this.doc.transact(() => this.meta.set('name', name), MIGRATION);
	}

	// Diagrams

	/**
	 * In the order of the tabs: by `createdAt`, the time a Diagram was added until its
	 * tab is moved, then a value between its neighbours'.
	 */
	diagrams(): Diagram[] {
		return [...this.diagramMap.entries()]
			.filter(([key, d]) => isReadableDiagram(key, d))
			.map(([, d]) => {
				const kind = d.get('kind') as DiagramKind;
				const name = d.get('name');
				const createdAt = d.get('createdAt');
				return {
					id: d.get('id') as string,
					kind,
					// A peer may write anything: a name that is not text, or what is not a time,
					// reads as the default.
					name: typeof name === 'string' ? name : DEFAULT_DIAGRAM_NAMES[kind],
					createdAt: isTime(createdAt) ? createdAt : 0,
					// Any other value, from a newer version, reads as horizontal.
					...(kind === 'mcd' && d.get('tidyDirection') === 'vertical'
						? { tidyDirection: 'vertical' as const }
						: {})
				};
			})
			.sort((a, b) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : 1));
	}

	/**
	 * How many entries reads leave out, that this version cannot read (malformed,
	 * or written by another version): diagram entries, and the nodes and edges of
	 * `diagramId` if given. An edge left dangling by concurrent edits is not
	 * counted: nothing in it is unreadable. They all stay in the document.
	 */
	unreadable(diagramId?: string): number {
		let count = [...this.diagramMap.entries()].filter(
			([key, diagram]) => !isReadableDiagram(key, diagram)
		).length;
		if (diagramId === undefined || !isReadableDiagram(diagramId, this.diagramMap.get(diagramId))) {
			return count;
		}
		const nodes = this.nodeMap(diagramId);
		const edges = this.edgeMap(diagramId);
		const read = new Set(this.nodes(diagramId).map((n) => n.id));
		count += nodes.raw.size - read.size;
		const kept = new Set(this.edges(diagramId).map((e) => e.id));
		for (const [key, entry] of edges.raw.entries()) {
			if (kept.has(key)) continue;
			const edge = isReadableEntry(key, entry) ? entry : undefined;
			// Its ends gone (not merely unreadable): dangling, not unreadable.
			const dangling =
				edge !== undefined &&
				(!nodes.raw.has(edge.get('source') as string) ||
					!nodes.raw.has(edge.get('target') as string));
			if (!dangling) count++;
		}
		return count;
	}

	diagram(id: string): Diagram | undefined {
		return this.diagrams().find((d) => d.id === id);
	}

	addDiagram(kind: DiagramKind, name: string = DEFAULT_DIAGRAM_NAMES[kind]): string {
		const id = crypto.randomUUID();
		this.doc.transact(() => {
			const diagram = new Y.Map<unknown>();
			diagram.set('id', id);
			diagram.set('kind', kind);
			diagram.set('name', name.trim() || DEFAULT_DIAGRAM_NAMES[kind]);
			// After every other, even one made in this millisecond or by a peer whose clock is ahead.
			diagram.set('createdAt', Math.max(Date.now(), (this.diagrams().at(-1)?.createdAt ?? 0) + 1));
			diagram.set('nodes', new Y.Map<Fields>());
			diagram.set('edges', new Y.Map<Fields>());
			this.diagramMap.set(id, diagram);
		});
		return id;
	}

	/**
	 * Adds a copy of a Diagram right after it, with elements of its own: what a paste
	 * of them all takes. One undo step. Returns the copy's id.
	 */
	duplicateDiagram(id: string, name?: string): string {
		const diagrams = this.diagrams();
		const at = diagrams.findIndex((d) => d.id === id);
		if (at === -1) throw new Error(`Unknown diagram ${id}`);
		const original = diagrams[at];
		const following = diagrams.slice(at + 1);
		let copy = '';
		this.undoManager.stopCapturing();
		this.doc.transact(() => {
			copy = this.addDiagram(
				original.kind,
				name?.trim() || copyName(original.name, new Set(diagrams.map((d) => d.name)))
			);
			const entry = this.requireDiagram(copy);
			if (following.length > 0) this.placeDiagram(copy, original, following);
			if (original.tidyDirection) entry.set('tidyDirection', original.tidyDirection);
			// As stored: a paste checks and completes them.
			const stored = (entries: Entries) => [...entries.values()].map((e) => e.toJSON());
			this.paste(
				copy,
				{
					nodes: stored(this.nodeMap(id)) as DiagramNode[],
					edges: stored(this.edgeMap(id)) as DiagramEdge[]
				},
				0,
				0
			);
		});
		this.undoManager.stopCapturing();
		return copy;
	}

	/** Moves a Diagram's tab to `index` in their order (from 0), clamped; one undo step. */
	moveDiagram(id: string, index: number): void {
		const diagrams = this.diagrams();
		const from = diagrams.findIndex((d) => d.id === id);
		if (from === -1) throw new Error(`Unknown diagram ${id}`);
		const to = Math.min(diagrams.length - 1, Math.max(0, Math.round(index)));
		if (to === from) return;
		const others = diagrams.filter((d) => d.id !== id);
		this.undoManager.stopCapturing();
		this.doc.transact(() => this.placeDiagram(id, others[to - 1], others.slice(to)));
		this.undoManager.stopCapturing();
	}

	renameDiagram(id: string, name: string): void {
		const diagram = this.requireDiagram(id);
		diagram.set('name', name.trim() || DEFAULT_DIAGRAM_NAMES[diagram.get('kind') as DiagramKind]);
	}

	/** Sets which way Tidy up lays an MCD out, for every Participant. */
	setTidyDirection(id: string, direction: TidyDirection): void {
		const diagram = this.requireDiagram(id);
		if (diagram.get('kind') !== 'mcd') throw new Error('Only an MCD can be tidied vertically');
		if (direction === 'vertical') diagram.set('tidyDirection', 'vertical');
		else diagram.delete('tidyDirection');
	}

	deleteDiagram(id: string): void {
		this.diagramMap.delete(id);
	}

	// Elements, shared by every Diagram kind

	/**
	 * The Diagram's nodes, read as an imported file is: a peer can write any field,
	 * and an element a file would be refused for (a string `x`, attributes that are
	 * no list) is left out rather than drawn, exported or read over MCP.
	 */
	nodes(diagramId: string): DiagramNode[] {
		const kind = this.requireDiagram(diagramId).get('kind') as DiagramKind;
		return [...this.nodeMap(diagramId).values()]
			.map((n) => n.toJSON() as DiagramNode)
			.filter((n) => isValidNode(n, kind))
			.map((n) => withCompleteAttributes(n));
	}

	/** The Diagram's edges, read as an imported file is, between the nodes read. */
	edges(diagramId: string): DiagramEdge[] {
		const kind = this.requireDiagram(diagramId).get('kind') as DiagramKind;
		// The ends' types, from the nodes a read keeps (without completing them again).
		const types = new Map<string, unknown>();
		for (const n of this.nodeMap(diagramId).values()) {
			const node = n.toJSON() as DiagramNode;
			if (isValidNode(node, kind)) types.set(node.id, node.type);
		}
		return [...this.edgeMap(diagramId).values()]
			.map((e) => e.toJSON() as DiagramEdge)
			.filter((e) => isValidEdge(e, kind, types))
			.map((e) => readEdge(e));
	}

	/** Moves a node; the routes of its Connections or Legs no longer fit and are dropped. */
	moveNode(diagramId: string, nodeId: string, x: number, y: number): void {
		this.moveNodes(diagramId, [{ id: nodeId, x, y }]);
	}

	/** Moves several nodes in one transaction, dropping the routes attached to any of them. */
	moveNodes(diagramId: string, moves: { id: string; x: number; y: number }[]): void {
		const nodes = this.nodeMap(diagramId);
		const moved = new Map<string, Point>();
		this.doc.transact(() => {
			for (const { id, x, y } of moves) {
				const node = nodes.get(id);
				if (!node) continue;
				const offset = {
					x: Math.round(x) - (node.get('x') as number),
					y: Math.round(y) - (node.get('y') as number)
				};
				node.set('x', Math.round(x));
				node.set('y', Math.round(y));
				moved.set(id, offset);
			}
			if (moved.size === 0) return;
			for (const edge of this.edgeMap(diagramId).values()) {
				const points = edge.get('points') as Point[] | undefined;
				if (!points) continue;
				const source = moved.get(edge.get('source') as string);
				const target = moved.get(edge.get('target') as string);
				if (!source && !target) continue;
				// Both ends moved alike (a Zone and its content): the route moves with them.
				if (source && target && source.x === target.x && source.y === target.y) {
					edge.set(
						'points',
						points.map((p) => ({ x: p.x + source.x, y: p.y + source.y }))
					);
				} else edge.delete('points');
			}
		});
	}

	/**
	 * Places many nodes and stores the routes of the edges at once (a Tidy up):
	 * one undo step. Routes hold the inner bends only; edges without one lose any
	 * old route.
	 */
	arrange(
		diagramId: string,
		positions: Map<string, Point>,
		routes: Map<string, Point[]> = new Map(),
		zoneSizes: Map<string, { width: number; height: number }> = new Map()
	): void {
		const nodes = this.nodeMap(diagramId);
		const edges = this.edgeMap(diagramId);
		const moves = [...positions].filter(([id, p]) => {
			const node = nodes.get(id);
			return node && (node.get('x') !== Math.round(p.x) || node.get('y') !== Math.round(p.y));
		});
		const resizes = [...zoneSizes].filter(([id, size]) => {
			const zone = nodes.get(id);
			return (
				zone?.get('type') === 'zone' &&
				(zone.get('width') !== Math.round(size.width) ||
					zone.get('height') !== Math.round(size.height))
			);
		});
		const reroutes = [...edges].filter(
			([id, edge]) => !samePoints(routes.get(id), edge.get('points') as Point[] | undefined)
		);
		// Already in place: no update for collaborators, no empty undo step.
		if (moves.length === 0 && reroutes.length === 0 && resizes.length === 0) return;
		this.undoManager.stopCapturing();
		this.doc.transact(() => {
			for (const [id, { x, y }] of moves) {
				nodes.get(id)!.set('x', Math.round(x));
				nodes.get(id)!.set('y', Math.round(y));
			}
			for (const [id, { width, height }] of resizes) {
				nodes.get(id)!.set('width', Math.round(width));
				nodes.get(id)!.set('height', Math.round(height));
			}
			for (const [id, edge] of reroutes) {
				const route = routes.get(id);
				if (route) edge.set('points', route);
				else edge.delete('points');
			}
		});
		this.undoManager.stopCapturing();
	}

	/** Renames a Component, Zone, Entity or Association; a blank name is ignored. */
	renameNode(diagramId: string, nodeId: string, name: string): void {
		if (name.trim()) this.nodeMap(diagramId).get(nodeId)?.set('name', name.trim());
	}

	/**
	 * Deletes nodes and edges. The edges of a deleted node go with it, an
	 * Association left with fewer than two Legs is deleted with its last Leg,
	 * a CIF goes with its Association, its determined Leg or its last
	 * determinant, and an Inheritance with its parent or its last child.
	 */
	deleteElements(diagramId: string, nodeIds: string[], edgeIds: string[]): void {
		const nodes = this.nodeMap(diagramId);
		const edges = this.edgeMap(diagramId);
		this.doc.transact(() => {
			for (const id of nodeIds) nodes.delete(id);
			for (const id of edgeIds) edges.delete(id);
			for (const [id, edge] of edges) {
				if (!nodes.has(edge.get('source') as string) || !nodes.has(edge.get('target') as string)) {
					edges.delete(id);
				}
			}
			for (const [id, node] of nodes) {
				if (node.get('type') !== 'association') continue;
				const legs = [...edges.values()].filter((e) => e.get('source') === id);
				if (legs.length < 2) {
					for (const leg of legs) edges.delete(leg.get('id') as string);
					nodes.delete(id);
				}
			}
			this.pruneInheritances(diagramId);
			for (const [id, node] of nodes) {
				if (node.get('type') !== 'cif') continue;
				// Whatever a peer wrote: a list that is not one counts as empty.
				const determinants = stringList(node.get('determinants')).filter((leg) => edges.has(leg));
				if (
					!nodes.has(node.get('association') as string) ||
					!edges.has(node.get('determined') as string) ||
					determinants.length === 0
				) {
					nodes.delete(id);
				} else if (determinants.length !== stringList(node.get('determinants')).length) {
					node.set('determinants', determinants);
				}
			}
		});
	}

	// System design diagrams

	addComponent(
		diagramId: string,
		componentType: ComponentType,
		name: string,
		x: number,
		y: number
	): string {
		const id = crypto.randomUUID();
		const component: ComponentNode = {
			id,
			type: 'component',
			x: Math.round(x),
			y: Math.round(y),
			componentType,
			name,
			skin: null
		};
		this.insertNode(diagramId, component);
		return id;
	}

	/**
	 * Changes what a Component is, keeping its id, Connections, Hosting and
	 * Provider: a Skin the new type does not offer goes back to Generic, a Disk
	 * kind goes away unless it is still a Disk, a Runtime unless it is still a
	 * Service, and Hosting and Provider when it becomes or stops being a Person.
	 */
	setComponentType(diagramId: string, componentId: string, componentType: ComponentType): void {
		const component = this.nodeMap(diagramId).get(componentId);
		if (!component) return;
		const before = component.get('componentType') as string;
		this.doc.transact(() => {
			this.setNodeChoice(
				diagramId,
				componentId,
				'componentType',
				componentType,
				COMPONENT_TYPE_IDS
			);
			if (component.get('componentType') !== componentType) return;
			// What the old type hid (a removed Skin, a peer's Runtime on a Database) must not
			// show up under the new one: only what the Component showed carries over.
			const skin = component.get('skin') as string | null;
			if (skin && !(skinFits(before, skin) && skinFits(componentType, skin))) {
				component.set('skin', null);
			}
			if (componentType !== 'disk' && component.has('diskKind')) component.delete('diskKind');
			// Someone has no Hosting nor Provider, nor brings back one a peer left on it.
			if (isPerson(before) || isPerson(componentType)) {
				component.delete('hosting');
				component.delete('provider');
			}
			if ((before !== 'service' || componentType !== 'service') && component.has('runtime')) {
				component.delete('runtime');
			}
		});
	}

	/** Applies a Skin to a Component, or clears it with null (Generic). */
	setSkin(diagramId: string, componentId: string, skin: string | null): void {
		this.nodeMap(diagramId).get(componentId)?.set('skin', skin);
	}

	/**
	 * Says whose infrastructure a Component, or everything in a Zone, runs on;
	 * null clears it, an unknown value is ignored.
	 */
	setProvider(diagramId: string, nodeId: string, provider: Provider | null): void {
		if (isPerson(this.nodeMap(diagramId).get(nodeId)?.get('componentType'))) return;
		this.setNodeChoice(diagramId, nodeId, 'provider', provider, PROVIDERS, ['component', 'zone']);
	}

	/** Says what a Disk is, or clears it with null; ignored on other Components or for an unknown value. */
	setDiskKind(diagramId: string, diskId: string, kind: DiskKind | null): void {
		if (this.nodeMap(diagramId).get(diskId)?.get('componentType') !== 'disk') return;
		this.setNodeChoice(diagramId, diskId, 'diskKind', kind, DISK_KINDS);
	}

	/** Says what runs a Service, or clears it with null; ignored on other Components or for an unknown value. */
	setRuntime(diagramId: string, serviceId: string, runtime: Runtime | null): void {
		if (this.nodeMap(diagramId).get(serviceId)?.get('componentType') !== 'service') return;
		this.setNodeChoice(diagramId, serviceId, 'runtime', runtime, RUNTIMES);
	}

	/** Says where a Component runs, or clears it with null; an unknown value is ignored. */
	setHosting(diagramId: string, componentId: string, hosting: Hosting | null): void {
		if (isPerson(this.nodeMap(diagramId).get(componentId)?.get('componentType'))) return;
		this.setNodeChoice(diagramId, componentId, 'hosting', hosting, HOSTINGS);
	}

	/** Joins two different Components with a directed Connection; null otherwise (a Zone, say). */
	addConnection(diagramId: string, source: string, target: string): string | null {
		if (source === target) return null;
		const nodes = this.nodeMap(diagramId);
		if (nodes.get(source)?.get('type') !== 'component') return null;
		if (nodes.get(target)?.get('type') !== 'component') return null;
		const id = crypto.randomUUID();
		const connection: ConnectionEdge = { id, type: 'connection', source, target, label: '' };
		this.insertEdge(diagramId, connection);
		return id;
	}

	/** Draws a Zone; it groups whatever is drawn inside it. */
	addZone(
		diagramId: string,
		x: number,
		y: number,
		width: number = ZONE_DEFAULT.width,
		height: number = ZONE_DEFAULT.height,
		name: string = 'Zone'
	): string {
		const id = crypto.randomUUID();
		const zone: ZoneNode = {
			id,
			type: 'zone',
			name: name.trim() || 'Zone',
			...roundedBox({ x, y, width, height }, ZONE_MIN)
		};
		this.insertNode(diagramId, zone);
		return id;
	}

	/**
	 * Pastes a clip shifted by dx, dy, in one undo step: every element gets a new
	 * id, edges follow their ends and keep their routes; what this Diagram's kind
	 * does not take, or what does not hold together, is left out, with the edges
	 * touching it. The new elements' ids.
	 */
	paste(
		diagramId: string,
		clip: { nodes: DiagramNode[]; edges: DiagramEdge[] },
		dx: number,
		dy: number
	): string[] {
		const kind = this.diagram(diagramId)?.kind;
		if (!kind || !Number.isFinite(dx) || !Number.isFinite(dy)) return [];
		const { nodes, edges } = pasteable(clip, kind);
		const fresh = new Map(nodes.map((n) => [n.id, crypto.randomUUID()]));
		const freshEdges = new Map(edges.map((e) => [e.id, crypto.randomUUID()]));
		const shift = (p: Point) => ({ x: Math.round(p.x + dx), y: Math.round(p.y + dy) });
		// A CIF names its Association and Legs, an Inheritance its parent: the pasted ones.
		const relinked = (node: DiagramNode): DiagramNode => {
			if (node.type === 'inheritance') return { ...node, parent: fresh.get(String(node.parent))! };
			if (node.type !== 'cif') return node;
			const cif = node as CifNode;
			return {
				...cif,
				association: fresh.get(cif.association)!,
				determinants: cif.determinants.map((leg) => freshEdges.get(leg)!),
				determined: freshEdges.get(cif.determined)!
			} as CifNode;
		};
		this.doc.transact(() => {
			for (const node of nodes) {
				this.insertNode(diagramId, { ...relinked(node), id: fresh.get(node.id)!, ...shift(node) });
			}
			for (const edge of edges) {
				const points = (edge as Route).points;
				const id = freshEdges.get(edge.id)!;
				this.insertEdge(diagramId, {
					...edge,
					id,
					source: fresh.get(edge.source)!,
					target: fresh.get(edge.target)!,
					...(points && { points: points.map(shift) })
				});
			}
		});
		return [...fresh.values(), ...freshEdges.values()];
	}

	/** Writes a Note at x, y, empty and yellow unless told otherwise. */
	addNote(diagramId: string, x: number, y: number, text: string = ''): string {
		const id = crypto.randomUUID();
		const note: NoteNode = {
			id,
			type: 'note',
			x: Math.round(x),
			y: Math.round(y),
			text: noteText(text)
		};
		this.insertNode(diagramId, note);
		return id;
	}

	/** Rewrites a Note's text; ignored on other elements. */
	setNoteText(diagramId: string, noteId: string, text: string): void {
		const note = this.nodeMap(diagramId).get(noteId);
		if (note?.get('type') !== 'note' || note.get('text') === noteText(text)) return;
		note.set('text', noteText(text));
	}

	/**
	 * Sets a Note's width, within NOTE_WIDTHS, and its left side (`x`), which
	 * moves when it is resized from the left.
	 */
	setNoteWidth(diagramId: string, noteId: string, x: number, width: number): void {
		const note = this.nodeMap(diagramId).get(noteId);
		if (note?.get('type') !== 'note' || !Number.isFinite(width)) return;
		const bounded = boundedNoteWidth(width);
		this.doc.transact(() => {
			// A Note whose x is unreadable keeps it: its width is set all the same.
			if (Number.isFinite(x) && note.get('x') !== Math.round(x)) note.set('x', Math.round(x));
			if (note.get('width') !== bounded) note.set('width', bounded);
		});
	}

	/** Colors a Note, yellow with null; an unknown color is ignored. */
	setNoteColor(diagramId: string, noteId: string, color: NoteColor | null): void {
		this.setNodeChoice(diagramId, noteId, 'color', color === 'yellow' ? null : color, NOTE_COLORS, [
			'note'
		]);
	}

	/** Places and sizes a Zone, never smaller than ZONE_MIN; its content stays where it is. */
	setZoneBox(diagramId: string, zoneId: string, box: Box): void {
		this.setBox(diagramId, zoneId, 'zone', box, ZONE_MIN);
	}

	setEdgeLabel(diagramId: string, edgeId: string, label: string): void {
		this.edgeMap(diagramId).get(edgeId)?.set('label', label.trim());
	}

	/** Says what a Connection's data does, or clears it with null; ignored on Legs or for an unknown value. */
	setConnectionFlow(diagramId: string, connectionId: string, flow: Flow | null): void {
		const connection = this.edgeMap(diagramId).get(connectionId);
		if (
			connection?.get('type') !== 'connection' ||
			connection.get('flow') === (flow ?? undefined)
		) {
			return;
		}
		if (flow === null) connection.delete('flow');
		else if (FLOWS.includes(flow)) connection.set('flow', flow);
	}

	/** Puts a Connection's label along its line (0 to 1), or back to the automatic placing with null. */
	setLabelPosition(diagramId: string, connectionId: string, position: number | null): void {
		const connection = this.edgeMap(diagramId).get(connectionId);
		if (connection?.get('type') !== 'connection') return;
		if (position === null) connection.delete('labelPosition');
		else if (isNumber(position)) {
			const value = Math.round(Math.min(1, Math.max(0, position)) * 1000) / 1000;
			if (connection.get('labelPosition') !== value) connection.set('labelPosition', value);
		}
	}

	// MCDs

	addArea(diagramId: string, box: Box, label: string = ''): string {
		if (this.requireDiagram(diagramId).get('kind') !== 'mcd') {
			throw new Error('An Area goes on an MCD');
		}
		const area: AreaNode = {
			id: crypto.randomUUID(),
			type: 'area',
			label: areaLabel(label),
			...roundedBox(box, AREA_MIN)
		};
		this.insertNode(diagramId, area);
		return area.id;
	}

	/** Sets an Area's label; an empty one is fine. */
	setAreaLabel(diagramId: string, areaId: string, label: string): void {
		const area = this.nodeMap(diagramId).get(areaId);
		const text = areaLabel(label);
		if (area?.get('type') === 'area' && area.get('label') !== text) area.set('label', text);
	}

	setAreaColor(diagramId: string, areaId: string, color: AreaColor): void {
		this.setNodeChoice(diagramId, areaId, 'color', color === 'blue' ? null : color, AREA_COLORS, [
			'area'
		]);
	}

	setAreaBox(diagramId: string, areaId: string, box: Box): void {
		this.setBox(diagramId, areaId, 'area', box, AREA_MIN);
	}

	addEntity(diagramId: string, x: number, y: number, name: string = 'Entity'): string {
		const id = crypto.randomUUID();
		const entity: EntityNode = {
			id,
			type: 'entity',
			x: Math.round(x),
			y: Math.round(y),
			name,
			attributes: [
				{
					id: crypto.randomUUID(),
					name: 'id',
					identifier: true,
					type: dataType('serial'),
					optional: false
				}
			]
		};
		this.insertNode(diagramId, entity);
		return id;
	}

	/**
	 * Creates an Association between two Entities, or a reflexive one when both
	 * are the same, with a 0,n Leg to each, placed between them.
	 */
	addAssociation(
		diagramId: string,
		entityA: string,
		entityB: string,
		name: string = 'Association'
	): string {
		const nodes = this.nodeMap(diagramId);
		const a = nodes.get(entityA);
		const b = nodes.get(entityB);
		if (a?.get('type') !== 'entity' || b?.get('type') !== 'entity') {
			throw new Error('An Association joins Entities');
		}
		const id = crypto.randomUUID();
		const [ax, ay, bx, by] = [a.get('x'), a.get('y'), b.get('x'), b.get('y')] as number[];
		const association: AssociationNode = {
			id,
			type: 'association',
			x: entityA === entityB ? ax + 260 : Math.round((ax + bx) / 2),
			y: entityA === entityB ? ay : Math.round((ay + by) / 2),
			name,
			attributes: []
		};
		this.doc.transact(() => {
			this.insertNode(diagramId, association);
			for (const entity of [entityA, entityB]) {
				const leg: LegEdge = {
					id: crypto.randomUUID(),
					type: 'leg',
					source: id,
					target: entity,
					cardinality: '0,n'
				};
				this.insertEdge(diagramId, leg);
			}
		});
		return id;
	}

	/** A node's type, without reading the whole Diagram. */
	nodeType(diagramId: string, nodeId: string): string | undefined {
		const type = this.nodeMap(diagramId).get(nodeId)?.get('type');
		return typeof type === 'string' ? type : undefined;
	}

	/**
	 * Adds a 0,n Leg from an Association to an Entity (the same Entity again
	 * for a reflexive one): three Legs or more make an N-ary Association.
	 */
	addLeg(diagramId: string, associationId: string, entityId: string): string {
		const nodes = this.nodeMap(diagramId);
		if (
			nodes.get(associationId)?.get('type') !== 'association' ||
			nodes.get(entityId)?.get('type') !== 'entity'
		) {
			throw new Error('A Leg joins an Association to an Entity');
		}
		const leg: LegEdge = {
			id: crypto.randomUUID(),
			type: 'leg',
			source: associationId,
			target: entityId,
			cardinality: '0,n'
		};
		this.doc.transact(() => {
			this.insertEdge(diagramId, leg);
			// N-ary now: no relative identifier any more.
			for (const edge of this.edgeMap(diagramId).values()) {
				if (edge.get('source') === associationId) edge.delete('relative');
			}
		});
		return leg.id;
	}

	/**
	 * Puts a CIF on an N-ary Association, above it: it determines the Leg with
	 * a max of 1 if there is one, else the last Leg, by all the others.
	 */
	addCif(diagramId: string, associationId: string): string {
		const association = this.nodeMap(diagramId).get(associationId);
		const legs = [...this.edgeMap(diagramId).values()]
			.filter((e) => e.get('type') === 'leg' && e.get('source') === associationId)
			.map((e) => ({
				id: e.get('id') as string,
				cardinality: e.get('cardinality') as Cardinality
			}));
		if (association?.get('type') !== 'association' || legs.length < 3) {
			throw new Error('A CIF goes on an Association with three Legs or more');
		}
		const determined =
			legs.find((l) => l.cardinality === '0,1' || l.cardinality === '1,1') ?? legs[legs.length - 1];
		// Another CIF on the same Association goes beside the first, not on it.
		const siblings = [...this.nodeMap(diagramId).values()].filter(
			(n) => n.get('type') === 'cif' && n.get('association') === associationId
		).length;
		const cif: CifNode = {
			id: crypto.randomUUID(),
			type: 'cif',
			x: (association.get('x') as number) + CIF_OFFSET.x + siblings * (CIF_SIZE.width + 12),
			y: (association.get('y') as number) + CIF_OFFSET.y,
			association: associationId,
			determinants: legs.filter((l) => l !== determined).map((l) => l.id),
			determined: determined.id
		};
		this.insertNode(diagramId, cif);
		return cif.id;
	}

	/**
	 * Gives a Leg of its Association a part in a CIF. A new determined Leg leaves
	 * the former one out. Ignored: taking the determined Leg away (choose another
	 * first) and removing the last determinant (a CIF needs one).
	 */
	setCifRole(diagramId: string, cifId: string, legId: string, role: CifRole): void {
		const cif = this.nodeMap(diagramId).get(cifId);
		const leg = this.edgeMap(diagramId).get(legId);
		if (cif?.get('type') !== 'cif' || leg?.get('source') !== cif.get('association')) return;
		const determinants = stringList(cif.get('determinants')).filter((id) => id !== legId);
		const determined = cif.get('determined') as string;
		if (role === 'determinant') determinants.push(legId);
		if (determinants.length === 0) return;
		this.doc.transact(() => {
			if (role === 'determined') cif.set('determined', legId);
			else if (determined === legId) return;
			cif.set('determinants', determinants);
		});
	}

	/** The parent of an Entity, through the Inheritance it is a child of; null when it has none. */
	parentOf(diagramId: string, entityId: string): string | null {
		const nodes = this.nodeMap(diagramId);
		for (const edge of this.edgeMap(diagramId).values()) {
			if (edge.get('type') !== 'isa' || edge.get('target') !== entityId) continue;
			const parent = nodes.get(edge.get('source') as string)?.get('parent');
			if (isString(parent)) return parent;
		}
		return null;
	}

	/**
	 * The Entity itself and all its descendants: the parents it cannot take
	 * without a cycle. One pass over the edges.
	 */
	selfAndDescendants(diagramId: string, entityId: string): Set<string> {
		const nodes = this.nodeMap(diagramId);
		const childrenOf = new Map<string, string[]>();
		for (const edge of this.edgeMap(diagramId).values()) {
			if (edge.get('type') !== 'isa') continue;
			const parent = nodes.get(edge.get('source') as string)?.get('parent');
			if (!isString(parent)) continue;
			childrenOf.set(parent, [...(childrenOf.get(parent) ?? []), edge.get('target') as string]);
		}
		const found = new Set([entityId]);
		for (const id of found) for (const child of childrenOf.get(id) ?? []) found.add(child);
		return found;
	}

	/**
	 * Makes `childId` a child of `parentId` (null: of none), under the parent's
	 * Inheritance, made under the parent when it has none. An Inheritance left
	 * without children is deleted. A parent that is the child or one of its
	 * descendants is refused.
	 */
	setParent(diagramId: string, childId: string, parentId: string | null): void {
		const nodes = this.nodeMap(diagramId);
		const edges = this.edgeMap(diagramId);
		if (nodes.get(childId)?.get('type') !== 'entity') throw new Error('Only an Entity inherits');
		if (parentId !== null) {
			if (nodes.get(parentId)?.get('type') !== 'entity')
				throw new Error('Only an Entity is a parent');
			if (this.selfAndDescendants(diagramId, childId).has(parentId)) {
				throw new Error('An Entity cannot inherit from itself or a descendant');
			}
		}
		this.doc.transact(() => {
			// Set again to the same parent, the link keeps its foreign key's name.
			let fkName: unknown;
			for (const [id, edge] of edges) {
				if (edge.get('type') !== 'isa' || edge.get('target') !== childId) continue;
				if (nodes.get(edge.get('source') as string)?.get('parent') === parentId) {
					fkName ??= edge.get('fkName');
				}
				edges.delete(id);
			}
			if (parentId !== null) {
				// The parent's first Inheritance by id, as the MLD reads it, should peers have made two.
				let inheritance = [...nodes.values()]
					.filter((n) => n.get('type') === 'inheritance' && n.get('parent') === parentId)
					.sort((a, b) => String(a.get('id')).localeCompare(String(b.get('id'))))[0];
				if (!inheritance) {
					const parent = nodes.get(parentId)!;
					const made: InheritanceNode = {
						id: crypto.randomUUID(),
						type: 'inheritance',
						x: (parent.get('x') as number) + INHERITANCE_OFFSET.x,
						y: (parent.get('y') as number) + INHERITANCE_OFFSET.y,
						parent: parentId
					};
					this.insertNode(diagramId, made);
					inheritance = nodes.get(made.id)!;
				}
				const isa: IsaEdge = {
					id: crypto.randomUUID(),
					type: 'isa',
					source: inheritance.get('id') as string,
					target: childId,
					...(isForeignKeyName(fkName) && { fkName })
				};
				this.insertEdge(diagramId, isa);
			}
			this.pruneInheritances(diagramId);
		});
	}

	setInheritanceConstraint(
		diagramId: string,
		inheritanceId: string,
		constraint: InheritanceConstraint
	): void {
		const node = this.nodeMap(diagramId).get(inheritanceId);
		if (node?.get('type') !== 'inheritance' || !INHERITANCE_CONSTRAINTS.includes(constraint))
			return;
		if (constraint === 'none') node.delete('constraint');
		else node.set('constraint', constraint);
	}

	setInheritanceTranslation(
		diagramId: string,
		inheritanceId: string,
		translation: InheritanceTranslation
	): void {
		const node = this.nodeMap(diagramId).get(inheritanceId);
		if (node?.get('type') !== 'inheritance' || !INHERITANCE_TRANSLATIONS.includes(translation)) {
			return;
		}
		if (translation === 'reference') node.delete('translation');
		else node.set('translation', translation);
	}

	/**
	 * Merges the Inheritances two peers made for one parent into its first by
	 * id, then deletes those without parent or without children, with their edges.
	 */
	private pruneInheritances(diagramId: string): void {
		const nodes = this.nodeMap(diagramId);
		const edges = this.edgeMap(diagramId);
		const first = new Map<string, string>();
		const byId = [...nodes.entries()]
			.filter(([, n]) => n.get('type') === 'inheritance')
			.sort(([a], [b]) => a.localeCompare(b));
		for (const [id, node] of byId) {
			const parent = String(node.get('parent'));
			const kept = first.get(parent);
			if (!kept) {
				first.set(parent, id);
				continue;
			}
			for (const edge of edges.values()) if (edge.get('source') === id) edge.set('source', kept);
		}
		for (const [id, node] of nodes) {
			if (node.get('type') !== 'inheritance') continue;
			const children = [...edges.values()].filter((e) => e.get('source') === id);
			if (!nodes.has(node.get('parent') as string) || children.length === 0) {
				for (const child of children) edges.delete(child.get('id') as string);
				nodes.delete(id);
			}
		}
	}

	/** Sets a Leg's Cardinality; a relative identifier needs 1,1 and goes with any other. */
	setCardinality(diagramId: string, legId: string, cardinality: Cardinality): void {
		const leg = this.edgeMap(diagramId).get(legId);
		if (!leg) return;
		this.doc.transact(() => {
			leg.set('cardinality', cardinality);
			if (cardinality !== '1,1') leg.delete('relative');
		});
	}

	/**
	 * Marks a Leg relative (its Entity identified relative to the other one) or
	 * not; only where `canBeRelative` says.
	 */
	setRelative(diagramId: string, legId: string, relative: boolean): void {
		const leg = this.edgeMap(diagramId).get(legId);
		if (leg?.get('type') !== 'leg') return;
		if (!relative) {
			leg.delete('relative');
			return;
		}
		if (!canBeRelative(this.edges(diagramId), legId)) {
			throw new Error(
				'A relative identifier goes on a 1,1 Leg of a binary Association between two Entities.'
			);
		}
		leg.set('relative', true);
	}

	/** Moves a Leg to the next Cardinality: 0,1 → 1,1 → 0,n → 1,n → 0,1. */
	cycleCardinality(diagramId: string, legId: string): void {
		const leg = this.edgeMap(diagramId).get(legId);
		if (!leg) return;
		const index = CARDINALITIES.indexOf(leg.get('cardinality') as Cardinality);
		this.setCardinality(diagramId, legId, CARDINALITIES[(index + 1) % CARDINALITIES.length]);
	}

	/** Adds an Attribute to an Entity or an Association. */
	addAttribute(diagramId: string, nodeId: string, name: string = 'attribute'): string {
		const id = crypto.randomUUID();
		this.updateAttributes(diagramId, nodeId, (list) => [
			...list,
			{
				id,
				name: name.trim() || 'attribute',
				identifier: false,
				type: dataType('text'),
				optional: false
			}
		]);
		return id;
	}

	renameAttribute(diagramId: string, nodeId: string, attributeId: string, name: string): void {
		if (!name.trim()) return;
		this.updateAttributes(diagramId, nodeId, (list) =>
			list.map((a) => (a.id === attributeId ? { ...a, name: name.trim() } : a))
		);
	}

	/** Moves an Attribute one place up (-1) or down (+1). */
	moveAttribute(diagramId: string, nodeId: string, attributeId: string, offset: -1 | 1): void {
		this.updateAttributes(diagramId, nodeId, (list) => {
			const from = list.findIndex((a) => a.id === attributeId);
			const to = from + offset;
			if (from < 0 || to < 0 || to >= list.length) return list;
			const moved = [...list];
			[moved[from], moved[to]] = [moved[to], moved[from]];
			return moved;
		});
	}

	/** Moves an Attribute to `index` in its list (from 0), clamped to the list. */
	moveAttributeTo(diagramId: string, nodeId: string, attributeId: string, index: number): void {
		this.updateAttributes(diagramId, nodeId, (list) => {
			const moved = list.find((a) => a.id === attributeId);
			if (!moved) return list;
			const rest = list.filter((a) => a !== moved);
			const at = Math.min(rest.length, Math.max(0, Math.round(index)));
			return [...rest.slice(0, at), moved, ...rest.slice(at)];
		});
	}

	removeAttribute(diagramId: string, nodeId: string, attributeId: string): void {
		this.doc.transact(() => {
			this.updateAttributes(diagramId, nodeId, (list) => list.filter((a) => a.id !== attributeId));
			const groups = this.nodeMap(diagramId).get(nodeId)?.get('uniques');
			if (groups !== undefined) this.setUniqueGroups(diagramId, nodeId, readGroups(groups));
		});
	}

	/** Makes an Entity's Attribute part of its Identifier, or no longer. */
	toggleIdentifier(diagramId: string, entityId: string, attributeId: string): void {
		if (this.nodeMap(diagramId).get(entityId)?.get('type') !== 'entity') return;
		this.updateAttributes(diagramId, entityId, (list) =>
			list.map((a) =>
				a.id === attributeId ? { ...a, identifier: !a.identifier, optional: false } : a
			)
		);
	}

	setAttributeType(diagramId: string, nodeId: string, attributeId: string, type: DataType): void {
		if (!isDataType(type)) return;
		this.updateAttributes(diagramId, nodeId, (list) =>
			list.map((a) =>
				a.id === attributeId
					? { ...a, type, optional: a.optional && canBeOptional({ ...a, type }) }
					: a
			)
		);
	}

	/** Lets a column accept NULL, or not; an Identifier stays required. */
	setAttributeOptional(
		diagramId: string,
		nodeId: string,
		attributeId: string,
		optional: boolean
	): void {
		this.updateAttributes(diagramId, nodeId, (list) =>
			list.map((a) => (a.id === attributeId ? { ...a, optional: optional && canBeOptional(a) } : a))
		);
	}

	setAttributeUnique(
		diagramId: string,
		nodeId: string,
		attributeId: string,
		unique: boolean
	): void {
		this.updateAttributes(diagramId, nodeId, (list) =>
			list.map((a) => (a.id === attributeId ? withOptional(a, 'unique', unique || undefined) : a))
		);
	}

	/** Sets an Attribute's Check, or clears it with an empty one; throws why it is refused. */
	setAttributeCheck(diagramId: string, nodeId: string, attributeId: string, check: string): void {
		const text = cleanCheck(check);
		const problem = text ? checkProblem(text) : null;
		if (problem) throw new ConstraintError(problem);
		this.updateAttributes(diagramId, nodeId, (list) =>
			list.map((a) => (a.id === attributeId ? withOptional(a, 'check', text || undefined) : a))
		);
	}

	/** Sets an Attribute's Comment, or clears it with an empty one. */
	setAttributeComment(
		diagramId: string,
		nodeId: string,
		attributeId: string,
		comment: string
	): void {
		const text = cleanComment(comment);
		this.updateAttributes(diagramId, nodeId, (list) =>
			list.map((a) => (a.id === attributeId ? withOptional(a, 'comment', text || undefined) : a))
		);
	}

	/** Sets an Entity's or an Association's Comment, or clears it with an empty one. */
	setComment(diagramId: string, nodeId: string, comment: string): void {
		const node = this.nodeMap(diagramId).get(nodeId);
		if (node?.get('type') !== 'entity' && node?.get('type') !== 'association') return;
		const text = cleanComment(comment);
		if (!text) node.delete('comment');
		else if (node.get('comment') !== text) node.set('comment', text);
	}

	/** Sets an Entity's Unique groups, each of two of its Attributes or more; others are left out. */
	setUniqueGroups(diagramId: string, entityId: string, groups: string[][]): void {
		const node = this.nodeMap(diagramId).get(entityId);
		if (node?.get('type') !== 'entity') return;
		const attributes = (node.get('attributes') as Partial<Attribute>[] | undefined) ?? [];
		const kept = uniqueGroups(groups, completeAttributes(attributes));
		if (kept.length === 0) node.delete('uniques');
		else node.set('uniques', kept);
	}

	/** Names the foreign key a Leg or an Inheritance link makes, or clears the name with null. */
	setForeignKeyName(diagramId: string, edgeId: string, name: string | null): void {
		const edge = this.edgeMap(diagramId).get(edgeId);
		if (edge?.get('type') !== 'leg' && edge?.get('type') !== 'isa') return;
		if (name === null || name === '') edge.delete('fkName');
		else if (!isForeignKeyName(name)) throw new ConstraintError('foreignKeyName');
		else if (edge.get('fkName') !== name) edge.set('fkName', name);
	}

	// Undo and redo

	undo(): void {
		this.undoManager.undo();
	}

	redo(): void {
		this.undoManager.redo();
	}

	/** Ends the current undo step, so the next change undoes on its own. */
	stopCapturing(): void {
		this.undoManager.stopCapturing();
	}

	/** Stops tracking undo; for a short-lived wrapper around a document someone else owns. */
	destroy(): void {
		this.undoManager.destroy();
	}

	subscribe(listener: () => void): () => void {
		this.doc.on('update', listener);
		return () => this.doc.off('update', listener);
	}

	/**
	 * Calls `listener` on changes made here (an operation, undo or redo), not on
	 * changes loaded from storage, received from collaborators or migrations.
	 */
	subscribeLocalEdits(listener: () => void): () => void {
		const onUpdate = (_update: Uint8Array, origin: unknown) => {
			if (origin === null || origin === this.undoManager) listener();
		};
		this.doc.on('update', onUpdate);
		return () => this.doc.off('update', onUpdate);
	}

	// JSON file

	toFile(): ProjectFile {
		return {
			format: FILE_FORMAT,
			version: FILE_VERSION,
			name: this.name(),
			diagrams: this.diagrams().map((d) => ({
				...d,
				nodes: this.nodes(d.id),
				edges: this.edges(d.id)
			}))
		};
	}

	/** Builds a Project from an exported file; throws on a file this app did not write. */
	static fromFile(data: unknown): ProjectDocument {
		const file = parseFile(data);
		const project = new ProjectDocument();
		project.doc.transact(() => {
			project.meta.set('name', file.name.trim() || 'Imported project');
			for (const d of file.diagrams) {
				const diagram = new Y.Map<unknown>();
				diagram.set('id', d.id);
				diagram.set('kind', d.kind);
				diagram.set('name', d.name);
				diagram.set('createdAt', d.createdAt);
				if (d.kind === 'mcd' && d.tidyDirection === 'vertical') {
					diagram.set('tidyDirection', 'vertical');
				}
				diagram.set(
					'nodes',
					toFieldsMap(d.nodes.map((n) => known(withCompleteAttributes(n), NODE_FIELDS)))
				);
				diagram.set('edges', toFieldsMap(d.edges.map((e) => known(readEdge(e), EDGE_FIELDS))));
				project.diagramMap.set(d.id, diagram);
			}
		});
		project.undoManager.clear();
		return project;
	}

	// Helpers for the kind-specific operations

	private insertNode(diagramId: string, node: DiagramNode): void {
		this.nodeMap(diagramId).set(node.id, toFields(node));
	}

	private insertEdge(diagramId: string, edge: DiagramEdge): void {
		this.edgeMap(diagramId).set(edge.id, toFields(edge));
	}

	/**
	 * Dates a Diagram between `previous` (none: first) and those that follow: tabs
	 * are in that order. With no room left there, just after `previous`, moving
	 * those that follow as little as needed.
	 */
	private placeDiagram(id: string, previous: Diagram | undefined, following: Diagram[]): void {
		const next = following[0]?.createdAt;
		const after = previous ? previous.createdAt + 1 : next! - 1;
		const middle = previous && next !== undefined ? (previous.createdAt + next) / 2 : after;
		const fits =
			(!previous || middle > previous.createdAt) && (next === undefined || middle < next);
		let last = fits ? middle : after;
		this.requireDiagram(id).set('createdAt', last);
		for (const d of following) {
			if (d.createdAt > last) break;
			this.requireDiagram(d.id).set('createdAt', ++last);
		}
	}

	private setBox(
		diagramId: string,
		nodeId: string,
		type: 'zone' | 'area',
		box: Box,
		min: { width: number; height: number }
	): void {
		const node = this.nodeMap(diagramId).get(nodeId);
		const { x, y, width, height } = box;
		if (node?.get('type') !== type || ![x, y, width, height].every(isNumber)) return;
		this.doc.transact(() => {
			for (const [key, value] of Object.entries(roundedBox(box, min))) {
				if (node.get(key) !== value) node.set(key, value);
			}
		});
	}

	/**
	 * Sets a node field to one of `allowed`, or clears it with null, on the
	 * node types given (Components by default); anything else is ignored.
	 */
	private setNodeChoice(
		diagramId: string,
		nodeId: string,
		key: string,
		value: string | null,
		allowed: readonly string[],
		types: readonly string[] = ['component']
	): void {
		if (value !== null && !allowed.includes(value)) return;
		const node = this.nodeMap(diagramId).get(nodeId);
		if (!node || !types.includes(node.get('type') as string)) return;
		if (value === null) node.delete(key);
		else if (node.get(key) !== value) node.set(key, value);
	}

	private nodeMap(diagramId: string): Entries {
		return new Entries(this.requireDiagram(diagramId).get('nodes') as Y.Map<Fields>);
	}

	private edgeMap(diagramId: string): Entries {
		return new Entries(this.requireDiagram(diagramId).get('edges') as Y.Map<Fields>);
	}

	private updateAttributes(
		diagramId: string,
		nodeId: string,
		change: (attributes: Attribute[]) => Attribute[]
	): void {
		const node = this.nodeMap(diagramId).get(nodeId);
		if (!node) return;
		const stored = (node.get('attributes') as Partial<Attribute>[] | undefined) ?? [];
		node.set('attributes', change(completeAttributes(stored)));
	}

	/** A diagram reads may use: no write lands on an entry the app cannot read. */
	private requireDiagram(id: string): Fields {
		const diagram = this.diagramMap.get(id);
		if (!isReadableDiagram(id, diagram)) throw new Error(`Unknown diagram ${id}`);
		return diagram;
	}
}

/** `X copy`, then `X copy 2`…, counting on from a copy's own number: the first not taken. */
function copyName(name: string, taken: Set<string>): string {
	const [, base, isCopy, number] = /^(.*?)( copy(?: (\d{1,6}))?)?$/s.exec(name.trim())!;
	const start = `${base} copy`.trim();
	let rank = isCopy ? Number(number ?? 1) + 1 : 1;
	const named = () => (rank === 1 ? start : `${start} ${rank}`);
	while (taken.has(named())) rank++;
	return named();
}

/** A box as stored: whole pixels, not smaller than `min`. */
function roundedBox(box: Box, min: { width: number; height: number }): Box {
	return {
		x: Math.round(box.x),
		y: Math.round(box.y),
		width: Math.round(Math.max(min.width, box.width)),
		height: Math.round(Math.max(min.height, box.height))
	};
}

/** An Area's label as stored: one line, bounded (by character, so that none is cut in two). */
const areaLabel = (label: string) =>
	[
		...label
			.replace(/\s/g, ' ')
			.trim()
			.slice(0, MAX_AREA_LABEL * 2)
	]
		.slice(0, MAX_AREA_LABEL)
		.join('')
		.trimEnd();

function samePoints(a: Point[] | undefined, b: Point[] | undefined): boolean {
	if (!a || !b) return a === b;
	return a.length === b.length && a.every((p, i) => p.x === b[i].x && p.y === b[i].y);
}

/**
 * Attributes written before Data types existed (by an older version, a file or
 * a peer) are completed when read, never rewritten in place, so they cannot
 * race a collaborator's edits: the only Identifier of an Entity reads as
 * Auto-increment, any other Attribute as Text, all required.
 */
function completeAttributes(attributes: Partial<Attribute>[]): Attribute[] {
	const loneIdentifier = attributes.filter((a) => a.identifier).length === 1;
	return attributes.map((a, index) => {
		const type = a.type
			? cleanDataType(a.type)
			: dataType(a.identifier && loneIdentifier ? 'serial' : 'text');
		return {
			// Stable across reads, so the UI keeps its rows.
			id: a.id ?? `attribute-${index}`,
			name: a.name ?? 'attribute',
			identifier: a.identifier ?? false,
			type,
			optional: canBeOptional({ identifier: a.identifier ?? false, type }) && (a.optional ?? false),
			// Whatever a file or a peer wrote: what the rules refuse is left out.
			...(a.unique === true && { unique: true as const }),
			...(isString(a.check) && checkProblem(a.check) === null && { check: a.check }),
			...(isString(a.comment) && cleanComment(a.comment) && { comment: cleanComment(a.comment) })
		};
	});
}

/** An Attribute with an optional field set, or without it. */
function withOptional<K extends 'unique' | 'check' | 'comment'>(
	attribute: Attribute,
	key: K,
	value: Attribute[K]
): Attribute {
	const next = { ...attribute };
	if (value === undefined) delete next[key];
	else next[key] = value;
	return next;
}

/** Stored Unique groups, or none when a peer or a file wrote something else. */
const readGroups = (value: unknown): string[][] =>
	Array.isArray(value) ? value.slice(0, 100).map(stringList) : [];

/** The groups as they can be: known Attributes, each once, two or more, no group twice. */
function uniqueGroups(groups: string[][], attributes: Attribute[]): string[][] {
	const known = new Set(attributes.map((a) => a.id));
	const seen = new Set<string>();
	return groups
		.map((group) => [...new Set(group)].filter((id) => known.has(id)))
		.filter((group) => {
			const key = JSON.stringify([...group].sort());
			if (group.length < 2 || seen.has(key)) return false;
			seen.add(key);
			return true;
		});
}

/** An Identifier or an Auto-increment column is never NULL. */
const canBeOptional = (a: Pick<Attribute, 'identifier' | 'type'>) =>
	!a.identifier && a.type.kind !== 'serial';

/** Node fields that take one of a list (on Components, Zones); a value this version does not know reads as unspecified. */
const NODE_CHOICES: [string, readonly string[]][] = [
	['hosting', HOSTINGS],
	['provider', PROVIDERS],
	['diskKind', DISK_KINDS],
	['runtime', RUNTIMES],
	['color', NOTE_COLORS],
	// Stored only when not the default (none, by reference).
	['constraint', INHERITANCE_CONSTRAINTS.filter((c) => c !== 'none')],
	['translation', INHERITANCE_TRANSLATIONS.filter((t) => t !== 'reference')]
];

/**
 * A node as the app reads it: old Attributes completed, and a Hosting, a
 * Provider, a Disk kind or a Runtime this version does not know (a newer file
 * or peer), or that its type does not take, read as unspecified.
 */
function withCompleteAttributes<T extends Record<string, unknown>>(node: T): DiagramNode {
	// Only these have Attributes, checked to be a list, whatever a peer wrote on another.
	const attributes =
		node.type === 'entity' || node.type === 'association'
			? (node.attributes as Partial<Attribute>[] | undefined)
			: undefined;
	const read: Record<string, unknown> = attributes
		? { ...node, attributes: completeAttributes(attributes) }
		: { ...node };
	if ('comment' in read) {
		const comment = isString(read.comment) ? cleanComment(read.comment) : '';
		if (comment && attributes) read.comment = comment;
		else delete read.comment;
	}
	if ('uniques' in read) {
		const groups =
			read.type === 'entity'
				? uniqueGroups(readGroups(read.uniques), read.attributes as Attribute[])
				: [];
		if (groups.length > 0) read.uniques = groups;
		else delete read.uniques;
	}
	if (read.type === 'area') {
		read.label = areaLabel(String(read.label));
		Object.assign(read, roundedBox(read as AreaNode, AREA_MIN));
		if (!AREA_COLORS.includes(read.color as AreaColor)) delete read.color;
		return read as DiagramNode;
	}
	for (const [key, allowed] of NODE_CHOICES) {
		if (key in read && !allowed.includes(read[key] as string)) delete read[key];
	}
	// A Skin the type does not offer (a file or a peer) reads as generic, as the canvas shows it.
	if (read.type === 'component' && typeof read.skin === 'string') {
		if (!skinFits(String(read.componentType), read.skin)) read.skin = null;
	}
	// Only a Disk has a kind, whatever a file or a peer sent.
	if (read.componentType !== 'disk') delete read.diskKind;
	// A Note's text is bounded, whatever a file or a peer wrote.
	if (read.type === 'note' && typeof read.text === 'string' && read.text.length > 2000) {
		read.text = noteText(read.text);
	}
	// Only a Service has a Runtime; a Person has no Hosting nor Provider.
	if (read.componentType !== 'service') delete read.runtime;
	if (isPerson(read.componentType)) {
		delete read.hosting;
		delete read.provider;
	}
	return read as DiagramNode;
}

/** An edge as the app reads it: a Flow this version does not know (a newer file or peer) reads as unspecified. */
function readEdge(edge: Record<string, unknown>): DiagramEdge {
	if (!['flow', 'relative', 'fkName', 'labelPosition'].some((key) => key in edge)) {
		return edge as DiagramEdge;
	}
	const read = { ...edge };
	const at = read.labelPosition;
	if (read.type !== 'connection' || !isNumber(at) || at < 0 || at > 1) delete read.labelPosition;
	if ((read.type !== 'leg' && read.type !== 'isa') || !isForeignKeyName(read.fkName)) {
		delete read.fkName;
	}
	if (read.type !== 'connection' || !FLOWS.includes(read.flow as Flow)) delete read.flow;
	// Only `true` on a 1,1 Leg, whatever a file or a peer wrote.
	if (read.type !== 'leg' || read.relative !== true || read.cardinality !== '1,1') {
		delete read.relative;
	}
	return read as DiagramEdge;
}

/**
 * What of a clip a Diagram of `kind` takes, checked as an imported file is:
 * valid elements of its kind (Notes go anywhere), read as the app reads them
 * and keeping only the fields the app writes, edges between them, and no
 * Association left with fewer than two Legs.
 */
export function pasteable(
	clip: { nodes: unknown[]; edges: unknown[] },
	kind: DiagramKind
): { nodes: DiagramNode[]; edges: DiagramEdge[] } {
	let nodes = (clip.nodes as (DiagramNode | null)[])
		.filter((n): n is DiagramNode => isValidNode(n, kind))
		.map((n) => known(withCompleteAttributes(n), NODE_FIELDS));
	const types = new Map<string, unknown>(nodes.map((n) => [n.id, n.type]));
	let edges = (clip.edges as (DiagramEdge | null)[])
		.filter((e): e is DiagramEdge => isValidEdge(e, kind, types))
		.map((e) => known(readEdge(e), EDGE_FIELDS));
	const legs = new Map<string, number>();
	for (const e of edges) if (e.type === 'leg') legs.set(e.source, (legs.get(e.source) ?? 0) + 1);
	const lonely = new Set(
		nodes.filter((n) => n.type === 'association' && (legs.get(n.id) ?? 0) < 2).map((n) => n.id)
	);
	if (lonely.size > 0) {
		nodes = nodes.filter((n) => !lonely.has(n.id));
		edges = edges.filter((e) => !lonely.has(e.source));
	}
	// An Inheritance comes only with its parent and at least one child.
	const present = new Set(nodes.map((n) => n.id));
	const orphans = new Set(
		nodes
			.filter(
				(n) =>
					n.type === 'inheritance' &&
					(!present.has(String(n.parent)) ||
						!edges.some((e) => e.type === 'isa' && e.source === n.id))
			)
			.map((n) => n.id)
	);
	if (orphans.size > 0) {
		nodes = nodes.filter((n) => !orphans.has(n.id));
		edges = edges.filter((e) => !orphans.has(e.source));
	}
	// A CIF comes only with its Association and the Legs it names.
	const kept = new Set(nodes.map((n) => n.id));
	const legIds = new Set(edges.map((e) => e.id));
	nodes = nodes.filter((n) => {
		if (n.type !== 'cif') return true;
		const cif = n as CifNode;
		return (
			kept.has(cif.association) &&
			legIds.has(cif.determined) &&
			cif.determinants.length > 0 &&
			cif.determinants.every((leg) => legIds.has(leg))
		);
	});
	return { nodes, edges };
}

// The fields the app writes, by element type, beyond `id` and `type`: a clip is text
// anyone can craft, and whatever it carries besides would sync to every Participant.
const NODE_FIELDS: Record<string, readonly string[]> = {
	component: [
		'x',
		'y',
		'name',
		'componentType',
		'skin',
		'hosting',
		'provider',
		'diskKind',
		'runtime'
	],
	zone: ['x', 'y', 'name', 'width', 'height', 'provider'],
	note: ['x', 'y', 'text', 'color', 'width'],
	area: ['x', 'y', 'label', 'width', 'height', 'color'],
	entity: ['x', 'y', 'name', 'attributes', 'comment', 'uniques'],
	association: ['x', 'y', 'name', 'attributes', 'comment'],
	cif: ['x', 'y', 'association', 'determinants', 'determined'],
	inheritance: ['x', 'y', 'parent', 'constraint', 'translation']
};
const EDGE_FIELDS: Record<string, readonly string[]> = {
	connection: ['source', 'target', 'label', 'flow', 'labelPosition', 'points'],
	leg: ['source', 'target', 'cardinality', 'relative', 'fkName', 'points'],
	isa: ['source', 'target', 'fkName', 'points']
};

/** An element with only its type's known fields (those it has). */
function known<T extends { id: string; type: string }>(
	element: T,
	fields: Record<string, readonly string[]>
): T {
	const kept: Record<string, unknown> = { id: element.id, type: element.type };
	for (const field of fields[element.type] ?? []) {
		if (field in element) kept[field] = (element as Record<string, unknown>)[field];
	}
	return kept as T;
}

function toFields(element: Record<string, unknown>): Fields {
	const fields = new Y.Map<unknown>();
	for (const [key, value] of Object.entries(element)) fields.set(key, value);
	return fields;
}

function toFieldsMap(elements: { id: string }[]): Y.Map<Fields> {
	const map = new Y.Map<Fields>();
	for (const element of elements) map.set(element.id, toFields(element));
	return map;
}

function parseFile(data: unknown): ProjectFile {
	const file = data as Partial<ProjectFile> | null;
	if (file?.format !== FILE_FORMAT) throw new Error('Not a Simple Modelisation file');
	if (file.version !== FILE_VERSION) throw new Error(`Unsupported file version ${file.version}`);
	if (typeof file.name !== 'string' || !Array.isArray(file.diagrams)) {
		throw new Error('Malformed file');
	}
	for (const d of file.diagrams) {
		const ok =
			isString(d?.id) &&
			DIAGRAM_KINDS.includes(d.kind) &&
			isString(d.name) &&
			isNumber(d.createdAt) &&
			Array.isArray(d.nodes) &&
			Array.isArray(d.edges);
		if (!ok) throw new Error('Malformed diagram');
		const nodeTypes = new Map<string, unknown>(d.nodes.map((n) => [n?.id, n?.type]));
		for (const node of d.nodes) {
			if (!isValidNode(node, d.kind)) throw new Error(`Malformed element in ${d.name}`);
		}
		for (const edge of d.edges) {
			if (!isValidEdge(edge, d.kind, nodeTypes)) throw new Error(`Malformed line in ${d.name}`);
		}
	}
	return file as ProjectFile;
}

/** A time as `Date` has them: whole numbers around it stay apart, so there is room to order. */
const isTime = (value: unknown): value is number =>
	typeof value === 'number' && Math.abs(value) <= 8.64e15;

const isString = (value: unknown): value is string => typeof value === 'string';

/**
 * A diagram entry reads can use, whatever a peer wrote: a map stored under its
 * own id, of a known kind, with maps of nodes and edges.
 */
function isReadableDiagram(key: string, diagram: unknown): diagram is Fields {
	return (
		diagram instanceof Y.Map &&
		diagram.get('id') === key &&
		DIAGRAM_KINDS.includes(diagram.get('kind') as DiagramKind) &&
		diagram.get('nodes') instanceof Y.Map &&
		diagram.get('edges') instanceof Y.Map
	);
}

const isReadableEntry = (key: string, entry: unknown): entry is Fields =>
	entry instanceof Y.Map && entry.get('id') === key;

/**
 * A Diagram's nodes or edges as reads and writes see them: only the entries
 * that are maps stored under their own id. A plain value a peer wrote, or a map
 * under another key, is neither found, listed nor counted; writes pass through.
 */
class Entries {
	readonly raw: Y.Map<Fields>;

	constructor(raw: Y.Map<Fields>) {
		this.raw = raw;
	}

	get(key: string): Fields | undefined {
		const entry = this.raw.get(key);
		return isReadableEntry(key, entry) ? entry : undefined;
	}

	has(key: string): boolean {
		return this.get(key) !== undefined;
	}

	set(key: string, entry: Fields): void {
		this.raw.set(key, entry);
	}

	delete(key: string): void {
		this.raw.delete(key);
	}

	*entries(): IterableIterator<[string, Fields]> {
		for (const [key, entry] of this.raw.entries()) {
			if (isReadableEntry(key, entry)) yield [key, entry];
		}
	}

	*values(): IterableIterator<Fields> {
		for (const [, entry] of this.entries()) yield entry;
	}

	[Symbol.iterator]() {
		return this.entries();
	}

	get size(): number {
		return [...this.entries()].length;
	}
}

/** A stored list of ids, or none when a peer or a file wrote something else. */
const stringList = (value: unknown): string[] =>
	Array.isArray(value) ? value.filter(isString) : [];

/** A Note's text as stored: no trailing blank lines or spaces, bounded like a name. */
const noteText = (text: string) => text.trimEnd().slice(0, 2000);
const isNumber = (value: unknown): value is number =>
	typeof value === 'number' && Number.isFinite(value);

function isValidNode(node: DiagramNode | null, kind: DiagramKind): boolean {
	if (!node || !isString(node.id) || !isNumber(node.x) || !isNumber(node.y)) return false;
	// A Note, in either kind, has text (maybe empty) rather than a name.
	if (node.type === 'note') return isString(node.text);
	// An Area has a label, maybe empty.
	if (node.type === 'area') {
		return (
			kind === 'mcd' &&
			isString(node.label) &&
			isNumber(node.width) &&
			node.width > 0 &&
			isNumber(node.height) &&
			node.height > 0
		);
	}
	// An Inheritance has its parent Entity instead.
	if (node.type === 'inheritance') {
		return (
			kind === 'mcd' &&
			isString(node.parent) &&
			(node.constraint === undefined ||
				INHERITANCE_CONSTRAINTS.includes(node.constraint as InheritanceConstraint)) &&
			(node.translation === undefined ||
				INHERITANCE_TRANSLATIONS.includes(node.translation as InheritanceTranslation))
		);
	}
	// A CIF has its Association and Legs instead.
	if (node.type === 'cif') {
		const determinants = node.determinants as unknown;
		return (
			kind === 'mcd' &&
			isString(node.association) &&
			isString(node.determined) &&
			Array.isArray(determinants) &&
			determinants.length > 0 &&
			determinants.length <= 100 &&
			determinants.every(isString)
		);
	}
	if (!isString(node.name) || !node.name.trim()) return false;
	if (kind === 'system') {
		if (node.type === 'zone') {
			return isNumber(node.width) && node.width > 0 && isNumber(node.height) && node.height > 0;
		}
		return (
			node.type === 'component' &&
			COMPONENT_TYPE_IDS.includes(node.componentType as ComponentType) &&
			// An unknown Hosting or Provider is read as unspecified rather than refusing the file.
			(node.skin === null || isString(node.skin))
		);
	}
	const attributes = node.attributes as Attribute[] | undefined;
	return (
		(node.type === 'entity' || node.type === 'association') &&
		Array.isArray(attributes) &&
		attributes.every(
			(a) =>
				isString(a?.id) &&
				isString(a.name) &&
				typeof a.identifier === 'boolean' &&
				// Files written before Data types existed have neither field; reads complete them.
				(a.type === undefined || isDataType(a.type)) &&
				(a.optional === undefined || typeof a.optional === 'boolean')
		)
	);
}

function isValidEdge(
	edge: DiagramEdge | null,
	kind: DiagramKind,
	nodeTypes: Map<string, unknown>
): boolean {
	if (!edge || !isString(edge.id) || !isString(edge.source) || !isString(edge.target)) return false;
	const points = (edge as Route).points;
	if (points !== undefined) {
		const valid =
			Array.isArray(points) &&
			points.length <= 1000 &&
			points.every((p) => isNumber(p?.x) && isNumber(p?.y));
		if (!valid) return false;
	}
	if (kind === 'system') {
		return (
			edge.type === 'connection' &&
			isString(edge.label) &&
			nodeTypes.get(edge.source) === 'component' &&
			nodeTypes.get(edge.target) === 'component'
		);
	}
	if (edge.type === 'isa') {
		return nodeTypes.get(edge.source) === 'inheritance' && nodeTypes.get(edge.target) === 'entity';
	}
	return (
		edge.type === 'leg' &&
		CARDINALITIES.includes(edge.cardinality as Cardinality) &&
		nodeTypes.get(edge.source) === 'association' &&
		nodeTypes.get(edge.target) === 'entity'
	);
}
