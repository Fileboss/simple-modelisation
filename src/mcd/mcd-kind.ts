import { useCanvas } from '../canvas/canvas-context';
import type { CanvasKind } from '../canvas/DiagramCanvas';
import { asStored } from '../canvas/layout';
import { dataType } from '@simple-modelisation/model/data-types.ts';
import { estimatedSize, noteSize } from '@simple-modelisation/model/layout.ts';
import { NoteNode } from '../canvas/NoteNode';
import { NOTE_ITEM } from '../canvas/palette-drag';
import { strings } from '../ui/strings';
import { LegEdge } from './LegEdge';
import { McdPalette } from './McdPalette';
import { McdPanel } from './McdPanel';
import { umlLayout, useNotation } from './notation';
import { SqlPanel } from './SqlPanel';
import { AssociationNode, EntityNode } from './McdNodes';

export const mcdKind: CanvasKind = {
	nodeTypes: { entity: EntityNode, association: AssociationNode, note: NoteNode },
	edgeTypes: { leg: LegEdge },
	Palette: McdPalette,
	Panel: McdPanel,
	Footer: SqlPanel,
	useLayout: function useMcdLayout() {
		const { diagramId } = useCanvas();
		return useNotation(diagramId) === 'uml' ? umlLayout : asStored;
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
	// Dragging between two Entities (or two dots of one Entity) draws an Association.
	connect: (project, diagramId, source, target) => {
		project.addAssociation(diagramId, source, target);
	}
};
