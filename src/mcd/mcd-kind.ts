import type { CanvasKind } from '../canvas/DiagramCanvas';
import { LegEdge } from './LegEdge';
import { McdPalette } from './McdPalette';
import { McdPanel } from './McdPanel';
import { SqlPanel } from './SqlPanel';
import { AssociationNode, EntityNode } from './McdNodes';

export const mcdKind: CanvasKind = {
	nodeTypes: { entity: EntityNode, association: AssociationNode },
	edgeTypes: { leg: LegEdge },
	Palette: McdPalette,
	Panel: McdPanel,
	Footer: SqlPanel,
	drop: (project, diagramId, item, x, y) => {
		if (item === 'entity') project.addEntity(diagramId, x, y);
	},
	// Dragging between two Entities (or two dots of one Entity) draws an Association.
	connect: (project, diagramId, source, target) => {
		project.addAssociation(diagramId, source, target);
	}
};
