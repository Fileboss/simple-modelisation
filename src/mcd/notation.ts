import type { Edge, Node } from '@xyflow/react';
import { useSyncExternalStore } from 'react';
import type { DataType } from '@simple-modelisation/model/data-types.ts';
import type { Attribute, Cardinality, LegEdge } from '@simple-modelisation/model/project.ts';
import { strings } from '../ui/strings';

/** How an MCD is drawn; the model is the same. */
export type Notation = 'merise' | 'uml';

// A per-browser preference per MCD, never stored in the Project.
const storageKey = (diagramId: string) => `simple-modelisation:notation:${diagramId}`;
const listeners = new Set<() => void>();
// When storage is blocked, the choice lasts until the page reloads.
const unsaved = new Map<string, Notation>();

export function getNotation(diagramId: string): Notation {
	const kept = unsaved.get(diagramId);
	if (kept) return kept;
	try {
		return localStorage.getItem(storageKey(diagramId)) === 'uml' ? 'uml' : 'merise';
	} catch {
		return 'merise';
	}
}

export function setNotation(diagramId: string, notation: Notation): void {
	try {
		localStorage.setItem(storageKey(diagramId), notation);
		unsaved.delete(diagramId);
	} catch {
		unsaved.set(diagramId, notation);
	}
	for (const listener of listeners) listener();
}

// One subscription for every component; other tabs report their changes through 'storage'.
function subscribe(onChange: () => void): () => void {
	listeners.add(onChange);
	window.addEventListener('storage', onChange);
	return () => {
		listeners.delete(onChange);
		window.removeEventListener('storage', onChange);
	};
}

export function useNotation(diagramId: string): Notation {
	return useSyncExternalStore(subscribe, () => getNotation(diagramId));
}

const MULTIPLICITIES: Record<Cardinality, string> = {
	'0,1': '0..1',
	'1,1': '1',
	'0,n': '0..*',
	'1,n': '1..*'
};

export const umlMultiplicity = (cardinality: Cardinality) => MULTIPLICITIES[cardinality];

export function dataTypeLabel(type: DataType): string {
	const name = strings.dataTypes.kinds[type.kind];
	if (type.kind === 'varchar') return name.replace('(n)', `(${type.length})`);
	if (type.kind === 'decimal') return `${name}(${type.precision},${type.scale})`;
	return name;
}

/** `email : Text(120) [0..1]`, `id : Auto-increment {id}`. */
export function umlAttribute(attribute: Attribute): string {
	const flags = `${attribute.identifier ? ' {id}' : ''}${attribute.optional ? ' [0..1]' : ''}`;
	return `${attribute.name} : ${dataTypeLabel(attribute.type)}${flags}`;
}

/** Where an association class goes: above a horizontal line, beside a vertical one. */
export type AssociationClassSide = { umlSide?: 'top' | 'right' };

/** The other Leg of a Leg's Association: its Cardinality shows at this Leg's end in UML. */
export type PeerLeg = { peer?: { id: string; cardinality: Cardinality } };

const FALLBACK_SIZE = { width: 120, height: 60 };
const size = (node: Node) => ({
	width: node.measured?.width ?? FALLBACK_SIZE.width,
	height: node.measured?.height ?? FALLBACK_SIZE.height
});
const center = (node: Node) => ({
	x: node.position.x + size(node).width / 2,
	y: node.position.y + size(node).height / 2
});

/** Gap between a class and the label of its reflexive Association. */
const REFLEXIVE_GAP = 70;

/**
 * Lays an MCD out the UML way: each Association's label sits between its two
 * classes (beside the class when reflexive) and is not dragged, so its Legs
 * draw the line through it; each Leg learns its peer's Cardinality.
 */
export function umlLayout(nodes: Node[], edges: Edge[]): { nodes: Node[]; edges: Edge[] } {
	const byId = new Map(nodes.map((n) => [n.id, n]));
	const legsByAssociation = new Map<string, Edge[]>();
	for (const edge of edges) {
		if (edge.type !== 'leg') continue;
		legsByAssociation.set(edge.source, [...(legsByAssociation.get(edge.source) ?? []), edge]);
	}
	// Binary Associations only: anything else is drawn as stored rather than wrongly.
	const legsOf = (associationId: string) => {
		const legs = legsByAssociation.get(associationId) ?? [];
		return legs.length === 2 ? legs : [];
	};

	const laidNodes = nodes.map((node) => {
		if (node.type !== 'association') return node;
		const [a, b] = legsOf(node.id).map((leg) => byId.get(leg.target));
		if (!a || !b) return node;
		const label = size(node);
		const dx = center(b).x - center(a).x;
		const dy = center(b).y - center(a).y;
		const umlSide = a !== b && Math.abs(dy) > Math.abs(dx) ? 'right' : 'top';
		const anchor =
			a === b
				? { x: center(a).x + size(a).width / 2 + REFLEXIVE_GAP + label.width / 2, y: center(a).y }
				: { x: (center(a).x + center(b).x) / 2, y: (center(a).y + center(b).y) / 2 };
		return {
			...node,
			data: { ...node.data, umlSide },
			draggable: false,
			position: { x: anchor.x - label.width / 2, y: anchor.y - label.height / 2 }
		};
	});

	const laidEdges = edges.map((edge) => {
		if (edge.type !== 'leg') return edge;
		const peer = legsOf(edge.source).find((leg) => leg.id !== edge.id);
		if (!peer) return edge;
		const cardinality = (peer.data as LegEdge).cardinality;
		return { ...edge, data: { ...edge.data, peer: { id: peer.id, cardinality } } };
	});

	return { nodes: laidNodes, edges: laidEdges };
}
