import { dataType, type DataType, type DataTypeKind } from './data-types.ts';
import { borderPoint, center, drawnRoute, routedPath, type Box } from './geometry.ts';
import type { Size } from './layout.ts';
import { postgresType } from './sql/postgres.ts';
import type {
	Attribute,
	Cardinality,
	CifNode,
	DiagramEdge,
	DiagramNode,
	InheritanceConstraint,
	InheritanceNode,
	LegEdge,
	Point
} from './project.ts';

/**
 * What an MCD draws beyond what it stores, in either Notation: shared by the
 * canvas and the SVG image, so that both follow the same rules.
 */

/** How an MCD is drawn; the model is the same. */
export type Notation = 'merise' | 'uml';

const MULTIPLICITIES: Record<Cardinality, string> = {
	'0,1': '0..1',
	'1,1': '1',
	'0,n': '0..*',
	'1,n': '1..*'
};

export const umlMultiplicity = (cardinality: Cardinality) => MULTIPLICITIES[cardinality];

/** `Text(120)`, `Decimal(10,2)`, given the names of the kinds. */
export function dataTypeLabel(type: DataType, kinds: Record<DataTypeKind, string>): string {
	const name = kinds[type.kind];
	if (type.kind === 'varchar') return name.replace('(n)', `(${type.length})`);
	if (type.kind === 'decimal') return `${name}(${type.precision},${type.scale})`;
	return name;
}

/** `email : Text(120) [0..1]`, `id : Auto-increment {id}`. */
export function umlAttribute(attribute: Attribute, kinds: Record<DataTypeKind, string>): string {
	const flags = `${attribute.identifier ? ' {id}' : ''}${attribute.optional ? ' [0..1]' : ''}`;
	return `${attribute.name} : ${dataTypeLabel(attribute.type, kinds)}${flags}`;
}

/** The PostgreSQL type Merise shows beside an Attribute when types are shown. */
export const shownType = (attribute: Pick<Attribute, 'type'>) =>
	postgresType(attribute.type ?? dataType('text'));

/** Between a name and its type, at least. */
export const TYPE_GAP = 12;

/** Roughly how wide a shown type is, 12px italic: mostly capitals, wider than names. */
export const typeWidth = (type: string) =>
	[...type].reduce(
		(width, char) => width + (/[A-Z]/.test(char) ? 8.2 : /\d/.test(char) ? 6.7 : 3.7),
		0
	);

/** UML's words for an Inheritance's constraint, beside the generalisation's triangle. */
export const UML_CONSTRAINTS: Record<Exclude<InheritanceConstraint, 'none'>, string> = {
	X: '{disjoint}',
	T: '{complete}',
	XT: '{disjoint, complete}'
};

/** How UML draws an Association: a label on its line, or a diamond when N-ary. */
export type UmlAssociation = {
	nary: boolean;
	/** Where its association class goes: above a horizontal line, beside a vertical one. */
	side: 'top' | 'right';
	/** A binary Association's label: its top-left corner, between its classes. */
	at?: Point;
};

/**
 * The Leg whose Cardinality shows at this Leg's class end in UML: the other Leg
 * of a binary Association, the Leg itself on an N-ary one. `composition`: the
 * other Leg's Entity is identified relative to this one's, drawn as a filled
 * diamond here.
 */
export type UmlLeg = { peer: { id: string; cardinality: Cardinality }; composition: boolean };

/** Gap between a class and the label of its reflexive Association. */
const REFLEXIVE_GAP = 70;

/**
 * Lays an MCD out the UML way: each binary Association's label sits between its
 * two classes (beside the class when reflexive), so its Legs draw the line
 * through it; each Leg learns its peer's Cardinality. An N-ary Association stays
 * where it is stored, a diamond, each Leg showing its own. Associations with
 * fewer Legs, and their Legs, are left out: drawn as stored rather than wrongly.
 */
