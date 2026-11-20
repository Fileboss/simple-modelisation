import { isPerson } from './component-types.ts';
import type { ElkNode } from 'elkjs/lib/elk-api.js';
import type { DataTypeKind } from './data-types.ts';
import type { Attribute, DiagramEdge, DiagramKind, DiagramNode, Point } from './project.ts';
import { CIF_OFFSET, CIF_SIZE, INHERITANCE_SIZE, ZONE_PADDING } from './project.ts';
import { pillText, roughWidth } from './label-placement.ts';
import { ENGLISH_NAMES } from './names.ts';
import { overlaps, zoneParents } from './zones.ts';

export type Size = { width: number; height: number };
export type Positions = Map<string, Point>;

/**
 * Where every node goes, and the bends of every edge ELK routed: only the
 * inner points, since the ends attach to the boxes as they are drawn.
 */
export type Layout = {
	positions: Positions;
	routes: Map<string, Point[]>;
	/** The size each Zone gets to fit around its content. */
	zoneSizes: Map<string, Size>;
};

/** A link ELK ranks along: the edge it routes, drawn the other way when reversed. */
type Link = {
	from: string;
	to: string;
	edge: string;
	reversed?: boolean;
	/** Connections going the other way between the same Components: they share the route. */
	returns?: string[];
	/** Ranks only: an Inheritance's lines are drawn straight, the one to its parent not stored. */
	unrouted?: boolean;
};

// An MCD packs tighter: each Association is a layer of its own between its Entities,
// so Looping-like proximity needs small gaps; a System design diagram needs room for
// right-angle routes and their labels.
const GAPS: Record<DiagramKind, { node: number; layer: number }> = {
	system: { node: 50, layer: 110 },
	mcd: { node: 40, layer: 40 }
};
/** Elements without any link go on a grid under the rest, this many per row. */
const LOOSE_PER_ROW = 5;

/** The widest Connection pill, in English at the rough width: the layout must not depend on the UI language. */
function widestPill(edges: DiagramEdge[]): number {
	let widest = 0;
	for (const edge of edges) {
		if (edge.type !== 'connection') continue;
		const flows: Record<string, string> = ENGLISH_NAMES.flows;
		const flow = Object.hasOwn(flows, String(edge.flow)) ? flows[String(edge.flow)] : undefined;
		const text = pillText(String(edge.label ?? ''), flow);
		if (text) widest = Math.max(widest, roughWidth(text) + 14);
	}
	return widest;
}

/** A Note's paper: 180px wide, its text wrapped (14px, about 7px a character), at least 80px high. */
export const NOTE_WIDTH = 180;

/** A Note's text cut into the lines it is drawn on, at word boundaries where it can. */
export function noteLines(text: string): string[] {
	const perLine = Math.floor((NOTE_WIDTH - 24) / 7);
	return text.split('\n').flatMap((paragraph) => {
		const lines: string[] = [];
		let line = '';
		for (const word of paragraph.split(' ')) {
			for (let rest = word; ;) {
				const joined = line ? `${line} ${rest}` : rest;
				if (joined.length <= perLine) {
					line = joined;
					break;
				}
				if (line) {
					lines.push(line);
					line = '';
					continue;
				}
				// A word longer than a line breaks anywhere.
				lines.push(rest.slice(0, perLine));
				rest = rest.slice(perLine);
				if (!rest) break;
			}
		}
		lines.push(line);
		return lines;
	});
}

export function noteSize(text: string): Size {
	return { width: NOTE_WIDTH, height: Math.max(80, noteLines(text).length * 20 + 24) };
}

const byId = <T extends { id: string }>(a: T, b: T) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

type Elk = { layout(graph: ElkNode): Promise<ElkNode> };
let elk: Promise<Elk> | undefined;

// ELK is large: load it on the first layout (a separate chunk in the browser, ADR 0006).
function loadElk(): Promise<Elk> {
	elk ??= import('elkjs/lib/elk.bundled.js').then((loaded) => {
		// A CommonJS module: its default export is the constructor in Node and Vite,
		// though TypeScript sees it one level down.
		const exported = (loaded as { default: unknown }).default;
		const ELK = (
			typeof exported === 'function' ? exported : (exported as { default: unknown }).default
		) as new () => Elk;
		return new ELK();
	});
	// A failed load (offline, a stale chunk) must not stick: the next layout retries.
	elk.catch(() => (elk = undefined));
	return elk;
}

