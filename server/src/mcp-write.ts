import { isPerson } from '@simple-modelisation/model/component-types.ts';
import { dataType, isDataType, type DataType } from '@simple-modelisation/model/data-types.ts';
import {
	CARDINALITIES,
	canBeRelative,
	COMPONENT_TYPE_IDS,
	DISK_KINDS,
	FLOWS,
	HOSTINGS,
	INHERITANCE_CONSTRAINTS,
	INHERITANCE_TRANSLATIONS,
	NOTE_COLORS,
	PROVIDERS,
	RUNTIMES,
	type Attribute,
	ZONE_DEFAULT,
	ZONE_PADDING,
	type DiagramNode,
	type Point,
	type ZoneNode,
	type LegEdge,
	type ProjectDocument
} from '@simple-modelisation/model/project.ts';
import {
	estimatedSize,
	layoutDiagram,
	layoutFingerprint,
	noteSize
} from '@simple-modelisation/model/layout.ts';
import { SERVICE_FRAMEWORKS, SKIN_IDS, skinFits } from '@simple-modelisation/model/skins.ts';
import {
	nodeBox,
	overlaps,
	zoneContent,
	zoneParents,
	type Box
} from '@simple-modelisation/model/zones.ts';
import { z } from 'zod';
import type { ProjectAccess, RegisterTool } from './mcp.ts';
import { projectArgument } from './mcp.ts';
import { ToolError } from './mcp-error.ts';
import { pick, pickDiagram } from './mcp-views.ts';

const diagramArgument = z.string().describe('Diagram id or exact name.');
const hostingArgument = z
	.enum(HOSTINGS)
	.describe(
		'Where the Component runs: bare-metal, vm (a VM or VPS we run), docker (containers on our servers), kubernetes, managed (a cloud service), serverless (functions), external (a third-party service).'
	);
const providerArgument = z
	.enum(PROVIDERS)
	.describe(
		`Whose infrastructure the Component runs on: ${PROVIDERS.join(', ')}. It goes with any Hosting.`
	);
const componentTypeArgument = z
	.enum(COMPONENT_TYPE_IDS)
	.describe(
		'person: someone who uses or runs the system (Skins: customer, admin, partner, support; no hosting or provider). client: what the end user runs it in (browser, phone). The others are software or storage.'
	);
const flowArgument = z
	.enum(FLOWS)
	.describe(
		'What the data does, seen from the Component the arrow starts at (who initiates): read (it comes back), write (it goes to the target), read-write.'
	);
const runtimeArgument = z
	.enum(RUNTIMES)
	.describe(
		`What runs a service's code on the server: ${RUNTIMES.join(', ')} (go and rust for native binaries). A service takes it whether or not it has a Skin.`
	);
// Bounds on what an agent sends, on top of the document size limit.
// Trimmed: a blank name would make an element no read shows.
const name = () => z.string().trim().min(1).max(200);
const cardinality = z
	.enum(CARDINALITIES)
	.describe('Merise Cardinality on the Leg next to this Entity.');
const typeArgument = z
	.string()
	.describe(
		'Data type: integer, bigint, decimal(p,s), text, text(n), boolean, date, datetime, uuid or serial (auto-increment). Default text.'
	);
const attributeInput = z.object({
	name: name(),
	type: typeArgument.optional(),
	identifier: z.boolean().optional().describe('Part of the Identifier (Entities only).'),
	optional: z.boolean().optional().describe('The column accepts NULL.')
});

/** `decimal(10,2)`, `text(120)`, `serial`… into a Data type. */
export function parseDataType(text: string): DataType {
	const match = /^\s*([a-z-]+)\s*(?:\(\s*(\d+)\s*(?:,\s*(\d+)\s*)?\))?\s*$/i.exec(text);
	const kind = match?.[1].toLowerCase();
	const first = match?.[2] ? Number(match[2]) : undefined;
	const second = match?.[3] ? Number(match[3]) : undefined;
	const type: unknown =
		kind === 'decimal' || kind === 'numeric'
			? first === undefined
				? dataType('decimal')
				: // As in SQL, decimal(p) has no fractional digits.
					{ kind: 'decimal', precision: first, scale: second ?? 0 }
			: kind === 'varchar' || (kind === 'text' && first !== undefined)
				? first === undefined
					? dataType('varchar')
					: { kind: 'varchar', length: first }
				: kind === 'auto-increment' || kind === 'autoincrement'
					? dataType('serial')
					: kind === 'timestamp'
						? dataType('datetime')
						: { kind };
	if (!isDataType(type)) throw new ToolError(`Unknown Data type "${text}".`);
	return type;
}

// Room for an element plus an Association between two neighbours, as the app draws them.
export const SLOT = { width: 360, height: 220 };
const ROW_LENGTH = 1300;

/**
 * A free spot after the last element of the bottom row, starting a new row
 * below once the row is long: elements fill the Diagram row by row.
 */
export function freeSpot(nodes: DiagramNode[]): { x: number; y: number } {
	if (nodes.length === 0) return { x: 0, y: 0 };
	const overlaps = (x: number, y: number) =>
		nodes.some((n) => Math.abs(n.x - x) < SLOT.width && Math.abs(n.y - y) < SLOT.height);
	const left = Math.min(...nodes.map((n) => n.x));
	const bottom = Math.max(...nodes.map((n) => n.y));
	// The bottom row: the elements level with the lowest one.
	const row = nodes.filter((n) => bottom - n.y < SLOT.height);
	let x = Math.max(...row.map((n) => n.x)) + SLOT.width;
	let y = Math.min(...row.map((n) => n.y));
	if (x - left > ROW_LENGTH) {
		x = left;
		y = bottom + SLOT.height;
	}
	while (overlaps(x, y)) x += SLOT.width;
	return { x, y };
}

