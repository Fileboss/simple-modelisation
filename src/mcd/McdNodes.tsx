import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useCanvas } from '../canvas/canvas-context';
import { EditableText } from '../canvas/EditableText';
import type {
	AssociationNode as AssociationData,
	Attribute,
	EntityNode as EntityData
} from '../document/project';

const SIDES = [Position.Top, Position.Right, Position.Bottom, Position.Left];

/** An Entity in Looping's style: orange header, yellow body, Identifier underlined. */
export function EntityNode({ id, data, selected }: NodeProps) {
	const { project, diagramId } = useCanvas();
	const entity = data as EntityData;
	return (
		<div className={`entity ${selected ? 'selected' : ''}`}>
			<EditableText
				className="entity-name"
				value={entity.name}
				onChange={(name) => project.renameNode(diagramId, id, name)}
			/>
			<AttributeList nodeId={id} attributes={entity.attributes} />
			{SIDES.map((side) => (
				<Handle key={side} id={side} type="source" position={side} className="handle" />
			))}
		</div>
	);
}

/** An Association in Looping's style: a cyan rounded box with its name above its Attributes. */
export function AssociationNode({ id, data, selected }: NodeProps) {
	const { project, diagramId } = useCanvas();
	const association = data as AssociationData;
	return (
		<div className={`association ${selected ? 'selected' : ''}`}>
			<EditableText
				className="association-name"
				value={association.name}
				onChange={(name) => project.renameNode(diagramId, id, name)}
			/>
			<AttributeList nodeId={id} attributes={association.attributes} />
			{/* React Flow draws an edge only between handles; Legs are created by the tool, not from here. */}
			<Handle
				type="source"
				position={Position.Top}
				isConnectable={false}
				className="hidden-handle"
			/>
		</div>
	);
}

function AttributeList({ nodeId, attributes }: { nodeId: string; attributes: Attribute[] }) {
	const { project, diagramId } = useCanvas();
	return (
		<div className="attributes">
			{attributes.map((attribute) => (
				<EditableText
					key={attribute.id}
					className={attribute.identifier ? 'attribute identifier' : 'attribute'}
					value={attribute.name}
					onChange={(name) => project.renameAttribute(diagramId, nodeId, attribute.id, name)}
				/>
			))}
		</div>
	);
}