/**
 * Arranges a Diagram in layers from left to right along its links (ELK
 * layered): the Connections of a System design diagram, routed at right
 * angles; the Legs of an MCD, each Association ranked between its Entities,
 * routed as broken lines. Elements without links go on a grid underneath.
 * Deterministic: every peer computes the same layout. The positions are
 * shared by every Notation, so an MCD is always laid out with its
 * Associations as boxes. With Zones, each Zone's content is laid out inside it
 * and the Zone sized around it, every element taking part.
 */
export async function layoutDiagram(
	allNodes: DiagramNode[],
	allEdges: DiagramEdge[],
	sizeOf: (node: DiagramNode) => Size,
	kind: DiagramKind
): Promise<Layout> {
	// Input order steers the layout: sort by id so peers that received the document
	// in a different order still agree.
	// Notes explain the Diagram: Tidy up leaves them where they are, except those in a
	// Zone, laid out with its content so that the Zone fitted around it still holds them.
	const inZone = zoneParents(allNodes, estimatedSize);
	// A CIF goes back beside its Association afterwards.
	const nodes = allNodes
		.filter((n) => n.type !== 'cif' && (n.type !== 'note' || inZone.has(n.id)))
		.sort(byId);
	const edges = [...allEdges].sort(byId);
	const links = linksOf(nodes, edges);
	const linked = new Set(links.flatMap((link) => [link.from, link.to]));
	const orthogonal = kind === 'system';
	// Between layers, room for the widest Connection pill as well as the routes' bends.
	const gaps = { ...GAPS[kind], layer: Math.max(GAPS[kind].layer, widestPill(edges) + 50) };
	const hasZones = nodes.some((n) => n.type === 'zone');
	// Membership at the model's sizes, as everywhere else.
	const parents = hasZones ? inZone : new Map<string, string>();
	// Elements without links and outside every Zone still go on the grid underneath.
	const isLoose = (n: DiagramNode) => !linked.has(n.id) && n.type !== 'zone' && !parents.has(n.id);

	const options = {
		'elk.algorithm': 'layered',
		'elk.direction': 'RIGHT',
		'elk.edgeRouting': orthogonal ? 'ORTHOGONAL' : 'POLYLINE',
		'elk.spacing.nodeNode': String(gaps.node),
		'elk.layered.spacing.nodeNodeBetweenLayers': String(gaps.layer),
		'elk.spacing.edgeNode': '25',
		'elk.spacing.edgeEdge': '15',
		'elk.layered.spacing.edgeNodeBetweenLayers': '25',
		// ELK's model order fails on nested layouts (a TypeError in 0.12): left out with Zones.
		...(hasZones ? {} : { 'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES' }),
		'elk.padding': '[top=0,left=0,bottom=0,right=0]'
	};
	const graph: ElkNode = {
		id: 'root',
		layoutOptions: hasZones
			? {
					...options,
					// One layout across the Zones, every coordinate relative to the Diagram.
					'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
					'elk.json.shapeCoords': 'ROOT',
					'elk.json.edgeCoords': 'ROOT'
				}
			: options,
		children: hasZones
			? zoneTree(
					nodes.filter((n) => !isLoose(n)),
					parents,
					sizeOf,
					{
						...options,
						'elk.padding': `[top=${ZONE_PADDING.top},left=${ZONE_PADDING.side},bottom=${ZONE_PADDING.side},right=${ZONE_PADDING.side}]`
					}
				)
			: nodes.filter((n) => !isLoose(n)).map((n) => ({ id: n.id, ...sizeOf(n) })),
		edges: links.map((link, index) => ({
			id: String(index),
			sources: [link.from],
			targets: [link.to]
		}))
	};
	const result = await (await loadElk()).layout(graph);

	const positions: Positions = new Map();
	const zoneSizes = new Map<string, Size>();
	const zoneIds = new Set(nodes.filter((n) => n.type === 'zone').map((n) => n.id));
	let bottom = 0;
	const place = (children: ElkNode[]) => {
		for (const child of children) {
			const x = Math.round(child.x ?? 0);
			const y = Math.round(child.y ?? 0);
			positions.set(child.id, { x, y });
			bottom = Math.max(bottom, y + (child.height ?? 0));
			if (zoneIds.has(child.id)) {
				zoneSizes.set(child.id, {
					width: Math.round(child.width ?? 0),
					height: Math.round(child.height ?? 0)
				});
			}
			place(child.children ?? []);
		}
	};
	place(result.children ?? []);

	const routes = new Map<string, Point[]>();
	for (const edge of result.edges ?? []) {
		const link = links[Number(edge.id)];
		const section = edge.sections?.[0];
		if (!link || !section || link.unrouted) continue;
		// A straight link has no bend: keep its middle, so it stays exactly as routed.
		const bends = section.bendPoints?.length
			? section.bendPoints
			: [
					{
						x: (section.startPoint.x + section.endPoint.x) / 2,
						y: (section.startPoint.y + section.endPoint.y) / 2
					}
				];
		const rounded = bends.map((p: Point) => ({ x: Math.round(p.x), y: Math.round(p.y) }));
		const route = link.reversed ? rounded.reverse() : rounded;
		routes.set(link.edge, route);
		// A Connection back the other way follows the same line: together, a two-way arrow.
		for (const back of link.returns ?? []) routes.set(back, [...route].reverse());
	}

	const loose = nodes.filter(isLoose);
	let x = 0;
	let y = positions.size > 0 ? bottom + gaps.layer * 2 : 0;
	let rowHeight = 0;
	loose.forEach((node, index) => {
		if (index > 0 && index % LOOSE_PER_ROW === 0) {
			x = 0;
			y += rowHeight + gaps.node;
			rowHeight = 0;
		}
		const size = sizeOf(node);
		positions.set(node.id, { x, y });
		x += size.width + gaps.node;
		rowHeight = Math.max(rowHeight, size.height);
	});
	for (const cif of allNodes.filter((n) => n.type === 'cif')) {
		const association = positions.get(String(cif.association));
		if (association) {
			positions.set(cif.id, { x: association.x + CIF_OFFSET.x, y: association.y + CIF_OFFSET.y });
		}
	}
	return { positions, routes, zoneSizes };
}

