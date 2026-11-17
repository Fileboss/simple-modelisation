import type { CanvasKind } from '../canvas/DiagramCanvas';
import type { ComponentType } from '@simple-modelisation/model/project.ts';
import { componentTypeInfo, ZONE_ITEM } from './catalog';
import { ComponentNode } from './ComponentNode';
import { ConnectionEdge } from './ConnectionEdge';
import { placeConnectionLabels } from './label-placement';
import { SystemPalette } from './SystemPalette';
import { SystemPanel } from './SystemPanel';
import { ZoneNode } from './ZoneNode';

export const systemKind: CanvasKind = {
	nodeTypes: { component: ComponentNode, zone: ZoneNode },
	edgeTypes: { connection: ConnectionEdge },
	Palette: SystemPalette,
	Panel: SystemPanel,
	// Connection labels are placed together, so that none overlaps another or a box.
	useLayout: () => placeConnectionLabels,
	drop: (project, diagramId, item, x, y) => {
		if (item === ZONE_ITEM) {
			project.addZone(diagramId, x, y);
			return;
		}
		const type = item as ComponentType;
		project.addComponent(diagramId, type, componentTypeInfo(type).label, x, y);
	},
	connect: (project, diagramId, source, target) => {
		project.addConnection(diagramId, source, target);
	}
};
