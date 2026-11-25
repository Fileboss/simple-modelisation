import { useCanvas } from '../canvas/canvas-context';
import type { CanvasKind } from '../canvas/DiagramCanvas';
import { dataType } from '@simple-modelisation/model/data-types.ts';
import { estimatedSize, noteSize } from '@simple-modelisation/model/layout.ts';
import { NoteNode } from '../canvas/NoteNode';
import { AREA_ITEM, NOTE_ITEM } from '../canvas/palette-drag';
import { AREA_DEFAULT } from '@simple-modelisation/model/project.ts';
import { AreaNode } from './AreaNode';
import { strings } from '../ui/strings';
import { LegEdge } from './LegEdge';
import { McdPalette } from './McdPalette';
import { McdPanel } from './McdPanel';
import { getNotation, getTypesShown, umlLayout, useNotation } from './notation';
import { mcdSvg } from '@simple-modelisation/model/svg/mcd.ts';
import { SVG_NAMES } from '../canvas/svg-names';
import { withCifConstraints, withCifLinks } from './cif';
import { CifLinkEdge, CifNode } from './CifNode';
import { withGeneralizations, withInheritanceLines } from './inheritance';
import { GeneralizationEdge, InheritanceNode, IsaEdge } from './InheritanceNode';
import type { Layout } from '../canvas/layout';
import { SqlPanel } from './SqlPanel';
import { AssociationNode, EntityNode } from './McdNodes';

/** Applies layouts one after the other. */
const chain =
	(...layouts: Layout[]): Layout =>
	(nodes, edges) =>
		layouts.reduce((laid, layout) => layout(laid.nodes, laid.edges), { nodes, edges });

const meriseLayout = chain(withCifLinks, withInheritanceLines);
// CIFs as constraint text under the diamond, once umlLayout has marked N-ary Associations.
const umlMcdLayout = chain(umlLayout, withCifConstraints, withGeneralizations);

export const mcdKind: CanvasKind = {
	nodeTypes: {
		entity: EntityNode,
		association: AssociationNode,
		note: NoteNode,
		area: AreaNode,
		cif: CifNode,
		inheritance: InheritanceNode
	},
	edgeTypes: {
		leg: LegEdge,
		cifLink: CifLinkEdge,
		isa: IsaEdge,
		generalization: GeneralizationEdge
	},
	Palette: McdPalette,
	Panel: McdPanel,
	Footer: SqlPanel,
	footerLabel: strings.sql.title,
	useLayout: function useMcdLayout() {
		const { diagramId } = useCanvas();
		return useNotation(diagramId) === 'uml' ? umlMcdLayout : meriseLayout;
	},
	// In the Notation and with the types shown in this browser: the image is what one sees.
	drawSvg: (diagramId, nodes, edges, measured) =>
		mcdSvg(nodes, edges, {
			notation: getNotation(diagramId),
			types: getTypesShown(diagramId),
			names: SVG_NAMES,
			measured
		}),
	drop: (project, diagramId, item, x, y) => {
		if (item === NOTE_ITEM) return project.addNote(diagramId, x, y);
		if (item === AREA_ITEM) {
			return project.addArea(diagramId, { x, y, ...AREA_DEFAULT }, strings.area.title);
		}
		return item === 'entity' ? project.addEntity(diagramId, x, y, strings.mcd.entity) : undefined;
	},
	dropPreview: (item) => {
		if (item === AREA_ITEM) return { ...AREA_DEFAULT, label: strings.area.title };
		return item === NOTE_ITEM
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
				};
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
