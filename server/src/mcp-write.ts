import { dataType, isDataType, type DataType } from '@simple-modelisation/model/data-types.ts';
import {
	CARDINALITIES,
	COMPONENT_TYPE_IDS,
	type Attribute,
	type DiagramNode,
	type LegEdge,
	type ProjectDocument
} from '@simple-modelisation/model/project.ts';
import { estimatedSize, layoutDiagram } from '@simple-modelisation/model/layout.ts';
import { SKIN_IDS } from '@simple-modelisation/model/skins.ts';
import { z } from 'zod';
import type { ProjectAccess, RegisterTool } from './mcp.ts';
import { projectArgument } from './mcp.ts';
import { ToolError } from './mcp-error.ts';
import { pick, pickDiagram } from './mcp-views.ts';

const diagramArgument = z.string().describe('Diagram id or exact name.');
// Bounds on what an agent sends, on top of the document size limit.
const name = () => z.string().min(1).max(200);
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
			type: z.enum(COMPONENT_TYPE_IDS),
			name: name(),
			skin: z
				.string()
				.optional()
				.describe('A market product, e.g. postgresql, redis, kafka, nginx.')
		},
		({ project, diagram, type, name, skin }) =>
			access.write(project, (p) => {
				const d = pickDiagram(p, diagram, 'system');
				if (skin && !(SKIN_IDS[type] as readonly string[]).includes(skin)) {
					throw new ToolError(
						`No "${skin}" Skin for a ${type}. Skins: ${SKIN_IDS[type].join(', ')}.`
					);
				}
				const { x, y } = freeSpot(nodesOf(p, d.id));
				const id = p.addComponent(d.id, type, name, x, y);
				if (skin) p.setSkin(d.id, id, skin);
				return { id };
			})
	);

	tool(
		'connect_components',
		'Draws a directed Connection between two Components, with an optional label (HTTP, gRPC…).',
		{
			project: projectArgument,
			diagram: diagramArgument,
			from: z.string().describe('Component id or exact name.'),
			to: z.string().describe('Component id or exact name.'),
			label: z.string().max(200).optional()
		},
		({ project, diagram, from, to, label }) =>
			access.write(project, (p) => {
				const d = pickDiagram(p, diagram, 'system');
				const components = nodesOf(p, d.id, 'component');
				const source = pick(components, from, 'component');
				const target = pick(components, to, 'component');
				const id = p.addConnection(d.id, source.id, target.id);
				if (!id) throw new ToolError('A Component cannot connect to itself.');
				if (label) p.setEdgeLabel(d.id, id, label);
				return { id };
			})
	);

	tool(
		'set_skin',
		'Gives a Component the look of a market product, or the generic look with "generic".',
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
				// A Component from an older file may have a type the catalog does not know.
				const skins: readonly string[] =
					SKIN_IDS[target.componentType as keyof typeof SKIN_IDS] ?? [];
				if (skin !== 'generic' && !skins.includes(skin)) {
					throw new ToolError(
						`No "${skin}" Skin for this Component. Skins: generic, ${skins.join(', ')}.`
					);
				}
				p.setSkin(d.id, target.id, skin === 'generic' ? null : skin);
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
				const target = pick(nodesOf(p, d.id), element, 'element');
				if (attribute.identifier && target.type !== 'entity') {
					throw new ToolError('Only an Entity has an Identifier.');
				}
				addAttributes(p, d.id, target.id, [attribute]);
				const attributes = p.nodes(d.id).find((n) => n.id === target.id)!.attributes as Attribute[];
				return { id: attributes.at(-1)!.id };
			})
	);

	tool(
		'add_association',
		'Adds a binary Association between two Entities (the same one for a reflexive Association), with the Cardinality next to each.',
		{
			project: projectArgument,
			diagram: diagramArgument,
			name: name(),
			from: z.object({ entity: z.string(), cardinality }),
			to: z.object({ entity: z.string(), cardinality }),
			attributes: z
				.array(attributeInput.omit({ identifier: true }))
				.max(100)
				.optional()
		},
		({ project, diagram, name, from, to, attributes = [] }) =>
			access.write(project, (p) => {
				const d = pickDiagram(p, diagram, 'mcd');
				attributes.forEach((a) => a.type && parseDataType(a.type));
				const entities = nodesOf(p, d.id, 'entity');
				const a = pick(entities, from.entity, 'entity');
				const b = pick(entities, to.entity, 'entity');
				const id = p.addAssociation(d.id, a.id, b.id, name);
				// Each Leg by its Entity, not by order; a reflexive Association's two Legs are alike.
				const legs = p.edges(d.id).filter((e) => e.source === id);
				const legA = legs.find((l) => l.target === a.id)!;
				const legB = legs.find((l) => l.id !== legA.id)!;
				p.setCardinality(d.id, legA.id, from.cardinality);
				p.setCardinality(d.id, legB.id, to.cardinality);
				addAttributes(p, d.id, id, attributes);
				return { id };
			})
	);

	tool(
		'set_cardinality',
		"Sets the Cardinality of an Association's Leg next to an Entity; for a reflexive Association, give the Leg's id.",
		{
			project: projectArgument,
			diagram: diagramArgument,
			association: z.string().describe('Association id or exact name.'),
			entity: z.string().describe('Entity id or exact name, or the Leg id.'),
			cardinality
		},
		({ project, diagram, association, entity, cardinality: value }) =>
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
				p.setCardinality(d.id, matching[0].id, value);
				return { id: matching[0].id };
			})
	);

	tool(
		'rename_element',
		'Renames a Diagram (without element) or one of its elements: Component, Entity or Association.',
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
				const target = pick(nodesOf(p, d.id), element, 'element');
				p.renameNode(d.id, target.id, name);
				return { id: target.id };
			})
	);

	tool(
		'layout_diagram',
		'Arranges a whole Diagram in layers from left to right along its Connections or Legs. Call it after adding several elements.',
		{ project: projectArgument, diagram: diagramArgument },
		({ project, diagram }) =>
			access.write(project, (p) => {
				const d = pickDiagram(p, diagram);
				const { positions, routes } = layoutDiagram(p.nodes(d.id), p.edges(d.id), estimatedSize);
				p.arrange(d.id, positions, routes);
				return { arranged: positions.size, routed: routes.size };
			})
	);

	tool(
		'delete_elements',
		'Deletes elements of a Diagram (by id or exact name); their Connections or Legs go with them.',
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
