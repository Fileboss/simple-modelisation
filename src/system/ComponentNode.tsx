import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useCanvas } from '../canvas/canvas-context';
import { EditableText } from '../canvas/EditableText';
import type { ComponentNode as ComponentData } from '../document/project';
import { componentTypeInfo, findSkin } from './catalog';
import { GenericIcon, SkinLogo } from './ComponentIcon';

const SIDES = [Position.Top, Position.Right, Position.Bottom, Position.Left];

export function ComponentNode({ id, data, selected }: NodeProps) {
	const { project, diagramId } = useCanvas();
	const component = data as ComponentData;
	const info = componentTypeInfo(component.componentType);
	const skin = findSkin(component.componentType, component.skin);
	const color = skin?.color ?? info.color;
	const kind = skin?.name ?? info.label;

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
			{SIDES.map((side) => (
				<Handle key={side} id={side} type="source" position={side} className="handle" />
			))}
		</div>
	);
}