export function umlLayout(
	nodes: DiagramNode[],
	edges: DiagramEdge[],
	sizeOf: (node: DiagramNode) => Size
): { associations: Map<string, UmlAssociation>; legs: Map<string, UmlLeg> } {
	const byId = new Map(nodes.map((n) => [n.id, n]));
	const center = (node: DiagramNode) => {
		const size = sizeOf(node);
		return { x: node.x + size.width / 2, y: node.y + size.height / 2 };
	};
	const legsByAssociation = new Map<string, LegEdge[]>();
	for (const edge of edges) {
		if (edge.type !== 'leg') continue;
		legsByAssociation.set(edge.source, [
			...(legsByAssociation.get(edge.source) ?? []),
			edge as LegEdge
		]);
	}
	// Binary Associations only: anything else is drawn as stored rather than wrongly.
	const legsOf = (associationId: string) => {
		const legs = legsByAssociation.get(associationId) ?? [];
		return legs.length === 2 ? legs : [];
	};
	const isNary = (associationId: string) => (legsByAssociation.get(associationId)?.length ?? 0) > 2;

	const associations = new Map<string, UmlAssociation>();
	for (const node of nodes) {
		if (node.type !== 'association') continue;
		if (isNary(node.id)) {
			// The association class goes above the diamond, unless a Leg leaves upwards.
			const here = center(node);
			const upwards = (legsByAssociation.get(node.id) ?? []).some((leg) => {
				const other = byId.get(leg.target);
				if (!other) return false;
				const dx = center(other).x - here.x;
				const dy = center(other).y - here.y;
				return dy < 0 && Math.abs(dy) >= Math.abs(dx);
			});
			associations.set(node.id, { nary: true, side: upwards ? 'right' : 'top' });
			continue;
		}
		const [a, b] = legsOf(node.id).map((leg) => byId.get(leg.target));
		if (!a || !b) continue;
		const label = sizeOf(node);
		const dx = center(b).x - center(a).x;
		const dy = center(b).y - center(a).y;
		const anchor =
			a === b
				? {
						x: center(a).x + sizeOf(a).width / 2 + REFLEXIVE_GAP + label.width / 2,
						y: center(a).y
					}
				: { x: (center(a).x + center(b).x) / 2, y: (center(a).y + center(b).y) / 2 };
		associations.set(node.id, {
			nary: false,
			side: a !== b && Math.abs(dy) > Math.abs(dx) ? 'right' : 'top',
			at: { x: anchor.x - label.width / 2, y: anchor.y - label.height / 2 }
		});
	}

	const legs = new Map<string, UmlLeg>();
	for (const edge of edges) {
		if (edge.type !== 'leg') continue;
		const peer = isNary(edge.source)
			? (edge as LegEdge)
			: legsOf(edge.source).find((leg) => leg.id !== edge.id);
		if (!peer) continue;
		legs.set(edge.id, {
			peer: { id: peer.id, cardinality: peer.cardinality },
			composition: peer.id !== edge.id && peer.relative === true
		});
	}
	return { associations, legs };
}

/** A CIF's Legs that are still its Association's, read as the Entities they join. */
function cifEnds(cif: CifNode, legs: Map<string, DiagramEdge>) {
	const entityOf = (legId: string) => {
		const leg = legs.get(legId);
		return leg && leg.source === cif.association ? leg.target : undefined;
	};
	return {
		determinants: cif.determinants.map(entityOf).filter((e): e is string => e !== undefined),
		determined: entityOf(cif.determined)
	};
}

const legsById = (edges: DiagramEdge[]) =>
	new Map(edges.filter((e) => e.type === 'leg').map((e) => [e.id, e]));

/** A line from a CIF to an Entity: an arrow when that Entity is the determined one. */
export type CifLink = { cif: string; entity: string; determined: boolean };

/**
 * Merise: a line from each CIF to the Entities of its determinant Legs and an
 * arrow to the determined one.
 */
export function cifLinks(nodes: DiagramNode[], edges: DiagramEdge[]): CifLink[] {
	const legs = legsById(edges);
	return nodes
		.filter((n) => n.type === 'cif')
		.flatMap((node) => {
			const { determinants, determined } = cifEnds(node as CifNode, legs);
			return [
				...determinants.map((entity) => ({ cif: node.id, entity, determined: false })),
				...(determined ? [{ cif: node.id, entity: determined, determined: true }] : [])
			];
		});
}

/**
 * UML has no symbol for a CIF: each one is written under its Association's
 * diamond as a constraint, `{a, b → c}`. By Association, in the CIFs' order.
 */
export function cifConstraints(
	nodes: DiagramNode[],
	edges: DiagramEdge[]
): Map<string, { id: string; text: string }[]> {
	const legs = legsById(edges);
	const names = new Map(nodes.map((n) => [n.id, String(n.name ?? '')]));
	const constraints = new Map<string, { id: string; text: string }[]>();
	for (const node of nodes) {
		if (node.type !== 'cif') continue;
		const cif = node as CifNode;
		const { determinants, determined } = cifEnds(cif, legs);
		if (!determined || determinants.length === 0) continue;
		const text = `{${determinants.map((e) => names.get(e)).join(', ')} → ${names.get(determined)}}`;
		constraints.set(cif.association, [
			...(constraints.get(cif.association) ?? []),
			{ id: node.id, text }
		]);
	}
	return constraints;
}

