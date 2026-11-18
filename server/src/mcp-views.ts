import type {
	AssociationNode,
	ComponentNode,
	ConnectionEdge,
	Diagram,
	DiagramEdge,
	DiagramNode,
	EntityNode,
	LegEdge,
	ProjectDocument,
	ZoneNode
} from '@simple-modelisation/model/project.ts';
import { estimatedSize } from '@simple-modelisation/model/layout.ts';
import { effectiveProviders, zoneParents } from '@simple-modelisation/model/zones.ts';
import { deriveMld } from '@simple-modelisation/model/sql/mld.ts';
import { mldText, postgresScript } from '@simple-modelisation/model/sql/postgres.ts';
import { ToolError } from './mcp-error.ts';

/** The one item `reference` names, by id or exact name; an error lists the candidates otherwise. */
export function pick<T extends { id: string; name?: unknown }>(
	items: T[],
	reference: string,
	what: string
): T {
	const byId = items.find((item) => item.id === reference);
	if (byId) return byId;
	const named = items.filter((item) => item.name === reference);
	if (named.length === 1) return named[0];
	if (named.length > 1) {
		throw new ToolError(
			`Several ${what}s are named "${reference}": ${named.map((n) => n.id).join(', ')}. Use an id.`
		);
	}
	const known = items.map((item) => `${String(item.name)} (${item.id})`).join(', ');
	throw new ToolError(`No ${what} "${reference}". Known: ${known || 'none'}.`);
}

export function pickDiagram(project: ProjectDocument, reference: string, kind?: Diagram['kind']) {
	const diagram = pick(project.diagrams(), reference, 'diagram');
	if (kind && diagram.kind !== kind) {
		throw new ToolError(
			`"${diagram.name}" is not ${kind === 'mcd' ? 'an MCD' : 'a System design diagram'}.`
		);
	}
	return diagram;
}

const kindName = (kind: Diagram['kind']) => (kind === 'mcd' ? 'mcd' : 'system design');

export function describeProject(project: ProjectDocument) {
	return {
		name: project.name(),
		diagrams: project.diagrams().map((d) => ({ id: d.id, name: d.name, kind: kindName(d.kind) }))
	};
}

export function describeDiagram(project: ProjectDocument, reference: string) {
	const diagram = pickDiagram(project, reference);
	const nodes = project.nodes(diagram.id);
	const edges = project.edges(diagram.id);
	const nameOf = (id: string) => String(nodes.find((n) => n.id === id)?.name ?? id);
	const base = { id: diagram.id, name: diagram.name, kind: kindName(diagram.kind) };

	if (diagram.kind === 'system') {
		// The innermost Zone each element lies in, as drawn.
		const parents = zoneParents(nodes, estimatedSize);
		// A Component's Provider as shown: its own, else its Zone's (provider_from names that Zone).
		const providers = effectiveProviders(nodes, parents);
		const providerOf = (id: string) => {
			const effective = providers.get(id);
			return {
				provider: effective?.provider ?? null,
				provider_from: effective?.from ? { id: effective.from, name: nameOf(effective.from) } : null
			};
		};
		// By id and name: Zone names need not be unique (a Private subnet per region).
		const zoneOf = (id: string) => {
			const parent = parents.get(id);
			return parent ? { id: parent, name: nameOf(parent) } : null;
		};
		return {
			...base,
			zones: only<ZoneNode>(nodes, 'zone').map((z) => ({
				id: z.id,
				name: z.name,
				zone: zoneOf(z.id),
				x: z.x,
				y: z.y,
				width: z.width,
				height: z.height,
				provider: z.provider ?? null
			})),
			components: only<ComponentNode>(nodes, 'component').map((c) => ({
				id: c.id,
				name: c.name,
				type: c.componentType,
				skin: c.skin,
				hosting: c.hosting ?? null,
				...providerOf(c.id),
				...(c.componentType === 'disk' && { disk_kind: c.diskKind ?? null }),
				zone: zoneOf(c.id)
			})),
			connections: only<ConnectionEdge>(edges, 'connection').map((c) => ({
				id: c.id,
				from: nameOf(c.source),
				to: nameOf(c.target),
				label: c.label
			}))
		};
	}

	const legs = only<LegEdge>(edges, 'leg');
	return {
		...base,
		entities: only<EntityNode>(nodes, 'entity').map((e) => ({
			id: e.id,
			name: e.name,
			attributes: e.attributes
		})),
		associations: only<AssociationNode>(nodes, 'association').map((a) => ({
			id: a.id,
			name: a.name,
			attributes: a.attributes,
			legs: legs
				.filter((l) => l.source === a.id)
				.map((l) => ({ id: l.id, entity: nameOf(l.target), cardinality: l.cardinality }))
		}))
	};
}

export function mcdSql(project: ProjectDocument, reference: string) {
	const diagram = pickDiagram(project, reference, 'mcd');
	const mld = deriveMld(project.nodes(diagram.id), project.edges(diagram.id));
	return { mld: mldText(mld), sql: postgresScript(mld, diagram.name), warnings: mld.warnings };
}

function only<T extends DiagramNode | DiagramEdge>(
	items: (DiagramNode | DiagramEdge)[],
	type: string
) {
	return items.filter((item) => item.type === type) as T[];
}
