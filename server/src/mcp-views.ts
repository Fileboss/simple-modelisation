import type {
	AssociationNode,
	ComponentNode,
	ConnectionEdge,
	Diagram,
	DiagramEdge,
	DiagramNode,
	EntityNode,
	LegEdge,
	ProjectDocument
} from '@simple-modelisation/model/project.ts';
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
		return {
			...base,
			components: only<ComponentNode>(nodes, 'component').map((c) => ({
				id: c.id,
				name: c.name,
				type: c.componentType,
				skin: c.skin
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
