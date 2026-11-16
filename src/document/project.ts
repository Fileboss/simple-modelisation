import * as Y from 'yjs';

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
	'storage'
] as const;
export type ComponentType = (typeof COMPONENT_TYPE_IDS)[number];

export type ComponentNode = DiagramNode & {
	type: 'component';
	componentType: ComponentType;
	name: string;
	/** A Skin id from the catalog, or null for the generic look. */
	skin: string | null;
};

export type ConnectionEdge = DiagramEdge & { type: 'connection'; label: string };

export type Attribute = { id: string; name: string; identifier: boolean };

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
export type LegEdge = DiagramEdge & { type: 'leg'; cardinality: Cardinality };

/** The JSON file a Project exports to and imports from. */
export type ProjectFile = {
	format: typeof FILE_FORMAT;
	version: typeof FILE_VERSION;
	name: string;
	diagrams: (Diagram & { nodes: DiagramNode[]; edges: DiagramEdge[] })[];
};

const FILE_FORMAT = 'simple-modelisation';
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
	private readonly diagramMap: Y.Map<Fields>;
	private readonly undoManager: Y.UndoManager;

	constructor(doc: Y.Doc = new Y.Doc()) {
		this.doc = doc;
		this.diagramMap = doc.getMap('diagrams');
		this.undoManager = new Y.UndoManager(this.diagramMap);
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
		return [...this.nodeMap(diagramId).values()].map((n) => n.toJSON() as DiagramNode);
	}

	edges(diagramId: string): DiagramEdge[] {
		return [...this.edgeMap(diagramId).values()].map((e) => e.toJSON() as DiagramEdge);
	}

	moveNode(diagramId: string, nodeId: string, x: number, y: number): void {
		const node = this.nodeMap(diagramId).get(nodeId);
		if (!node) return;
		this.doc.transact(() => {
			node.set('x', Math.round(x));
			node.set('y', Math.round(y));
		});
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

	/** Joins two different Components with a directed Connection. */
	addConnection(diagramId: string, source: string, target: string): string | null {
		if (source === target) return null;
		const id = crypto.randomUUID();
		const connection: ConnectionEdge = { id, type: 'connection', source, target, label: '' };
		this.insertEdge(diagramId, connection);
		return id;
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
			attributes: [{ id: crypto.randomUUID(), name: 'id', identifier: true }]
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
			{ id, name: name.trim() || 'attribute', identifier: false }
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
			list.map((a) => (a.id === attributeId ? { ...a, identifier: !a.identifier } : a))
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

	subscribe(listener: () => void): () => void {
		this.doc.on('update', listener);
		return () => this.doc.off('update', listener);
	}

	// JSON file

	toFile(name: string): ProjectFile {
		return {
			format: FILE_FORMAT,
			version: FILE_VERSION,
			name,
			diagrams: this.diagrams().map((d) => ({
				...d,
				nodes: this.nodes(d.id),
				edges: this.edges(d.id)
			}))
		};
	}

	/** Builds a Project from an exported file; throws on a file this app did not write. */
	static fromFile(data: unknown): { project: ProjectDocument; name: string } {
		const file = parseFile(data);
		const project = new ProjectDocument();
		project.doc.transact(() => {
			for (const d of file.diagrams) {
				const diagram = new Y.Map<unknown>();
				diagram.set('id', d.id);
				diagram.set('kind', d.kind);
				diagram.set('name', d.name);
				diagram.set('createdAt', d.createdAt);
				diagram.set('nodes', toFieldsMap(d.nodes));
				diagram.set('edges', toFieldsMap(d.edges));
				project.diagramMap.set(d.id, diagram);
			}
		});
		project.undoManager.clear();
		return { project, name: file.name };
	}

	// Helpers for the kind-specific operations

	private insertNode(diagramId: string, node: DiagramNode): void {
		this.nodeMap(diagramId).set(node.id, toFields(node));
	}

	private insertEdge(diagramId: string, edge: DiagramEdge): void {
		this.edgeMap(diagramId).set(edge.id, toFields(edge));
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
		node.set('attributes', change((node.get('attributes') as Attribute[] | undefined) ?? []));
	}

	private requireDiagram(id: string): Fields {
		const diagram = this.diagramMap.get(id);
		if (!diagram) throw new Error(`Unknown diagram ${id}`);
		return diagram;
	}
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
		return (
			node.type === 'component' &&
			COMPONENT_TYPE_IDS.includes(node.componentType as ComponentType) &&
			(node.skin === null || isString(node.skin))
		);
	}
	const attributes = node.attributes as Attribute[] | undefined;
	return (
		(node.type === 'entity' || node.type === 'association') &&
		Array.isArray(attributes) &&
		attributes.every(
			(a) => isString(a?.id) && isString(a.name) && typeof a.identifier === 'boolean'
		)
	);
}

function isValidEdge(
	edge: DiagramEdge | null,
	kind: DiagramKind,
	nodeTypes: Map<string, unknown>
): boolean {
	if (!edge || !isString(edge.id) || !isString(edge.source) || !isString(edge.target)) return false;
	if (kind === 'system') {
		return (
			edge.type === 'connection' &&
			isString(edge.label) &&
			nodeTypes.has(edge.source) &&
			nodeTypes.has(edge.target)
		);
	}
	return (
		edge.type === 'leg' &&
		CARDINALITIES.includes(edge.cardinality as Cardinality) &&
		nodeTypes.get(edge.source) === 'association' &&
		nodeTypes.get(edge.target) === 'entity'
	);
}
