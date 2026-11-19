import { useCanvas } from '../canvas/canvas-context';
import type { Selection } from '../canvas/DiagramCanvas';
import { inheritedProvider } from './inherited-provider';
import { PanelField } from '../canvas/PanelField';
import { DISK_KINDS, FLOWS } from '@simple-modelisation/model/project.ts';
import { FLOW_COLORS } from '@simple-modelisation/model/looks.ts';
import type {
	ComponentNode,
	ComponentType,
	ConnectionEdge,
	Runtime,
	ZoneNode
} from '@simple-modelisation/model/project.ts';
import { strings } from '../ui/strings';
import {
	COMPONENT_TYPES,
	componentTypeInfo,
	findRuntime,
	findSkin,
	RECOMMENDED_RUNTIMES,
	recommendedSkins,
	RUNTIME_CHOICES
} from './catalog';
import { ChoiceGrid } from './ChoiceGrid';
import { GenericIcon, SkinLogo } from './ComponentIcon';
import { ChoiceRow } from './ChoiceRow';
import { HostingPicker } from './HostingPicker';
import { ProviderPicker } from './ProviderPicker';

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
				<label className="panel-field">
					<span>{strings.panel.type}</span>
					<select
						value={component.componentType}
						onChange={(e) => {
							project.stopCapturing();
							project.setComponentType(diagramId, component.id, e.target.value as ComponentType);
						}}
					>
						{COMPONENT_TYPES.map((t) => (
							<option key={t.type} value={t.type}>
								{t.label}
							</option>
						))}
					</select>
				</label>
				{/* Only a Service has a Runtime: what runs its code on the server. */}
				{component.componentType === 'service' && (
					<>
						<h3>{strings.runtime.title}</h3>
						<p className="panel-hint">{strings.runtime.hint}</p>
						<ChoiceGrid
							key={`${component.id}:runtime`}
							none={{
								label: strings.runtime.unset,
								icon: <GenericIcon type={info.type} color={info.color} />
							}}
							choices={RUNTIME_CHOICES.map((runtime) => ({
								id: runtime.id,
								label: runtime.name,
								icon: <SkinLogo skin={runtime} />
							}))}
							recommended={RECOMMENDED_RUNTIMES}
							current={findRuntime(component.runtime)?.id}
							onChoose={(runtime) => {
								project.stopCapturing();
								project.setRuntime(diagramId, component.id, runtime as Runtime | null);
							}}
						/>
					</>
				)}
				<h3>{strings.hosting.title}</h3>
				<HostingPicker labelled componentId={component.id} current={component.hosting} />
				{/* An External service is its own provider. */}
				{component.hosting !== 'external' && (
					<>
						<h3>{strings.provider.title}</h3>
						<ProviderPicker
							key={component.id}
							nodeId={component.id}
							current={component.provider}
							inherited={inheritedProvider(component)}
						/>
					</>
				)}
				{component.componentType === 'disk' && (
					<>
						<h3>{strings.disk.title}</h3>
						<ChoiceRow
							label={strings.disk.title}
							unset={strings.disk.unset}
							choices={DISK_KINDS.map((kind) => ({ value: kind, label: strings.disk.names[kind] }))}
							current={component.diskKind}
							onChoose={(kind) => {
								project.stopCapturing();
								project.setDiskKind(diagramId, component.id, kind);
							}}
						/>
					</>
				)}
				{/* Disks have no Skins: their kind is not a product. */}
				{info.skins.length > 0 && (
					<>
						<h3>{strings.system.skin}</h3>
						{/* Keyed by Component and type: each list starts folded, without search. */}
						<ChoiceGrid
							key={`${component.id}:${info.type}`}
							none={{
								label: strings.system.generic,
								icon: <GenericIcon type={info.type} color={info.color} />
							}}
							choices={info.skins.map((skin) => ({
								id: skin.id,
								label: skin.name,
								icon: <SkinLogo skin={skin} />,
								group: skin.group
							}))}
							recommended={recommendedSkins(info.type)}
							current={current?.id}
							onChoose={choose}
						/>
					</>
				)}
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
				<h3>{strings.provider.title}</h3>
				<p className="panel-hint">{strings.provider.zoneHint}</p>
				<ProviderPicker
					key={zone.id}
					nodeId={zone.id}
					current={zone.provider}
					inherited={inheritedProvider(zone)}
				/>
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
				<h3>{strings.flow.title}</h3>
				<p className="panel-hint">{strings.flow.hint}</p>
				<ChoiceRow
					label={strings.flow.title}
					unset={strings.flow.unset}
					choices={FLOWS.map((flow) => ({
						value: flow,
						label: strings.flow.names[flow],
						color: FLOW_COLORS[flow]
					}))}
					current={connection.flow}
					onChoose={(flow) => {
						project.stopCapturing();
						project.setConnectionFlow(diagramId, connection.id, flow);
					}}
				/>
			</>
		);
	}

	return <p className="panel-hint">{strings.system.panelHint}</p>;
}
