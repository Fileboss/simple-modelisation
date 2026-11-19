import type { CanvasKind } from '../canvas/DiagramCanvas';
import type { ComponentType } from '@simple-modelisation/model/project.ts';
import { componentTypeInfo, ZONE_ITEM } from './catalog';
import { ComponentNode } from './ComponentNode';
import { ConnectionEdge } from './ConnectionEdge';
import { withInheritedProviders } from './inherited-provider';
import { systemSvg } from '@simple-modelisation/model/svg/system.ts';
import { strings } from '../ui/strings';
import { measureInPage, placeConnectionLabels } from './label-placement';
import { SystemPalette } from './SystemPalette';
import { SystemPanel } from './SystemPanel';
import { ZoneNode } from './ZoneNode';

// The names the image prints, from the UI strings.
export const SVG_NAMES = {
	types: strings.types,
	diskKinds: strings.disk.names,
	hostings: strings.hosting.names,
	providers: strings.provider.names,
	titles: { hosting: strings.hosting.title, provider: strings.provider.title }
};

export const systemKind: CanvasKind = {
	nodeTypes: { component: ComponentNode, zone: ZoneNode },
	edgeTypes: { connection: ConnectionEdge },
	Palette: SystemPalette,
	Panel: SystemPanel,
	// Connection labels are placed together, so that none overlaps another or a box.
	useLayout: () => placeConnectionLabels,
	derive: withInheritedProviders,
	drawSvg: (nodes, edges, sizeOf) =>
		systemSvg(nodes, edges, { names: SVG_NAMES, sizeOf, measure: measureInPage }),
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
