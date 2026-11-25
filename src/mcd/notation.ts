import type { Edge, Node } from '@xyflow/react';
import type { DataType } from '@simple-modelisation/model/data-types.ts';
import * as drawing from '@simple-modelisation/model/mcd-drawing.ts';
import type { Notation } from '@simple-modelisation/model/mcd-drawing.ts';
import type { Attribute, Cardinality } from '@simple-modelisation/model/project.ts';
import { diagramEdges, diagramNodes } from '../canvas/layout';
import { diagramPreference } from '../ui/diagram-preference';
import { strings } from '../ui/strings';

export type { Notation };
export { umlMultiplicity } from '@simple-modelisation/model/mcd-drawing.ts';

const notationChoice = diagramPreference<Notation>('notation', ['merise', 'uml']);
export const getNotation = notationChoice.get;
export const setNotation = notationChoice.set;
export const useNotation = notationChoice.use;

// Whether Merise shows each Attribute's PostgreSQL type.
const typesChoice = diagramPreference('types', ['hidden', 'shown']);
export const getTypesShown = (diagramId: string) => typesChoice.get(diagramId) === 'shown';
export const setTypesShown = (diagramId: string, shown: boolean) =>
	typesChoice.set(diagramId, shown ? 'shown' : 'hidden');
export const useTypesShown = (diagramId: string) => typesChoice.use(diagramId) === 'shown';

export const dataTypeLabel = (type: DataType) =>
	drawing.dataTypeLabel(type, strings.dataTypes.kinds);

/** `email : Text(120) [0..1]`, `id : Auto-increment {id}`. */
export const umlAttribute = (attribute: Attribute) =>
	drawing.umlAttribute(attribute, strings.dataTypes.kinds);

/** Where an association class goes: above a horizontal line, beside a vertical one. */
export type AssociationClassSide = { umlSide?: 'top' | 'right' };

/** Set on an N-ary Association in UML: drawn as a diamond where it is stored. */
export type NaryAssociation = { umlNary?: boolean };

/**
 * The Leg whose Cardinality shows at this Leg's class end in UML: the other Leg
 * of a binary Association, the Leg itself on an N-ary one.
 */
export type PeerLeg = {
	peer?: { id: string; cardinality: Cardinality };
	/** UML composition: the other Leg's Entity is identified relative to this one's, drawn as a filled diamond here. */
	composition?: boolean;
};

const FALLBACK_SIZE = { width: 120, height: 60 };

/**
 * The canvas side of the model's UML layout: a binary Association's label moves
 * between its classes and is not dragged, an N-ary one is marked as a diamond,
 * each Leg learns its peer.
 */
export function umlLayout(nodes: Node[], edges: Edge[]): { nodes: Node[]; edges: Edge[] } {
	const measured = new Map(nodes.map((n) => [n.id, n.measured]));
	const { associations, legs } = drawing.umlLayout(
		diagramNodes(nodes),
		diagramEdges(edges),
		(node) => ({
			width: measured.get(node.id)?.width ?? FALLBACK_SIZE.width,
			height: measured.get(node.id)?.height ?? FALLBACK_SIZE.height
		})
	);
	return {
		nodes: nodes.map((node) => {
			const uml = associations.get(node.id);
			if (!uml) return node;
			if (uml.nary) return { ...node, data: { ...node.data, umlNary: true, umlSide: uml.side } };
			return {
				...node,
				data: { ...node.data, umlSide: uml.side },
				draggable: false,
				position: uml.at!
			};
		}),
		edges: edges.map((edge) => {
			const leg = legs.get(edge.id);
			if (!leg) return edge;
			return {
				...edge,
				data: {
					...edge.data,
					peer: leg.peer,
					...(leg.composition && { composition: true })
				}
			};
		})
	};
}
