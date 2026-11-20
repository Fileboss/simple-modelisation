import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useCanvas } from '../canvas/canvas-context';
import { EditableText } from '../canvas/EditableText';
import type {
	AssociationNode as AssociationData,
	Attribute,
	EntityNode as EntityData
} from '@simple-modelisation/model/project.ts';
import {
	umlAttribute,
	useNotation,
	type AssociationClassSide,
	type NaryAssociation
} from './notation';

const SIDES = [Position.Top, Position.Right, Position.Bottom, Position.Left];

/**
 * An Entity: in Merise, Looping's style (orange header, yellow body, Identifier
 * underlined); in UML, a class listing `name : Type`.
 */
export function EntityNode({ id, data, selected }: NodeProps) {
	const { project, diagramId } = useCanvas();
	const entity = data as EntityData;
	const isUml = useNotation(diagramId) === 'uml';
	return (
		<div className={`${isUml ? 'uml-class' : 'entity'} ${selected ? 'selected' : ''}`}>
			<EditableText
				className="entity-name"
				value={entity.name}
				onChange={(name) => project.renameNode(diagramId, id, name)}
			/>
			<AttributeList nodeId={id} attributes={entity.attributes} isUml={isUml} />
			{SIDES.map((side) => (
				<Handle key={side} id={side} type="source" position={side} className="handle" />
			))}
		</div>
	);
}

/**
 * An Association: in Merise, Looping's cyan rounded box with its name above its
 * Attributes; in UML, its name on the line between its classes (a diamond with
 * its name under it when N-ary), with its Attributes in an association class
 * joined by a dashed line.
 */
export function AssociationNode({ id, data, selected }: NodeProps) {
	const { project, diagramId } = useCanvas();
	const association = data as AssociationData;
	const isUml = useNotation(diagramId) === 'uml';
	if (isUml && (data as NaryAssociation).umlNary) {
		// The node is the diamond alone: Legs end on its box; name and class hang outside it.
		return (
			<div className={`uml-nary ${selected ? 'selected' : ''}`}>
				<svg className="uml-diamond" viewBox="0 0 44 44" aria-hidden="true">
					<path d="M22 2 L42 22 L22 42 L2 22 Z" />
				</svg>
				<EditableText
					className="uml-nary-name"
					value={association.name}
					onChange={(name) => project.renameNode(diagramId, id, name)}
				/>
				{association.attributes.length > 0 && (
					<div
						className={`uml-association-class uml-side-${(data as AssociationClassSide).umlSide ?? 'top'}`}
					>
						<AttributeList nodeId={id} attributes={association.attributes} isUml />
					</div>
				)}
				<Handle
					type="source"
					position={Position.Top}
					isConnectable={false}
					className="hidden-handle"
				/>
				{SIDES.map((side) => (
					<Handle key={side} id={side} type="source" position={side} className="handle" />
				))}
			</div>
		);
	}
	if (isUml) {
		return (
			<div className={`uml-association ${selected ? 'selected' : ''}`}>
				<EditableText
					className="uml-association-name"
					value={association.name}
					onChange={(name) => project.renameNode(diagramId, id, name)}
				/>
				{association.attributes.length > 0 && (
					<div
						className={`uml-association-class uml-side-${(data as AssociationClassSide).umlSide ?? 'top'}`}
					>
						<AttributeList nodeId={id} attributes={association.attributes} isUml />
					</div>
				)}
				<Handle
					type="source"
					position={Position.Top}
					isConnectable={false}
					className="hidden-handle"
				/>
				{/* Dragged to a class, they add a Leg. */}
				{SIDES.map((side) => (
					<Handle key={side} id={side} type="source" position={side} className="handle" />
				))}
			</div>
		);
	}
	return (
		<div className={`association ${selected ? 'selected' : ''}`}>
			<EditableText
				className="association-name"
				value={association.name}
				onChange={(name) => project.renameNode(diagramId, id, name)}
			/>
			<AttributeList nodeId={id} attributes={association.attributes} isUml={false} />
			{/* React Flow draws an edge only between handles: the first, hidden, anchors the stored Legs. */}
			<Handle
				type="source"
				position={Position.Top}
				isConnectable={false}
				className="hidden-handle"
			/>
			{/* Dragged to an Entity, they add a Leg. */}
			{SIDES.map((side) => (
				<Handle key={side} id={side} type="source" position={side} className="handle" />
			))}
		</div>
	);
}

type AttributeListProps = { nodeId: string; attributes: Attribute[]; isUml: boolean };

function AttributeList({ nodeId, attributes, isUml }: AttributeListProps) {
	const { project, diagramId } = useCanvas();
	return (
		<div className="attributes">
			{attributes.map((attribute) => (
				<EditableText
					key={attribute.id}
					className={!isUml && attribute.identifier ? 'attribute identifier' : 'attribute'}
					value={attribute.name}
					// In UML the line also shows the type; double-click still edits the name.
					display={isUml ? umlAttribute(attribute) : undefined}
					onChange={(name) => project.renameAttribute(diagramId, nodeId, attribute.id, name)}
				/>
			))}
		</div>
	);
}
