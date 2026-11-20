import type { CanvasKind } from '../canvas/DiagramCanvas';
import { ZONE_DEFAULT, type ComponentType } from '@simple-modelisation/model/project.ts';
import { estimatedSize, noteSize } from '@simple-modelisation/model/layout.ts';
import { NoteNode } from '../canvas/NoteNode';
import { NOTE_ITEM } from '../canvas/palette-drag';
import { componentTypeInfo, ZONE_ITEM } from './catalog';
import { ComponentNode } from './ComponentNode';
import { ConnectionEdge } from './ConnectionEdge';
import { withInheritedProviders } from './inherited-provider';
import { systemSvg } from '@simple-modelisation/model/svg/system.ts';
import { strings } from '../ui/strings';
import { measureInPage, placeConnectionLabels } from './label-placement';
import { SystemPalette } from './SystemPalette';
import { SystemPanel } from './SystemPanel';
import { SVG_NAMES } from '../canvas/svg-names';
import { ZoneNode } from './ZoneNode';

export const systemKind: CanvasKind = {
	nodeTypes: { component: ComponentNode, zone: ZoneNode, note: NoteNode },
	edgeTypes: { connection: ConnectionEdge },
	Palette: SystemPalette,
	Panel: SystemPanel,
	// Connection labels are placed together, so that none overlaps another or a box.
	useLayout: () => placeConnectionLabels,
	derive: withInheritedProviders,
	drawSvg: (_diagramId, nodes, edges, measured, legend) =>
		systemSvg(nodes, edges, {
			names: SVG_NAMES,
			sizeOf: (node) => measured(node) ?? estimatedSize(node),
			measure: measureInPage,
			legend
		}),
	dropPreview: (item) => {
		if (item === ZONE_ITEM) return { ...ZONE_DEFAULT, label: strings.system.zone };
		if (item === NOTE_ITEM) return { ...noteSize(''), label: strings.note.title };
		const type = item as ComponentType;
		const label = componentTypeInfo(type).label;
		const size = estimatedSize({ id: '', type: 'component', x: 0, y: 0, name: label, skin: null });
		return { ...size, label };
	},
	drop: (project, diagramId, item, x, y) => {
		if (item === NOTE_ITEM) return project.addNote(diagramId, x, y);
		if (item === ZONE_ITEM) {
			return project.addZone(diagramId, x, y);
		}
		const type = item as ComponentType;
		return project.addComponent(diagramId, type, componentTypeInfo(type).label, x, y);
	},
	connect: (project, diagramId, source, target) => {
		project.addConnection(diagramId, source, target);
	}
};