const nodesOf = (project: ProjectDocument, diagramId: string, type?: string) =>
	project.nodes(diagramId).filter((n) => !type || n.type === type);

const zoneArgument = z.string().describe('Zone id or exact name.');
const zoneProviderArgument = z
	.enum(PROVIDERS)
	.describe(
		`The Provider of everything in the Zone, taken by Components that have none of their own: ${PROVIDERS.join(', ')}.`
	);

/**
 * A free spot for an element of `size` among `nodes`: next to them, or under
 * them all when that spot falls on a Zone, which would then hold it.
 */
function spotAmong(nodes: DiagramNode[], size: { width: number; height: number }) {
	const spot = freeSpot(nodes);
	const zones = nodes.filter((n) => n.type === 'zone');
	if (!zones.some((zone) => overlaps({ ...spot, ...size }, nodeBox(zone, estimatedSize)))) {
		return spot;
	}
	const boxes = nodes.map((n) => nodeBox(n, estimatedSize));
	return {
		x: Math.min(...boxes.map((b) => b.x)),
		y: Math.max(...boxes.map((b) => b.y + b.height)) + SLOT.height / 2
	};
}

/**
 * Where a new element of `size` goes: among the others, or in a Zone after
 * its content, the Zone and the Zones around it growing to hold it.
 */
function placeNew(
	project: ProjectDocument,
	diagramId: string,
	size: { width: number; height: number },
	zoneId?: string,
	/** An element being moved, which does not count among the others. */
	moving?: string
): { x: number; y: number } {
	const nodes = nodesOf(project, diagramId).filter((n) => n.id !== moving);
	if (!zoneId) return spotAmong(nodes, size);
	const parents = zoneParents(nodes, estimatedSize);
	const zone = nodes.find((n) => n.id === zoneId)!;
	const content = nodes.filter((n) => parents.get(n.id) === zoneId);
	const spot = content.length
		? spotAmong(content, size)
		: { x: zone.x + ZONE_PADDING.side, y: zone.y + ZONE_PADDING.top };
	growToHold(project, diagramId, zoneId, { ...spot, ...size });
	return spot;
}

/**
 * Grows a Zone, then each Zone around it, to hold `box` and what it held.
 * What lies across or beyond a growing edge moves by as much (a Zone with its
 * content), so that no Zone takes in an element it did not hold, nor loses one.
 */
function growToHold(
	project: ProjectDocument,
	diagramId: string,
	zoneId: string,
	box: Box,
	/** The element the room is for, when it is already drawn: never pushed. */
	keep?: string
): void {
	// Who holds what before anything moves: pushing must not change it.
	const parents = zoneParents(nodesOf(project, diagramId), estimatedSize);
	const ancestors = (id: string) => {
		const found: string[] = [];
		for (let up = parents.get(id); up; up = parents.get(up)) found.push(up);
		return found;
	};
	let extra: Box[] = [box];
	for (let at: string | undefined = zoneId; at; at = parents.get(at)) {
		const nodes = nodesOf(project, diagramId);
		const boxes = new Map(nodes.map((n) => [n.id, nodeBox(n, estimatedSize)]));
		const zone = boxes.get(at)!;
		const held = [
			...nodes.filter((n) => parents.get(n.id) === at).map((n) => boxes.get(n.id)!),
			...extra
		];
		extra = [];
		const right = zone.x + zone.width;
		const bottom = zone.y + zone.height;
		const dx = Math.max(0, ...held.map((b) => b.x + b.width + ZONE_PADDING.side - right));
		const dy = Math.max(0, ...held.map((b) => b.y + b.height + ZONE_PADDING.side - bottom));
		if (dx === 0 && dy === 0) continue;
		const around = new Set([at, ...zoneContent(parents, at), ...ancestors(at)]);
		if (keep) around.add(keep);
		const own = new Map<string, Point>();
		for (const n of nodes) {
			if (around.has(n.id)) continue;
			const b = boxes.get(n.id)!;
			own.set(n.id, { x: b.x + b.width > right ? dx : 0, y: b.y + b.height > bottom ? dy : 0 });
		}
		// An element moves at least as much as the Zones holding it, so it stays in them.
		const pushes = nodes.flatMap((n) => {
			const offset = own.get(n.id);
			if (!offset) return [];
			let { x, y } = offset;
			for (const up of ancestors(n.id)) {
				x = Math.max(x, own.get(up)?.x ?? 0);
				y = Math.max(y, own.get(up)?.y ?? 0);
			}
			return x || y ? [{ id: n.id, x: n.x + x, y: n.y + y }] : [];
		});
		if (pushes.length) project.moveNodes(diagramId, pushes);
		project.setZoneBox(diagramId, at, {
			...zone,
			width: zone.width + dx,
			height: zone.height + dy
		});
	}
}

function addAttributes(
	project: ProjectDocument,
	diagramId: string,
	nodeId: string,
	attributes: z.infer<typeof attributeInput>[]
) {
	for (const input of attributes) {
		const id = project.addAttribute(diagramId, nodeId, input.name);
		if (input.type) project.setAttributeType(diagramId, nodeId, id, parseDataType(input.type));
		if (input.identifier) project.toggleIdentifier(diagramId, nodeId, id);
		if (input.optional) project.setAttributeOptional(diagramId, nodeId, id, true);
	}
}

