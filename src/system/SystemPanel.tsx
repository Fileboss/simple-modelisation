import { useCanvas } from '../canvas/canvas-context';
import type { Selection } from '../canvas/DiagramCanvas';
import { PanelField } from '../canvas/PanelField';
import type {
	ComponentNode,
	ConnectionEdge,
	ZoneNode
} from '@simple-modelisation/model/project.ts';
import { strings } from '../ui/strings';
import { componentTypeInfo, findSkin } from './catalog';
import { GenericIcon, SkinLogo } from './ComponentIcon';
import { HostingPicker } from './HostingPicker';

export function SystemPanel({ selection }: { selection: Selection }) {
	const { project, diagramId } = useCanvas();

	if (selection.node?.type === 'component') {
		const component = selection.node as ComponentNode;
		const info = componentTypeInfo(component.componentType);
		const current = findSkin(component.componentType, component.skin);
		const choose = (skin: string | null) => {
			project.stopCapturing();
			project.setSkin(diagramId, component.id, skin);
		};
		return (
			<>
				<h2>{info.label}</h2>
				<PanelField
					label={strings.panel.name}
					value={component.name}
					onChange={(name) => project.renameNode(diagramId, component.id, name)}
				/>
				<h3>{strings.hosting.title}</h3>
				<HostingPicker labelled componentId={component.id} current={component.hosting} />
				<h3>{strings.system.skin}</h3>
				<div className="skin-grid">
					<button className={`skin ${current ? '' : 'skin-current'}`} onClick={() => choose(null)}>
						<GenericIcon type={info.type} color={info.color} />
						{strings.system.generic}
					</button>
					{info.skins.map((skin) => (
						<button
							key={skin.id}
							className={`skin ${current?.id === skin.id ? 'skin-current' : ''}`}
							onClick={() => choose(skin.id)}
						>
							<SkinLogo skin={skin} />
							{skin.name}
						</button>
					))}
				</div>
			</>
		);
	}

	if (selection.node?.type === 'zone') {
		const zone = selection.node as ZoneNode;
		return (
			<>
				<h2>{strings.system.zone}</h2>
				<PanelField
					label={strings.panel.name}
					value={zone.name}
					onChange={(name) => project.renameNode(diagramId, zone.id, name)}
				/>
				<p className="panel-hint">{strings.system.zoneHint}</p>
			</>
		);
	}

	if (selection.edge?.type === 'connection') {
		const connection = selection.edge as ConnectionEdge;
		return (
			<>
				<h2>{strings.system.connection}</h2>
				<PanelField
					label={strings.panel.label}
					value={connection.label}
					placeholder="HTTP, gRPC…"
					allowBlank
					onChange={(label) => project.setEdgeLabel(diagramId, connection.id, label)}
				/>
			</>
		);
	}

	return <p className="panel-hint">{strings.system.panelHint}</p>;
}
