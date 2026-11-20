import type {
	CifNode,
	InheritanceNode,
	AssociationNode,
	ComponentNode,
	ConnectionEdge,
	Diagram,
	DiagramEdge,
	DiagramNode,
	EntityNode,
	LegEdge,
	NoteNode,
	ProjectDocument,
	ZoneNode
} from '@simple-modelisation/model/project.ts';
import { estimatedSize } from '@simple-modelisation/model/layout.ts';
import { effectiveProviders, zoneParents } from '@simple-modelisation/model/zones.ts';
import { ENGLISH_NAMES } from '@simple-modelisation/model/names.ts';
import { deriveMld } from '@simple-modelisation/model/sql/mld.ts';
import { systemSvg } from '@simple-modelisation/model/svg/system.ts';
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
	// A Note has no name: its type says what it is.
	const known = items
		.map((item) => `${String(item.name ?? (item as { type?: string }).type)} (${item.id})`)
		.join(', ');
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
	/** The Notes, with the Zone each lies in on a System design diagram. */
	const notesOf = (zoneOf?: (id: string) => { id: string; name: string } | null) =>
		only<NoteNode>(nodes, 'note').map((n) => ({
			id: n.id,
			text: n.text,
			color: n.color ?? 'yellow',
			...(zoneOf && { zone: zoneOf(n.id) })
		}));

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
				...(c.componentType === 'service' && { runtime: c.runtime ?? null }),
				zone: zoneOf(c.id)
			})),
			notes: notesOf(zoneOf),
			connections: only<ConnectionEdge>(edges, 'connection').map((c) => ({
				id: c.id,
				from: nameOf(c.source),
				to: nameOf(c.target),
				label: c.label,
				flow: c.flow ?? null
			}))
		};
	}

	const legs = only<LegEdge>(edges, 'leg');
	return {
		...base,
		notes: notesOf(),
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
				.map((l) => ({
					id: l.id,
					entity: nameOf(l.target),
					cardinality: l.cardinality,
					relative: l.relative === true
				}))
		})),
		inheritances: only<InheritanceNode>(nodes, 'inheritance').map((i) => ({
			id: i.id,
			parent: nameOf(i.parent),
			children: edges
				.filter((e) => e.type === 'isa' && e.source === i.id)
				.map((e) => nameOf(e.target)),
			constraint: i.constraint ?? 'none',
			translation: i.translation ?? 'reference'
		})),
		cifs: only<CifNode>(nodes, 'cif').map((c) => {
			const legOf = (id: string) => ({
				leg: id,
				entity: nameOf(legs.find((l) => l.id === id)?.target ?? id)
			});
			return {
				id: c.id,
				association: nameOf(c.association),
				determinants: c.determinants.map(legOf),
				determined: legOf(c.determined)
			};
		})
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

/**
 * Diagrams drawn as SVG: the one named, or every one. MCDs are not drawn yet:
 * they come back in `skipped`, and naming one is an error.
 */
export function exportDiagrams(project: ProjectDocument, reference?: string, legend = true) {
	// Naming an MCD is refused: only System design diagrams are drawn for now.
	const diagrams = reference ? [pickDiagram(project, reference, 'system')] : project.diagrams();
	return {
		images: diagrams
			.filter((d) => d.kind === 'system')
			.map((d) => ({
				id: d.id,
				name: d.name,
				svg: systemSvg(project.nodes(d.id), project.edges(d.id), { names: ENGLISH_NAMES, legend })
			})),
		skipped: diagrams.filter((d) => d.kind === 'mcd').map((d) => d.name)
	};
}
