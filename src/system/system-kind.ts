import type { CanvasKind } from '../canvas/DiagramCanvas';
import { asStored } from '../canvas/layout';
import type { ComponentType } from '@simple-modelisation/model/project.ts';
import { componentTypeInfo } from './catalog';
import { ComponentNode } from './ComponentNode';
import { ConnectionEdge } from './ConnectionEdge';
import { SystemPalette } from './SystemPalette';
import { SystemPanel } from './SystemPanel';

export const systemKind: CanvasKind = {
	nodeTypes: { component: ComponentNode },
	edgeTypes: { connection: ConnectionEdge },
	Palette: SystemPalette,
	Panel: SystemPanel,
	useLayout: () => asStored,
	drop: (project, diagramId, item, x, y) => {
		const type = item as ComponentType;
		project.addComponent(diagramId, type, componentTypeInfo(type).label, x, y);
	},
	connect: (project, diagramId, source, target) => {
		project.addConnection(diagramId, source, target);
	}
};