/**
 * The Diagram as nested ELK nodes: each Zone holding what lies inside it now.
 * An empty Zone keeps its size.
 */
function zoneTree(
	nodes: DiagramNode[],
	parents: Map<string, string>,
	sizeOf: (node: DiagramNode) => Size,
	zoneOptions: Record<string, string>
): ElkNode[] {
	const holds = new Set(parents.values());
	const elkNodes = new Map<string, ElkNode>(
		nodes.map((n) => [
			n.id,
			n.type === 'zone' && holds.has(n.id)
				? { id: n.id, layoutOptions: zoneOptions, children: [] }
				: { id: n.id, ...sizeOf(n) }
		])
	);
	const roots: ElkNode[] = [];
	for (const node of nodes) {
		const parent = parents.get(node.id);
		const elkNode = elkNodes.get(node.id)!;
		if (parent) elkNodes.get(parent)!.children!.push(elkNode);
		else roots.push(elkNode);
	}
	return roots;
}

/** The directed links ELK ranks along. */
function linksOf(nodes: DiagramNode[], edges: DiagramEdge[]): Link[] {
	const present = new Set(nodes.map((n) => n.id));
	// Where flows start: Persons, then the Clients they use; other Components after.
	const origin = new Map(
		nodes.map((n) => [n.id, isPerson(n.componentType) ? 2 : n.componentType === 'client' ? 1 : 0])
	);
	const level = (id: string) => origin.get(id) ?? 0;
	const links: Link[] = [];
	const firstLeg = new Set<string>();
	// The link of each Connection by its ends, to spot the one going back the other way.
	const connectionLinks = new Map<string, Link>();
	const backwards: DiagramEdge[] = [];
	const typeOf = new Map(nodes.map((n) => [n.id, n.componentType]));
	const connections = edges.filter((e) => e.type === 'connection');
	const has = (from: string, to: string) =>
		connections.some((e) => e.source === from && e.target === to);
	// What flows into a Component from elsewhere than a two-way partner: it comes later in the flow.
	const incoming = (id: string) =>
		connections.filter((e) => e.target === id && !has(id, e.source)).length;
	const isStore = (id: string) =>
		['database', 'cache', 'storage', 'disk', 'queue'].includes(String(typeOf.get(id)));
	/** For A ↔ B, which way the shared link runs in the flow. */
	const forward = (a: string, b: string) => {
		if (isStore(a) !== isStore(b)) return isStore(b);
		if (incoming(a) !== incoming(b)) return incoming(a) > incoming(b);
		return a < b;
	};
	// An Inheritance ranks after its parent, its children after it.
	for (const node of nodes) {
		if (node.type === 'inheritance' && present.has(String(node.parent))) {
			links.push({
				from: String(node.parent),
				to: node.id,
				edge: `parent:${node.id}`,
				unrouted: true
			});
		}
	}
	for (const edge of edges) {
		if (!present.has(edge.source) || !present.has(edge.target)) continue;
		if (edge.type === 'isa') {
			links.push({ from: edge.source, to: edge.target, edge: edge.id, unrouted: true });
			continue;
		}
		if (edge.type === 'leg') {
			// Legs are sorted by id: the first leads into its Association, the others out of it,
			// so the Association ranks between its Entities.
			const first = !firstLeg.has(edge.source);
			firstLeg.add(edge.source);
			links.push(
				first
					? { from: edge.target, to: edge.source, edge: edge.id, reversed: true }
					: { from: edge.source, to: edge.target, edge: edge.id }
			);
			continue;
		}
		// A two-way pair shares one link, run the way of the flow; the other Connection
		// takes the same route backwards.
		// A loop (A → A, possible in an imported file) is not a two-way pair.
		const twoWay = edge.source !== edge.target && has(edge.target, edge.source);
		if (twoWay && !forward(edge.source, edge.target)) {
			backwards.push(edge);
			continue;
		}
		// A Connection back towards where flows start (a push to a Client, a mail to a Person)
		// ranks the other way.
		const back = level(edge.target) > level(edge.source);
		const link: Link = back
			? { from: edge.target, to: edge.source, edge: edge.id, reversed: true }
			: { from: edge.source, to: edge.target, edge: edge.id };
		links.push(link);
		connectionLinks.set(`${edge.source}|${edge.target}`, link);
	}
	for (const edge of backwards) {
		const forth = connectionLinks.get(`${edge.target}|${edge.source}`);
		if (forth) (forth.returns ??= []).push(edge.id);
	}
	return links;
}

