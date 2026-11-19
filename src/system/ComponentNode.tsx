import { Handle, NodeToolbar, Position, useStore, type NodeProps } from '@xyflow/react';
import type { ReactNode } from 'react';
import { useCanvas } from '../canvas/canvas-context';
import { inheritedProvider } from './inherited-provider';
import { EditableText } from '../canvas/EditableText';
import type { ComponentNode as ComponentData } from '@simple-modelisation/model/project.ts';
import { strings } from '../ui/strings';
import { componentTypeInfo, findRuntime, findSkin } from './catalog';
import { isPerson } from '@simple-modelisation/model/component-types.ts';
import { GenericIcon, LineGlyph, SkinLogo } from './ComponentIcon';
import { hostingLook } from './hosting-catalog';
import { HostingIcon } from './HostingIcon';
import { HostingPicker } from './HostingPicker';
import { providerLook } from './provider-catalog';
import { LogoBadge, ProviderIcon } from './ProviderIcon';

const SIDES = [Position.Top, Position.Right, Position.Bottom, Position.Left];

export function ComponentNode(props: NodeProps) {
	// Someone, not software: a silhouette rather than a box.
	return isPerson((props.data as ComponentData).componentType) ? (
		<PersonNode {...props} />
	) : (
		<SoftwareNode {...props} />
	);
}

/** A Person: a round avatar in its role's color, its name and role under it; no badges. */
function PersonNode({ id, data, selected }: NodeProps) {
	const { project, diagramId } = useCanvas();
	const person = data as ComponentData;
	const info = componentTypeInfo(person.componentType);
	const role = findSkin(person.componentType, person.skin);
	const color = role?.color ?? info.color;
	const kind = role?.name ?? info.label;
	return (
		<div className={`person ${selected ? 'selected' : ''}`}>
			<span className="person-avatar" style={{ background: color }} aria-hidden="true">
				<LineGlyph path={role?.glyph ?? info.glyph} color="#fff" size={26} />
			</span>
			<EditableText
				className="component-name"
				value={person.name}
				onChange={(name) => project.renameNode(diagramId, id, name)}
			/>
			{kind !== person.name && (
				<span className="component-kind" style={{ color }}>
					{kind}
				</span>
			)}
			{SIDES.map((side) => (
				<Handle key={side} id={side} type="source" position={side} className="handle" />
			))}
		</div>
	);
}

function SoftwareNode({ id, data, selected }: NodeProps) {
	const { project, diagramId } = useCanvas();
	const component = data as ComponentData;
	const info = componentTypeInfo(component.componentType);
	const skin = findSkin(component.componentType, component.skin);
	const runtime =
		component.componentType === 'service' ? findRuntime(component.runtime) : undefined;
	// The Skin's logo, else the Runtime's: a Runtime beside a Skin is a badge.
	const look = skin ?? runtime;
	const color = look?.color ?? info.color;
	// A Disk shows its kind (SSD…) where other Components show their Skin.
	const diskKind = component.componentType === 'disk' ? component.diskKind : undefined;
	const kind = look?.name ?? (diskKind && strings.disk.names[diskKind]) ?? info.label;
	const runtimeBadge = skin && runtime;
	const hosting = hostingLook(component.hosting);
	// An External service is its own provider: a Provider set before stays stored, unshown.
	const inherited = inheritedProvider(component);
	const provider =
		component.hosting === 'external'
			? undefined
			: providerLook(component.provider ?? inherited?.provider);
	const providerTitle =
		provider &&
		`${strings.provider.title}: ${provider.label}` +
			(!component.provider && inherited ? ` (${strings.provider.from(inherited.zone)})` : '');
	const selectedCount = useStore((state) => {
		let count = 0;
		for (const node of state.nodeLookup.values()) if (node.selected) count++;
		return count;
	});

	return (
		<div className={`component ${selected ? 'selected' : ''}`} style={{ borderColor: color }}>
			{look ? (
				<SkinLogo skin={look} />
			) : (
				<GenericIcon type={component.componentType} color={color} />
			)}
			<div className="component-text">
				<EditableText
					className="component-name"
					value={component.name}
					onChange={(name) => project.renameNode(diagramId, id, name)}
				/>
				{kind !== component.name && (
					<span className="component-kind" style={{ color }}>
						{kind}
					</span>
				)}
			</div>
			{(runtimeBadge || provider || hosting) && (
				// Read together, left to right: on what, at whom, then how it runs.
				<span className="component-badges">
					{runtimeBadge && (
						<Badge title={`${strings.runtime.title}: ${runtimeBadge.name}`}>
							<LogoBadge color={runtimeBadge.color} path={runtimeBadge.logo} />
						</Badge>
					)}
					{provider && (
						<Badge title={providerTitle!}>
							<ProviderIcon look={provider} />
						</Badge>
					)}
					{hosting && (
						<Badge title={`${strings.hosting.title}: ${hosting.label}`}>
							<HostingIcon look={hosting} />
						</Badge>
					)}
				</span>
			)}
			{/* Only for a single selection: the picker changes this one Component. */}
			<NodeToolbar isVisible={selected && selectedCount === 1} position={Position.Top} offset={10}>
				<HostingPicker componentId={id} current={component.hosting} />
			</NodeToolbar>
			{SIDES.map((side) => (
				<Handle key={side} id={side} type="source" position={side} className="handle" />
			))}
		</div>
	);
}

/** A round badge in the Component's corner, named on hover and for screen readers. */
function Badge({ title, children }: { title: string; children: ReactNode }) {
	return (
		<span className="component-badge" role="img" aria-label={title} title={title}>
			{children}
		</span>
	);
}