/** Why a Skin is refused, listing the ones the type offers; a Disk offers none. */
function skinRefusal(skin: string, offered: readonly string[], what: string): string {
	const products = offered.filter((id) => id !== 'generic');
	if (products.length === 0) return `${what[0].toUpperCase()}${what.slice(1)} takes no Skin.`;
	// Runtimes were Service Skins once: point an agent that remembers them to the right field.
	const runtime = (RUNTIMES as readonly string[]).includes(skin)
		? ` "${skin}" is a service's runtime: set it with runtime or set_runtime.`
		: '';
	return `No "${skin}" Skin for ${what}.${runtime} Skins: ${offered.join(', ')}.`;
}

/** The write tools: each call is one transaction that open browsers receive live. */
export function registerWriteTools(tool: RegisterTool, access: ProjectAccess) {
	tool(
		'add_diagram',
		'Adds a Diagram to the Project: a System design diagram or an MCD.',
		{ project: projectArgument, kind: z.enum(['system', 'mcd']), name: name() },
		({ project, kind, name }) => access.write(project, (p) => ({ id: p.addDiagram(kind, name) }))
	);

	tool(
		'add_component',
		'Adds a Component to a System design diagram, placed next to the others. After adding several, call layout_diagram.',
		{
			project: projectArgument,
			diagram: diagramArgument,
			type: componentTypeArgument,
			name: name(),
			skin: z
				.string()
				.optional()
				.describe(
					`A product or framework, e.g. postgresql, redis, kafka, nginx. A service's Skin is its framework (${SERVICE_FRAMEWORKS.join(', ')}) or a product (caddy, vaultwarden…); a web app, front end included, is a service. A client is what the end user runs it in: browser, android, ios, desktop.`
				),
			runtime: runtimeArgument.optional(),
			hosting: hostingArgument.optional(),
			provider: providerArgument.optional(),
			disk_kind: z
				.enum(DISK_KINDS)
				.optional()
				.describe('For a disk (physical storage attached to a machine): hdd, ssd, nvme or usb.'),
			zone: zoneArgument.optional().describe('Zone id or exact name to place the Component in.')
		},
		({ project, diagram, type, name, skin, runtime, hosting, provider, disk_kind, zone }) =>
			access.write(project, (p) => {
				const d = pickDiagram(p, diagram, 'system');
				if (skin && !skinFits(type, skin)) {
					throw new ToolError(skinRefusal(skin, SKIN_IDS[type], `a ${type}`));
				}
				// Checked before anything is drawn: a refused call leaves the Diagram as it was.
				if (disk_kind && type !== 'disk') throw new ToolError('Only a disk has a disk_kind.');
				if (runtime && type !== 'service') throw new ToolError('Only a service has a runtime.');
				if (isPerson(type) && hosting) throw new ToolError('A person has no hosting.');
				if (isPerson(type) && provider) throw new ToolError('A person has no provider.');
				const zoneId = zone ? pick(nodesOf(p, d.id, 'zone'), zone, 'zone').id : undefined;
				const size = estimatedSize({
					id: '',
					type: 'component',
					x: 0,
					y: 0,
					name,
					componentType: type,
					skin,
					runtime,
					diskKind: disk_kind
				});
				const { x, y } = placeNew(p, d.id, size, zoneId);
				const id = p.addComponent(d.id, type, name, x, y);
				if (skin) p.setSkin(d.id, id, skin);
				if (runtime) p.setRuntime(d.id, id, runtime);
				if (hosting) p.setHosting(d.id, id, hosting);
				if (provider) p.setProvider(d.id, id, provider);
				if (disk_kind) p.setDiskKind(d.id, id, disk_kind);
				return { id };
			})
	);

	tool(
		'add_zone',
		"Adds a Zone to a System design diagram: a named area (region, VPC, subnet…) that groups the Components drawn inside it, possibly inside another Zone. Put Components in it with add_component's zone, then call layout_diagram to fit it around them.",
		{
			project: projectArgument,
			diagram: diagramArgument,
			name: name(),
			zone: zoneArgument.optional().describe('The Zone to nest this one in.'),
			provider: zoneProviderArgument.optional()
		},
		({ project, diagram, name, zone, provider }) =>
			access.write(project, (p) => {
				const d = pickDiagram(p, diagram, 'system');
				const parent = zone ? pick(nodesOf(p, d.id, 'zone'), zone, 'zone').id : undefined;
				const { x, y } = placeNew(p, d.id, ZONE_DEFAULT, parent);
				const id = p.addZone(d.id, x, y, ZONE_DEFAULT.width, ZONE_DEFAULT.height, name);
				if (provider) p.setProvider(d.id, id, provider);
				return { id };
			})
	);

	tool(
		'set_zone',
		'Renames, moves, resizes a Zone or sets its Provider ("none" clears it). Moving it takes along everything it holds; resizing leaves its content in place, so it may then hold more or less.',
		{
			project: projectArgument,
			diagram: diagramArgument,
			zone: zoneArgument,
			name: name().optional(),
			x: z.number().optional(),
			y: z.number().optional(),
			width: z.number().min(1).optional(),
			height: z.number().min(1).optional(),
			provider: z.enum([...PROVIDERS, 'none']).optional()
		},
		({ project, diagram, zone, name, x, y, width, height, provider }) =>
			access.write(project, (p) => {
				const d = pickDiagram(p, diagram, 'system');
				const nodes = nodesOf(p, d.id);
				const target = pick(
					nodes.filter((n) => n.type === 'zone'),
					zone,
					'zone'
				) as ZoneNode;
				if (name) p.renameNode(d.id, target.id, name);
				if (provider) p.setProvider(d.id, target.id, provider === 'none' ? null : provider);
				const to = { x: x ?? target.x, y: y ?? target.y };
				if (to.x !== target.x || to.y !== target.y) {
					const dx = Math.round(to.x) - target.x;
					const dy = Math.round(to.y) - target.y;
					const carried = zoneContent(zoneParents(nodes, estimatedSize), target.id);
					p.moveNodes(d.id, [
						{ id: target.id, ...to },
						...carried.map((id) => {
							const node = nodes.find((n) => n.id === id)!;
							return { id, x: node.x + dx, y: node.y + dy };
						})
					]);
				}
				p.setZoneBox(d.id, target.id, {
					x: Math.round(to.x),
					y: Math.round(to.y),
					width: width ?? target.width,
					height: height ?? target.height
				});
				return { id: target.id };
			})
	);

	tool(
		'set_component',
		'Changes a Component in place, keeping its id and Connections: its type (a Skin the new type lacks goes back to generic; becoming or leaving person drops hosting and provider), its name, and its place: x and y, or a zone to move it into (after its content, the Zone growing), or zone "none" to move it out of every Zone. Give a position or a zone, not both.',
		{
			project: projectArgument,
			diagram: diagramArgument,
			component: z.string().describe('Component id or exact name.'),
			type: componentTypeArgument.optional(),
			name: name().optional(),
			x: z.number().optional(),
			y: z.number().optional(),
			zone: z
				.string()
				.optional()
				.describe('Zone id or exact name, or "none" for outside every Zone.')
		},
		({ project, diagram, component, type, name, x, y, zone }) =>
			access.write(project, (p) => {
				// Checked before anything changes: a refused call leaves the Diagram as it was.
				if (zone !== undefined && (x !== undefined || y !== undefined)) {
					throw new ToolError('Give a position or a zone, not both.');
				}
				const d = pickDiagram(p, diagram, 'system');
				const target = pick(nodesOf(p, d.id, 'component'), component, 'component');
				const zones = nodesOf(p, d.id, 'zone');
				// A Zone really named "none" wins over the "outside every Zone" meaning.
				const outside = zone === 'none' && !zones.some((z) => z.id === zone || z.name === zone);
				const zoneId = zone !== undefined && !outside ? pick(zones, zone, 'zone').id : undefined;
				const parentBefore = zoneParents(nodesOf(p, d.id), estimatedSize).get(target.id);

				if (type) p.setComponentType(d.id, target.id, type);
				if (name) p.renameNode(d.id, target.id, name);
				const current = () => p.nodes(d.id).find((n) => n.id === target.id)!;

				if (x !== undefined || y !== undefined) {
					p.moveNode(d.id, target.id, x ?? target.x, y ?? target.y);
				} else if (zoneId || outside) {
					// Already where asked: nothing moves, so its routes stay.
					if ((outside ? undefined : zoneId) === parentBefore) return { id: target.id };
					const spot = placeNew(p, d.id, estimatedSize(current()), zoneId, target.id);
					p.moveNode(d.id, target.id, spot.x, spot.y);
				} else if (parentBefore) {
					// A new name or type changes the box: its Zone grows rather than lose it.
					growToHold(p, d.id, parentBefore, nodeBox(current(), estimatedSize), target.id);
				}
				return { id: target.id };
			})
	);

	tool(
		'connect_components',
		'Draws a directed Connection between two Components, from the one that initiates (the caller, the client) to the one it reaches, with an optional label (HTTP, gRPC…) and Flow.',
		{
			project: projectArgument,
			diagram: diagramArgument,
			from: z.string().describe('Component id or exact name.'),
			to: z.string().describe('Component id or exact name.'),
			label: z.string().max(200).optional(),
			flow: flowArgument.optional()
		},
		({ project, diagram, from, to, label, flow }) =>
			access.write(project, (p) => {
				const d = pickDiagram(p, diagram, 'system');
				const components = nodesOf(p, d.id, 'component');
				const source = pick(components, from, 'component');
				const target = pick(components, to, 'component');
				const id = p.addConnection(d.id, source.id, target.id);
				if (!id) throw new ToolError('A Component cannot connect to itself.');
				if (label) p.setEdgeLabel(d.id, id, label);
				if (flow) p.setConnectionFlow(d.id, id, flow);
				return { id };
			})
	);

	tool(
		'set_connection',
		'Changes a Connection in place: its label ("" clears it) and its Flow ("none" clears it).',
		{
			project: projectArgument,
			diagram: diagramArgument,
			connection: z.string().describe('Connection id, from get_diagram.'),
			label: z.string().max(200).optional(),
			flow: z
				.enum([...FLOWS, 'none'])
				.optional()
				.describe(
					'What the data does, seen from the Component the arrow starts at (who initiates): read (it comes back), write (it goes to the target), read-write; none clears it.'
				)
		},
		({ project, diagram, connection, label, flow }) =>
			access.write(project, (p) => {
				if (label === undefined && !flow) throw new ToolError('Give a label or a flow.');
				const d = pickDiagram(p, diagram, 'system');
				const nodes = nodesOf(p, d.id);
				const nameOf = (id: string) => String(nodes.find((n) => n.id === id)?.name ?? id);
				const connections = p.edges(d.id).filter((e) => e.type === 'connection');
				const target = connections.find((e) => e.id === connection);
				if (!target) {
					// Connections have no name: list them by their ends.
					const known = connections
						.map((e) => `${e.id} (${nameOf(e.source)} → ${nameOf(e.target)})`)
						.join(', ');
					throw new ToolError(`No connection "${connection}". Known: ${known || 'none'}.`);
				}
				if (label !== undefined) p.setEdgeLabel(d.id, target.id, label);
				if (flow) p.setConnectionFlow(d.id, target.id, flow === 'none' ? null : flow);
				return { id: target.id };
			})
	);

	tool(
		'set_skin',
		'Gives a Component the look of a product or a framework, or the generic look with "generic". What runs a service is its runtime (set_runtime), not a Skin.',
		{
			project: projectArgument,
			diagram: diagramArgument,
			component: z.string().describe('Component id or exact name.'),
			skin: z.string()
		},
		({ project, diagram, component, skin }) =>
			access.write(project, (p) => {
				const d = pickDiagram(p, diagram, 'system');
				const target = pick(nodesOf(p, d.id, 'component'), component, 'component');
				if (skin !== 'generic' && !skinFits(String(target.componentType), skin)) {
					// A Component from an older file may have a type the catalog does not know.
					const skins: readonly string[] =
						SKIN_IDS[target.componentType as keyof typeof SKIN_IDS] ?? [];
					throw new ToolError(skinRefusal(skin, ['generic', ...skins], 'this Component'));
				}
				p.setSkin(d.id, target.id, skin === 'generic' ? null : skin);
				return { id: target.id };
			})
	);

	tool(
		'set_hosting',
		'Says where a Component runs (bare-metal, vm, docker, kubernetes, managed, serverless, external), or clears it with "none".',
		{
			project: projectArgument,
			diagram: diagramArgument,
			component: z.string().describe('Component id or exact name.'),
			hosting: z.enum([...HOSTINGS, 'none'])
		},
		({ project, diagram, component, hosting }) =>
			access.write(project, (p) => {
				const d = pickDiagram(p, diagram, 'system');
				const target = pick(nodesOf(p, d.id, 'component'), component, 'component');
				// Clearing is harmless: an agent resetting every Component must not stop at a Person.
				if (isPerson(target.componentType) && hosting !== 'none') {
					throw new ToolError('A person has no hosting.');
				}
				p.setHosting(d.id, target.id, hosting === 'none' ? null : hosting);
				return { id: target.id };
			})
	);

	tool(
		'set_provider',
		`Says whose infrastructure a Component runs on (${PROVIDERS.join(', ')}), or clears it with "none", after which it takes its Zone's Provider if any. It goes with any Hosting.`,
		{
			project: projectArgument,
			diagram: diagramArgument,
			component: z.string().describe('Component id or exact name.'),
			provider: z.enum([...PROVIDERS, 'none'])
		},
		({ project, diagram, component, provider }) =>
			access.write(project, (p) => {
				const d = pickDiagram(p, diagram, 'system');
				const target = pick(nodesOf(p, d.id, 'component'), component, 'component');
				if (isPerson(target.componentType) && provider !== 'none') {
					throw new ToolError('A person has no provider.');
				}
				p.setProvider(d.id, target.id, provider === 'none' ? null : provider);
				return { id: target.id };
			})
	);

	tool(
		'set_disk_kind',
		'Says what a disk is (hdd, ssd, nvme, usb), or clears it with "none".',
		{
			project: projectArgument,
			diagram: diagramArgument,
			disk: z.string().describe('Disk id or exact name.'),
			kind: z.enum([...DISK_KINDS, 'none'])
		},
		({ project, diagram, disk, kind }) =>
			access.write(project, (p) => {
				const d = pickDiagram(p, diagram, 'system');
				const target = pick(nodesOf(p, d.id, 'component'), disk, 'component');
				if (target.componentType !== 'disk') throw new ToolError('Only a disk has a kind.');
				p.setDiskKind(d.id, target.id, kind === 'none' ? null : kind);
				return { id: target.id };
			})
	);

	tool(
		'set_runtime',
		`Says what runs a service's code (${RUNTIMES.join(', ')}), or clears it with "none". It shows as the service's logo without a Skin, else as a badge beside it.`,
		{
			project: projectArgument,
			diagram: diagramArgument,
			service: z.string().describe('Service id or exact name.'),
			runtime: z.enum([...RUNTIMES, 'none'])
		},
		({ project, diagram, service, runtime }) =>
			access.write(project, (p) => {
				const d = pickDiagram(p, diagram, 'system');
				const target = pick(nodesOf(p, d.id, 'component'), service, 'component');
				if (target.componentType !== 'service')
					throw new ToolError('Only a service has a runtime.');
				p.setRuntime(d.id, target.id, runtime === 'none' ? null : runtime);
				return { id: target.id };
			})
	);

	tool(
		'add_note',
		'Writes a Note on a Diagram (either kind): free text on a sticky note that explains the Diagram (a schedule, a constraint) without being part of it. Placed beside the element given in near, else in a free spot; Tidy up leaves it where it is.',
		{
			project: projectArgument,
			diagram: diagramArgument,
			text: z.string().max(2000),
			color: z
				.enum(NOTE_COLORS)
				.optional()
				.describe('The paper: yellow (default), pink, green, blue, purple.'),
			near: z.string().optional().describe('Element id or exact name to place the Note beside.')
		},
		({ project, diagram, text, color, near }) =>
			access.write(project, (p) => {
				const d = pickDiagram(p, diagram);
				const nodes = nodesOf(p, d.id);
				let spot: { x: number; y: number };
				if (near) {
					const target = pick(
						nodes.filter((n) => n.type !== 'note'),
						near,
						'element'
					);
					// Beside it in its Zone, room made as for any element; else to its right if free.
					const zone = zoneParents(nodes, estimatedSize).get(target.id);
					const box = nodeBox(target, estimatedSize);
					const right = { x: box.x + box.width + 40, y: box.y, ...noteSize(text) };
					const free = !nodes.some((n) => overlaps(nodeBox(n, estimatedSize), right));
					spot = zone
						? placeNew(p, d.id, noteSize(text), zone)
						: free
							? right
							: spotAmong(nodes, noteSize(text));
				} else {
					spot = d.kind === 'system' ? spotAmong(nodes, noteSize(text)) : freeSpot(nodes);
				}
				const id = p.addNote(d.id, spot.x, spot.y, text);
				if (color) p.setNoteColor(d.id, id, color);
				return { id };
			})
	);

	tool(
		'set_note',
		'Rewrites a Note and recolors it.',
		{
			project: projectArgument,
			diagram: diagramArgument,
			note: z.string().describe('Note id, from get_diagram.'),
			text: z.string().max(2000).optional(),
			color: z.enum(NOTE_COLORS).optional()
		},
		({ project, diagram, note, text, color }) =>
			access.write(project, (p) => {
				if (text === undefined && !color) throw new ToolError('Give a text or a color.');
				const d = pickDiagram(p, diagram);
				const notes = nodesOf(p, d.id, 'note');
				const target = notes.find((n) => n.id === note);
				if (!target) {
					throw new ToolError(
						`No note "${note}". Known: ${notes.map((n) => n.id).join(', ') || 'none'}.`
					);
				}
				if (text !== undefined) p.setNoteText(d.id, target.id, text);
				if (color) p.setNoteColor(d.id, target.id, color);
				return { id: target.id };
			})
	);

	tool(
		'add_entity',
		'Adds an Entity to an MCD, placed next to the others. Without an identifier Attribute it gets an auto-increment id. After adding several, call layout_diagram.',
		{
			project: projectArgument,
			diagram: diagramArgument,
			name: name(),
			attributes: z.array(attributeInput).max(100).optional()
		},
		({ project, diagram, name, attributes = [] }) =>
			access.write(project, (p) => {
				const d = pickDiagram(p, diagram, 'mcd');
				attributes.forEach((a) => a.type && parseDataType(a.type));
				const { x, y } = freeSpot(nodesOf(p, d.id));
				const id = p.addEntity(d.id, x, y, name);
				if (attributes.some((a) => a.identifier)) {
					const defaultId = (p.nodes(d.id).find((n) => n.id === id)!.attributes as Attribute[])[0];
					p.removeAttribute(d.id, id, defaultId.id);
				}
				addAttributes(p, d.id, id, attributes);
				return { id };
			})
	);

	tool(
		'add_attribute',
		'Adds an Attribute to an Entity or an Association of an MCD.',
		{
			project: projectArgument,
			diagram: diagramArgument,
			element: z.string().describe('Entity or Association id or exact name.'),
			attribute: attributeInput
		},
		({ project, diagram, element, attribute }) =>
			access.write(project, (p) => {
				const d = pickDiagram(p, diagram, 'mcd');
				if (attribute.type) parseDataType(attribute.type);
				// A Note has text, neither a name nor Attributes.
				const target = pick(
					nodesOf(p, d.id).filter((n) => n.type !== 'note'),
					element,
					'element'
				);
				if (attribute.identifier && target.type !== 'entity') {
					throw new ToolError('Only an Entity has an Identifier.');
				}
				addAttributes(p, d.id, target.id, [attribute]);
				const attributes = p.nodes(d.id).find((n) => n.id === target.id)!.attributes as Attribute[];
				return { id: attributes.at(-1)!.id };
			})
	);

	const legInput = z.object({ entity: z.string(), cardinality });
	tool(
		'add_association',
		'Adds an Association: give legs, two or more { entity, cardinality } (three or more make an N-ary Association, the same Entity may appear twice), or from and to for a binary one.',
		{
			project: projectArgument,
			diagram: diagramArgument,
			name: name(),
			legs: z.array(legInput).min(2).max(20).optional(),
			from: legInput.optional(),
			to: legInput.optional(),
			attributes: z
				.array(attributeInput.omit({ identifier: true }))
				.max(100)
				.optional()
		},
		({ project, diagram, name, legs, from, to, attributes = [] }) =>
			access.write(project, (p) => {
				const d = pickDiagram(p, diagram, 'mcd');
				attributes.forEach((a) => a.type && parseDataType(a.type));
				if (legs && (from || to)) throw new ToolError('Give legs, or from and to, not both.');
				const wanted = legs ?? (from && to ? [from, to] : null);
				if (!wanted) throw new ToolError('Give legs (two or more), or from and to.');
				const entities = nodesOf(p, d.id, 'entity');
				const targets = wanted.map((leg) => pick(entities, leg.entity, 'entity'));
				const id = p.addAssociation(d.id, targets[0].id, targets[1].id, name);
				for (const target of targets.slice(2)) p.addLeg(d.id, id, target.id);
				// Each Leg takes the Cardinality given with its Entity; an Entity given twice
				// (reflexive) has alike Legs, so any of them will do.
				const unset = p.edges(d.id).filter((e) => e.source === id);
				wanted.forEach((leg, i) => {
					const made = unset.splice(
						unset.findIndex((e) => e.target === targets[i].id),
						1
					)[0];
					p.setCardinality(d.id, made.id, leg.cardinality);
				});
				addAttributes(p, d.id, id, attributes);
				return { id };
			})
	);

	tool(
		'add_leg',
		'Adds a Leg from an Association to an Entity: three Legs or more make an N-ary Association, which the MLD always turns into a table.',
		{
			project: projectArgument,
			diagram: diagramArgument,
			association: z.string().describe('Association id or exact name.'),
			entity: z.string().describe('Entity id or exact name.'),
			cardinality: cardinality.optional().describe('Default 0,n.')
		},
		({ project, diagram, association, entity, cardinality: value }) =>
			access.write(project, (p) => {
				const d = pickDiagram(p, diagram, 'mcd');
				const target = pick(nodesOf(p, d.id, 'association'), association, 'association');
				const to = pick(nodesOf(p, d.id, 'entity'), entity, 'entity');
				const id = p.addLeg(d.id, target.id, to.id);
				if (value) p.setCardinality(d.id, id, value);
				return { id };
			})
	);

	tool(
		'add_cif',
		'Puts a CIF (functional integrity constraint) on an N-ary Association: the Entities on the determinant Legs fix the one on the determined Leg, which the MLD then leaves out of the key. Name each Leg by its Entity, or by its id when the Entity is on several.',
		{
			project: projectArgument,
			diagram: diagramArgument,
			association: z.string().describe('Association id or exact name.'),
			determinants: z.array(z.string()).min(1).max(20),
			determined: z.string()
		},
		({ project, diagram, association, determinants, determined }) =>
			access.write(project, (p) => {
				const d = pickDiagram(p, diagram, 'mcd');
				const target = pick(nodesOf(p, d.id, 'association'), association, 'association');
				const legs = p.edges(d.id).filter((e) => e.source === target.id);
				if (legs.length < 3) {
					throw new ToolError('A CIF goes on an Association with three Legs or more.');
				}
				const entities = nodesOf(p, d.id, 'entity');
				const legOf = (reference: string) => {
					const byId = legs.find((l) => l.id === reference);
					if (byId) return byId.id;
					const matching = legs.filter((l) =>
						entities.some((e) => e.id === l.target && (e.id === reference || e.name === reference))
					);
					if (matching.length === 0) {
						throw new ToolError(`"${reference}" is not linked by this Association.`);
					}
					if (matching.length > 1) {
						throw new ToolError(`"${reference}" is on several Legs: give a Leg id.`);
					}
					return matching[0].id;
				};
				const determinedLeg = legOf(determined);
				const determinantLegs = [...new Set(determinants.map(legOf))];
				if (determinantLegs.includes(determinedLeg)) {
					throw new ToolError('The determined Leg cannot also be a determinant.');
				}
				const id = p.addCif(d.id, target.id);
				p.setCifRole(d.id, id, determinedLeg, 'determined');
				for (const leg of determinantLegs) p.setCifRole(d.id, id, leg, 'determinant');
				for (const leg of legs) {
					if (leg.id !== determinedLeg && !determinantLegs.includes(leg.id)) {
						p.setCifRole(d.id, id, leg.id, 'none');
					}
				}
				return { id };
			})
	);

	tool(
		'set_inheritance',
		'Makes an Entity a child of a parent Entity (null: of none), sharing its Attributes and Identifier; one parent per Entity, no cycles.',
		{
			project: projectArgument,
			diagram: diagramArgument,
			entity: z.string().describe('Child Entity id or exact name.'),
			parent: z.string().nullable().describe('Parent Entity id or exact name, or null.')
		},
		({ project, diagram, entity, parent }) =>
			access.write(project, (p) => {
				const d = pickDiagram(p, diagram, 'mcd');
				const entities = nodesOf(p, d.id, 'entity');
				const child = pick(entities, entity, 'entity');
				const to = parent === null ? null : pick(entities, parent, 'entity');
				if (to && p.selfAndDescendants(d.id, child.id).has(to.id)) {
					throw new ToolError('An Entity cannot inherit from itself or a descendant.');
				}
				p.setParent(d.id, child.id, to?.id ?? null);
				return { ok: true };
			})
	);

	tool(
		'set_inheritance_options',
		"Sets the Inheritance under a parent Entity: its constraint (none, X exclusion, T totality, XT partition) and how the MLD translates it (reference: child tables referencing the parent's; down: no parent table; up: one parent table with a type column).",
		{
			project: projectArgument,
			diagram: diagramArgument,
			parent: z.string().describe('Parent Entity id or exact name.'),
			constraint: z.enum(INHERITANCE_CONSTRAINTS).optional(),
			translation: z.enum(INHERITANCE_TRANSLATIONS).optional()
		},
		({ project, diagram, parent, constraint, translation }) =>
			access.write(project, (p) => {
				if (!constraint && !translation)
					throw new ToolError('Give a constraint, a translation or both.');
				const d = pickDiagram(p, diagram, 'mcd');
				const entity = pick(nodesOf(p, d.id, 'entity'), parent, 'entity');
				// The first by id, as the MLD reads it, should peers have made two.
				const inheritance = nodesOf(p, d.id, 'inheritance')
					.filter((n) => n.parent === entity.id)
					.sort((a, b) => a.id.localeCompare(b.id))[0];
				if (!inheritance) throw new ToolError(`"${entity.name}" has no child Entities.`);
				if (constraint) p.setInheritanceConstraint(d.id, inheritance.id, constraint);
				if (translation) p.setInheritanceTranslation(d.id, inheritance.id, translation);
				return { id: inheritance.id };
			})
	);

	tool(
		'set_cardinality',
		"Sets the Cardinality of an Association's Leg next to an Entity; for a reflexive Association, give the Leg's id. relative: true marks a 1,1 Leg of a binary Association as a relative identifier (the Entity is identified within the other one, whose key leads its table's key).",
		{
			project: projectArgument,
			diagram: diagramArgument,
			association: z.string().describe('Association id or exact name.'),
			entity: z.string().describe('Entity id or exact name, or the Leg id.'),
			cardinality,
			relative: z.boolean().optional().describe('Default: unchanged (false once not 1,1).')
		},
		({ project, diagram, association, entity, cardinality: value, relative }) =>
			access.write(project, (p) => {
				const d = pickDiagram(p, diagram, 'mcd');
				const target = pick(nodesOf(p, d.id, 'association'), association, 'association');
				const legs = p.edges(d.id).filter((e): e is LegEdge => e.source === target.id);
				const byId = legs.find((l) => l.id === entity);
				const entityId = byId ? undefined : pick(nodesOf(p, d.id, 'entity'), entity, 'entity').id;
				const matching = byId ? [byId] : legs.filter((l) => l.target === entityId);
				if (matching.length === 0) {
					throw new ToolError(`"${entity}" is not linked by this Association.`);
				}
				if (matching.length !== 1) {
					throw new ToolError(
						`Give the Leg's id: ${legs.map((l) => `${l.id} (${l.cardinality})`).join(', ')}.`
					);
				}
				// Checked before writing anything, with the Cardinality it is about to get.
				const leg = matching[0];
				const after = legs.map((l) => (l.id === leg.id ? { ...l, cardinality: value } : l));
				if (relative && !canBeRelative(after, leg.id)) {
					throw new ToolError(
						'A relative identifier goes on a 1,1 Leg of a binary Association between two Entities.'
					);
				}
				p.setCardinality(d.id, leg.id, value);
				if (relative !== undefined) p.setRelative(d.id, leg.id, relative);
				return { id: leg.id };
			})
	);

	tool(
		'rename_element',
		'Renames a Diagram (without element) or one of its elements: Component, Zone, Entity or Association.',
		{
			project: projectArgument,
			diagram: diagramArgument,
			element: z
				.string()
				.optional()
				.describe('Element id or exact name; omit to rename the Diagram.'),
			name: name()
		},
		({ project, diagram, element, name }) =>
			access.write(project, (p) => {
				const d = pickDiagram(p, diagram);
				if (!element) {
					p.renameDiagram(d.id, name);
					return { id: d.id };
				}
				// A Note has text, neither a name nor Attributes.
				const target = pick(
					nodesOf(p, d.id).filter((n) => n.type !== 'note'),
					element,
					'element'
				);
				p.renameNode(d.id, target.id, name);
				return { id: target.id };
			})
	);

	tool(
		'layout_diagram',
		'Arranges a whole Diagram in layers from left to right along its Connections or Legs. Call it after adding several elements.',
		{ project: projectArgument, diagram: diagramArgument },
		async ({ project, diagram }) => {
			// The layout is asynchronous: compute it from a read, then write it only if the
			// Diagram did not change meanwhile; otherwise lay it out again.
			for (let attempt = 0; attempt < 3; attempt++) {
				const { id, kind, nodes, edges } = await access.read(project, (p) => {
					const d = pickDiagram(p, diagram);
					return { id: d.id, kind: d.kind, nodes: p.nodes(d.id), edges: p.edges(d.id) };
				});
				const before = layoutFingerprint(nodes, edges);
				const { positions, routes, zoneSizes } = await layoutDiagram(
					nodes,
					edges,
					estimatedSize,
					kind
				);
				const written = await access.write(project, (p) => {
					if (layoutFingerprint(p.nodes(id), p.edges(id)) !== before) return null;
					p.arrange(id, positions, routes, zoneSizes);
					return { arranged: positions.size, routed: routes.size };
				});
				if (written) return written;
			}
			throw new ToolError('The Diagram keeps changing: try layout_diagram again.');
		}
	);

	tool(
		'delete_elements',
		'Deletes elements of a Diagram (by id or exact name); their Connections or Legs go with them. Deleting a Zone keeps what it holds.',
		{
			project: projectArgument,
			diagram: diagramArgument,
			elements: z.array(z.string()).min(1)
		},
		({ project, diagram, elements }) =>
			access.write(project, (p) => {
				const d = pickDiagram(p, diagram);
				const nodes = nodesOf(p, d.id);
				const edges = p.edges(d.id);
				const nodeIds: string[] = [];
				const edgeIds: string[] = [];
				for (const reference of elements) {
					const edge = edges.find((e) => e.id === reference);
					if (edge) edgeIds.push(edge.id);
					else nodeIds.push(pick(nodes, reference, 'element').id);
				}
				p.deleteElements(d.id, nodeIds, edgeIds);
				return { deleted: [...nodeIds, ...edgeIds] };
			})
	);
}