// Rough text widths of the canvas fonts, per character.
const CHAR = { title: 9, line: 7.2 };

/** Characters of a Data type as UML lines print it (`Auto-increment`, `Text(120)`…). */
const TYPE_CHARS: Record<DataTypeKind, number> = {
	integer: 7,
	bigint: 11,
	decimal: 12,
	text: 4,
	varchar: 9,
	boolean: 7,
	date: 4,
	datetime: 9,
	uuid: 4,
	serial: 14
};

/**
 * A node's drawn size guessed from its content, where the canvas cannot
 * measure it (the server) or measures another Notation than the shared
 * positions need: the larger of its Merise and UML drawings.
 */
export function estimatedSize(node: DiagramNode): Size {
	const name = String(node.name ?? '');
	const attributes = (node.attributes as Attribute[] | undefined) ?? [];
	if (node.type === 'zone') return { width: node.width as number, height: node.height as number };
	if (node.type === 'note') return noteSize(String(node.text ?? ''));
	if (node.type === 'cif') return CIF_SIZE;
	if (node.type === 'inheritance') return INHERITANCE_SIZE;
	if (node.type === 'component' && isPerson(node.componentType)) {
		// A silhouette: the avatar over the name and the role (the longest role, Customer, fits in 100px).
		return { width: Math.max(100, name.length * 9 + 20), height: 100 };
	}
	if (node.type === 'component') {
		// The Skin's name, a Service's Runtime or a Disk's kind shows under the name.
		const subtitle = node.skin || node.runtime || node.diskKind ? 20 : 0;
		return { width: Math.max(150, name.length * 8 + 80 + subtitle), height: 64 };
	}
	const merise = Math.max(...attributes.map((a) => a.name.length * CHAR.line));
	const uml = Math.max(
		...attributes.map((a) => {
			const flags = (a.identifier ? 5 : 0) + (a.optional ? 7 : 0);
			return (a.name.length + 3 + TYPE_CHARS[a.type?.kind ?? 'text'] + flags) * CHAR.line;
		})
	);
	const lines = attributes.length > 0 ? Math.max(merise, uml) : 0;
	if (node.type === 'association') {
		return {
			width: Math.round(Math.max(90, name.length * CHAR.title + 40, merise + 40)),
			height: 40 + attributes.length * 18
		};
	}
	return {
		width: Math.round(Math.max(120, name.length * CHAR.title + 24, lines + 20)),
		height: 36 + attributes.length * 18
	};
}

/**
 * What a layout depends on in a Diagram: its nodes' places and sizes, its
 * edges. A layout computed from one fingerprint is stale once it differs.
 */
export function layoutFingerprint(nodes: DiagramNode[], edges: DiagramEdge[]): string {
	return JSON.stringify([
		[...nodes].sort(byId).map((n) => [n.id, n.x, n.y, estimatedSize(n)]),
		[...edges].sort(byId).map((e) => [e.id, e.source, e.target])
	]);
}

type Box = Point & Size;

/** Whether any two boxes overlap (touching edges do not count). */
export function anyOverlap(boxes: Box[]): boolean {
	return boxes.some((a, i) => boxes.some((b, j) => i < j && overlaps(a, b)));
}
