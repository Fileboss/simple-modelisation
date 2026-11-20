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
};

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
export type NoteNode = DiagramNode & { type: 'note'; text: string; color?: NoteColor };

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
};

export type EntityNode = DiagramNode & { type: 'entity'; name: string; attributes: Attribute[] };

export type AssociationNode = DiagramNode & {
	type: 'association';
	name: string;
	/** Attributes carried by the Association; their `identifier` flag is always false. */
	attributes: Attribute[];
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

/** A Leg's part in a CIF. */
export type CifRole = 'determinant' | 'determined' | 'none';

/** Joins an Association (source) to one of its Entities (target). */
export type LegEdge = DiagramEdge & Route & { type: 'leg'; cardinality: Cardinality };

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

	constructor(doc: Y.Doc = new Y.Doc()) {
		this.doc = doc;
		this.meta = doc.getMap('meta');
		this.diagramMap = doc.getMap('diagrams');
		this.undoManager = new Y.UndoManager([this.meta, this.diagramMap]);
	}

	// Project

	/** The Project's name; empty only in a document created before names lived in it. */
	name(): string {
		return (this.meta.get('name') as string | undefined) ?? '';
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

	/** Oldest first, the order of the tabs. */
	diagrams(): Diagram[] {
		return [...this.diagramMap.values()]
			.map((d) => ({
				id: d.get('id') as string,
				kind: d.get('kind') as DiagramKind,
				name: d.get('name') as string,
				createdAt: d.get('createdAt') as number
			}))
			.sort((a, b) => a.createdAt - b.createdAt);
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
			diagram.set('createdAt', Date.now());
			diagram.set('nodes', new Y.Map<Fields>());
			diagram.set('edges', new Y.Map<Fields>());
			this.diagramMap.set(id, diagram);
		});
		return id;
	}

	renameDiagram(id: string, name: string): void {
		const diagram = this.requireDiagram(id);
		diagram.set('name', name.trim() || DEFAULT_DIAGRAM_NAMES[diagram.get('kind') as DiagramKind]);
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

	/** Renames a Component, Entity or Association; a blank name is ignored. */
	renameNode(diagramId: string, nodeId: string, name: string): void {
		if (name.trim()) this.nodeMap(diagramId).get(nodeId)?.set('name', name.trim());
	}

	/**
	 * Deletes nodes and edges. The edges of a deleted node go with it, an
	 * Association left with fewer than two Legs is deleted with its last Leg,
	 * and a CIF goes with its Association, its determined Leg or its last
	 * determinant.
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
			...roundedBox({ x, y, width, height })
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
		// A CIF names its Association and Legs: the pasted ones.
		const relinked = (node: DiagramNode): DiagramNode => {
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

	/** Colors a Note, yellow with null; an unknown color is ignored. */
	setNoteColor(diagramId: string, noteId: string, color: NoteColor | null): void {
		this.setNodeChoice(diagramId, noteId, 'color', color === 'yellow' ? null : color, NOTE_COLORS, [
			'note'
		]);
	}

	/** Places and sizes a Zone, never smaller than ZONE_MIN; its content stays where it is. */
	setZoneBox(
		diagramId: string,
		zoneId: string,
		box: { x: number; y: number; width: number; height: number }
	): void {
		const zone = this.nodeMap(diagramId).get(zoneId);
		if (zone?.get('type') !== 'zone') return;
		this.doc.transact(() => {
			for (const [key, value] of Object.entries(roundedBox(box))) {
				if (zone.get(key) !== value) zone.set(key, value);
			}
		});
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

	// MCDs

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
		this.insertEdge(diagramId, leg);
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

	setCardinality(diagramId: string, legId: string, cardinality: Cardinality): void {
		this.edgeMap(diagramId).get(legId)?.set('cardinality', cardinality);
	}

	/** Moves a Leg to the next Cardinality: 0,1 → 1,1 → 0,n → 1,n → 0,1. */
	cycleCardinality(diagramId: string, legId: string): void {
		const leg = this.edgeMap(diagramId).get(legId);
		if (!leg) return;
		const index = CARDINALITIES.indexOf(leg.get('cardinality') as Cardinality);
		leg.set('cardinality', CARDINALITIES[(index + 1) % CARDINALITIES.length]);
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

	removeAttribute(diagramId: string, nodeId: string, attributeId: string): void {
		this.updateAttributes(diagramId, nodeId, (list) => list.filter((a) => a.id !== attributeId));
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

	private nodeMap(diagramId: string): Y.Map<Fields> {
		return this.requireDiagram(diagramId).get('nodes') as Y.Map<Fields>;
	}

	private edgeMap(diagramId: string): Y.Map<Fields> {
		return this.requireDiagram(diagramId).get('edges') as Y.Map<Fields>;
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

	private requireDiagram(id: string): Fields {
		const diagram = this.diagramMap.get(id);
		if (!diagram) throw new Error(`Unknown diagram ${id}`);
		return diagram;
	}
}

function roundedBox(box: { x: number; y: number; width: number; height: number }) {
	return {
		x: Math.round(box.x),
		y: Math.round(box.y),
		width: Math.round(Math.max(ZONE_MIN.width, box.width)),
		height: Math.round(Math.max(ZONE_MIN.height, box.height))
	};
}

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
			optional: canBeOptional({ identifier: a.identifier ?? false, type }) && (a.optional ?? false)
		};
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
	['color', NOTE_COLORS]
];

/**
 * A node as the app reads it: old Attributes completed, and a Hosting, a
 * Provider, a Disk kind or a Runtime this version does not know (a newer file
 * or peer), or that its type does not take, read as unspecified.
 */
function withCompleteAttributes<T extends Record<string, unknown>>(node: T): DiagramNode {
	const attributes = node.attributes as Partial<Attribute>[] | undefined;
	const read: Record<string, unknown> = attributes
		? { ...node, attributes: completeAttributes(attributes) }
		: { ...node };
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
	if (!('flow' in edge)) return edge as DiagramEdge;
	const read = { ...edge };
	if (read.type !== 'connection' || !FLOWS.includes(read.flow as Flow)) delete read.flow;
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
	note: ['x', 'y', 'text', 'color'],
	entity: ['x', 'y', 'name', 'attributes'],
	association: ['x', 'y', 'name', 'attributes'],
	cif: ['x', 'y', 'association', 'determinants', 'determined']
};
const EDGE_FIELDS: Record<string, readonly string[]> = {
	connection: ['source', 'target', 'label', 'flow', 'points'],
	leg: ['source', 'target', 'cardinality', 'points']
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

const isString = (value: unknown): value is string => typeof value === 'string';

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
	return (
		edge.type === 'leg' &&
		CARDINALITIES.includes(edge.cardinality as Cardinality) &&
		nodeTypes.get(edge.source) === 'association' &&
		nodeTypes.get(edge.target) === 'entity'
	);
}
