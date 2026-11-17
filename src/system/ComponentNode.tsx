import { Handle, NodeToolbar, Position, useStore, type NodeProps } from '@xyflow/react';
import { useCanvas } from '../canvas/canvas-context';
import { EditableText } from '../canvas/EditableText';
import type { ComponentNode as ComponentData } from '@simple-modelisation/model/project.ts';
import { strings } from '../ui/strings';
import { componentTypeInfo, findSkin } from './catalog';
import { GenericIcon, SkinLogo } from './ComponentIcon';
import { hostingLook } from './hosting-catalog';
import { HostingIcon } from './HostingIcon';
import { HostingPicker } from './HostingPicker';

const SIDES = [Position.Top, Position.Right, Position.Bottom, Position.Left];

export function ComponentNode({ id, data, selected }: NodeProps) {
	const { project, diagramId } = useCanvas();
	const component = data as ComponentData;
	const info = componentTypeInfo(component.componentType);
	const skin = findSkin(component.componentType, component.skin);
	const color = skin?.color ?? info.color;
	const kind = skin?.name ?? info.label;
	const hosting = hostingLook(component.hosting);
	const selectedCount = useStore((state) => {
		let count = 0;
		for (const node of state.nodeLookup.values()) if (node.selected) count++;
		return count;
	});

	return (
		<div className={`component ${selected ? 'selected' : ''}`} style={{ borderColor: color }}>
			{skin ? (
				<SkinLogo skin={skin} />
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
			{hosting && (
				<span
					className="hosting-badge"
					role="img"
					aria-label={`${strings.hosting.title}: ${hosting.label}`}
					title={`${strings.hosting.title}: ${hosting.label}`}
				>
					<HostingIcon look={hosting} />
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
