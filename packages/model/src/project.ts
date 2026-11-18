import * as Y from 'yjs';
import { dataType, isDataType, type DataType } from './data-types.ts';

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

export const COMPONENT_TYPE_IDS = [
	'client',
	'service',
	'database',
	'cache',
	'queue',
	'gateway',
	'storage',
	'disk'
] as const;
export type ComponentType = (typeof COMPONENT_TYPE_IDS)[number];

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

/** What a Disk is: spinning, solid-state, NVMe, or plugged in over USB. */
export const DISK_KINDS = ['hdd', 'ssd', 'nvme', 'usb'] as const;
export type DiskKind = (typeof DISK_KINDS)[number];

export type Point = { x: number; y: number };

/**
 * The bends a Tidy up routed a Connection or a Leg through, around the boxes;
 * its ends attach to the boxes as drawn. Cleared when an end moves.
 */
export type Route = { points?: Point[] };

export type ConnectionEdge = DiagramEdge & Route & { type: 'connection'; label: string };

/** A named area grouping the Components drawn inside it (a region, a VPC, a subnet). */
export type ZoneNode = DiagramNode & { type: 'zone'; name: string; width: number; height: number };

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

	nodes(diagramId: string): DiagramNode[] {
		return [...this.nodeMap(diagramId).values()].map((n) => withCompleteAttributes(n.toJSON()));
	}

	edges(diagramId: string): DiagramEdge[] {
		return [...this.edgeMap(diagramId).values()].map((e) => e.toJSON() as DiagramEdge);
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
	 * Deletes nodes and edges. The edges of a deleted node go with it, and an
	 * Association left with fewer than two Legs is deleted with its last Leg.
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

	/** Applies a Skin to a Component, or clears it with null (Generic). */
	setSkin(diagramId: string, componentId: string, skin: string | null): void {
		this.nodeMap(diagramId).get(componentId)?.set('skin', skin);
	}

	/** Says whose infrastructure a Component runs on, or clears it with null; an unknown value is ignored. */
	setProvider(diagramId: string, componentId: string, provider: Provider | null): void {
		this.setComponentChoice(diagramId, componentId, 'provider', provider, PROVIDERS);
	}

	/** Says what a Disk is, or clears it with null; ignored on other Components or for an unknown value. */
	setDiskKind(diagramId: string, diskId: string, kind: DiskKind | null): void {
		if (this.nodeMap(diagramId).get(diskId)?.get('componentType') !== 'disk') return;
		this.setComponentChoice(diagramId, diskId, 'diskKind', kind, DISK_KINDS);
	}

	/** Says where a Component runs, or clears it with null; an unknown value is ignored. */
	setHosting(diagramId: string, componentId: string, hosting: Hosting | null): void {
		this.setComponentChoice(diagramId, componentId, 'hosting', hosting, HOSTINGS);
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
				diagram.set('nodes', toFieldsMap(d.nodes.map(withCompleteAttributes)));
				diagram.set('edges', toFieldsMap(d.edges));
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

	/** Sets a Component field to one of `allowed`, or clears it with null; anything else is ignored. */
	private setComponentChoice(
		diagramId: string,
		componentId: string,
		key: string,
		value: string | null,
		allowed: readonly string[]
	): void {
		if (value !== null && !allowed.includes(value)) return;
		const component = this.nodeMap(diagramId).get(componentId);
		if (component?.get('type') !== 'component') return;
		if (value === null) component.delete(key);
		else if (component.get(key) !== value) component.set(key, value);
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
		const type = a.type ?? dataType(a.identifier && loneIdentifier ? 'serial' : 'text');
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

/**
 * A node as the app reads it: old Attributes completed, and a Hosting or a
 * Provider or a Disk kind this version does not know (a newer file or peer) read as unspecified.
 */
/** Component fields that take one of a list; a value this version does not know reads as unspecified. */
const COMPONENT_CHOICES: [string, readonly string[]][] = [
	['hosting', HOSTINGS],
	['provider', PROVIDERS],
	['diskKind', DISK_KINDS]
];

function withCompleteAttributes<T extends Record<string, unknown>>(node: T): DiagramNode {
	const attributes = node.attributes as Partial<Attribute>[] | undefined;
	const read: Record<string, unknown> = attributes
		? { ...node, attributes: completeAttributes(attributes) }
		: { ...node };
	for (const [key, allowed] of COMPONENT_CHOICES) {
		if (key in read && !allowed.includes(read[key] as string)) delete read[key];
	}
	// Only a Disk has a kind, whatever a file or a peer sent.
	if (read.componentType !== 'disk') delete read.diskKind;
	return read as DiagramNode;
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
const isNumber = (value: unknown): value is number =>
	typeof value === 'number' && Number.isFinite(value);

function isValidNode(node: DiagramNode | null, kind: DiagramKind): boolean {
	if (!node || !isString(node.id) || !isNumber(node.x) || !isNumber(node.y)) return false;
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
