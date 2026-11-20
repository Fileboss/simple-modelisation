import { useCanvas } from '../canvas/canvas-context';
import type { CanvasKind } from '../canvas/DiagramCanvas';
import { dataType } from '@simple-modelisation/model/data-types.ts';
import { estimatedSize, noteSize } from '@simple-modelisation/model/layout.ts';
import { NoteNode } from '../canvas/NoteNode';
import { NOTE_ITEM } from '../canvas/palette-drag';
import { strings } from '../ui/strings';
import { LegEdge } from './LegEdge';
import { McdPalette } from './McdPalette';
import { McdPanel } from './McdPanel';
import { umlLayout, useNotation } from './notation';
import { withCifConstraints, withCifLinks } from './cif';
import { CifLinkEdge, CifNode } from './CifNode';
import type { Layout } from '../canvas/layout';
import { SqlPanel } from './SqlPanel';
import { AssociationNode, EntityNode } from './McdNodes';

// CIFs as constraint text under the diamond, once umlLayout has marked N-ary Associations.
const umlCifLayout: Layout = (nodes, edges) => {
	const laid = umlLayout(nodes, edges);
	return withCifConstraints(laid.nodes, laid.edges);
};

export const mcdKind: CanvasKind = {
	nodeTypes: { entity: EntityNode, association: AssociationNode, note: NoteNode, cif: CifNode },
	edgeTypes: { leg: LegEdge, cifLink: CifLinkEdge },
	Palette: McdPalette,
	Panel: McdPanel,
	Footer: SqlPanel,
	useLayout: function useMcdLayout() {
		const { diagramId } = useCanvas();
		return useNotation(diagramId) === 'uml' ? umlCifLayout : withCifLinks;
	},
	drop: (project, diagramId, item, x, y) => {
		if (item === NOTE_ITEM) return project.addNote(diagramId, x, y);
		return item === 'entity' ? project.addEntity(diagramId, x, y, strings.mcd.entity) : undefined;
	},
	dropPreview: (item) =>
		item === NOTE_ITEM
			? { ...noteSize(''), label: strings.note.title }
			: {
					// A new Entity: its name and its auto-increment id.
					...estimatedSize({
						id: '',
						type: 'entity',
						x: 0,
						y: 0,
						name: strings.mcd.entity,
						attributes: [
							{ id: '', name: 'id', identifier: true, type: dataType('serial'), optional: false }
						]
					}),
					label: strings.mcd.entity
				},
	// Entity to Entity (or two dots of one Entity) makes an Association; an Association and an
	// Entity, a Leg (N-ary from three); anything else joins nothing.
	connect: (project, diagramId, source, target) => {
		const [from, to] = [project.nodeType(diagramId, source), project.nodeType(diagramId, target)];
		if (from === 'entity' && to === 'entity') project.addAssociation(diagramId, source, target);
		else if (from === 'association' && to === 'entity') project.addLeg(diagramId, source, target);
		else if (from === 'entity' && to === 'association') project.addLeg(diagramId, target, source);
	}
};