/** A child joined to its parent in UML; `constraint` on the first of its Inheritance only. */
export type Generalization = { isa: string; child: string; parent: string; constraint?: string };

/**
 * UML: no triangle; each child (an `isa` edge's target) joined to its parent by
 * a generalisation, the Inheritance's constraint written on the first one.
 */
export function generalizations(nodes: DiagramNode[], edges: DiagramEdge[]): Generalization[] {
	const inheritances = new Map(
		nodes.filter((n) => n.type === 'inheritance').map((n) => [n.id, n as InheritanceNode])
	);
	const labelled = new Set<string>();
	const drawn: Generalization[] = [];
	for (const edge of edges) {
		const inheritance = edge.type === 'isa' ? inheritances.get(edge.source) : undefined;
		if (!inheritance) continue;
		const first = !labelled.has(inheritance.id);
		labelled.add(inheritance.id);
		drawn.push({
			isa: edge.id,
			child: edge.target,
			parent: inheritance.parent,
			constraint:
				first && inheritance.constraint ? UML_CONSTRAINTS[inheritance.constraint] : undefined
		});
	}
	return drawn;
}

/** Where an edge sits among those joining the same two nodes (a reflexive Association's Legs). */
export type TwinPosition = { twinIndex: number; twinCount: number };

/** Each edge's place among the edges joining the same two nodes, which are drawn apart. */
export function twinPositions(edges: DiagramEdge[]): Map<string, TwinPosition> {
	const key = (e: DiagramEdge) => `${e.source}|${e.target}`;
	const counts = new Map<string, number>();
	for (const e of edges) counts.set(key(e), (counts.get(key(e)) ?? 0) + 1);
	const seen = new Map<string, number>();
	const positions = new Map<string, TwinPosition>();
	for (const e of edges) {
		const twinIndex = seen.get(key(e)) ?? 0;
		seen.set(key(e), twinIndex + 1);
		positions.set(e.id, { twinIndex, twinCount: counts.get(key(e)) ?? 1 });
	}
	return positions;
}

/** Gap between Legs joining the same Association and Entity (a reflexive Association has two). */
const SPREAD = 40;

/**
 * A Leg's line from its Association's box to its Entity's, and where its
 * Cardinality goes, near the Entity. A route stored by a Tidy up is followed
 * (Merise only: in UML the Leg starts at the label); otherwise a curve, twin
 * Legs bending apart around the straight line between the two centers.
 * `through`: the points the line passes that may lie outside both boxes.
 */
export function legLine(
	source: Box,
	target: Box,
	{ points, twinIndex, twinCount }: { points?: Point[] } & TwinPosition,
	uml: boolean
): { path: string; label: Point; through: Point[] } {
	const bends = !uml && points && points.length > 0 ? points : null;
	if (bends) {
		const route = drawnRoute(source, bends, target);
		// The Cardinality sits on the last segment, next to its Entity, as in Looping.
		const [a, b] = route.slice(-2);
		return {
			path: routedPath(route),
			label: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
			through: bends
		};
	}
	const from = center(source);
	const to = center(target);
	const length = Math.hypot(to.x - from.x, to.y - from.y) || 1;
	const offset = (twinIndex - (twinCount - 1) / 2) * SPREAD * 2;
	const control = {
		x: (from.x + to.x) / 2 - ((to.y - from.y) / length) * offset,
		y: (from.y + to.y) / 2 + ((to.x - from.x) / length) * offset
	};
	const start = borderPoint(source, control);
	const end = borderPoint(target, control);
	const at = (t: number) => ({
		x: (1 - t) ** 2 * start.x + 2 * (1 - t) * t * control.x + t ** 2 * end.x,
		y: (1 - t) ** 2 * start.y + 2 * (1 - t) * t * control.y + t ** 2 * end.y
	});
	return {
		path: `M ${start.x},${start.y} Q ${control.x},${control.y} ${end.x},${end.y}`,
		label: at(uml ? 0.82 : 0.7),
		// The curve bows furthest from its ends halfway.
		through: [at(0.5)]
	};
}
