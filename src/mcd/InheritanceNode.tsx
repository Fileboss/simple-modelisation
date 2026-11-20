import {
	BaseEdge,
	EdgeLabelRenderer,
	Handle,
	Position,
	useInternalNode,
	type EdgeProps,
	type NodeProps
} from '@xyflow/react';
import type { InheritanceNode as InheritanceData } from '@simple-modelisation/model/project.ts';
import { borderPoint, boxOf, center } from '../canvas/geometry';
import type { Generalization } from './inheritance';

/** An Inheritance, as in Looping: a triangle under the parent, its constraint inside. */
export function InheritanceNode({ data, selected }: NodeProps) {
	const { constraint } = data as InheritanceData;
	return (
		<div className={`inheritance ${selected ? 'selected' : ''}`}>
			<svg viewBox="0 0 56 40" aria-hidden="true">
				<path d="M28 2 L54 38 L2 38 Z" />
			</svg>
			{constraint && <span className="inheritance-constraint">{constraint}</span>}
			{/* React Flow draws an edge only between handles: the lines start here. */}
			<Handle
				type="source"
				position={Position.Top}
				isConnectable={false}
				className="hidden-handle"
			/>
		</div>
	);
}

/** A straight line between two boxes, border to border. */
function useStraightLine(source: string, target: string) {
	const sourceNode = useInternalNode(source);
	const targetNode = useInternalNode(target);
	if (!sourceNode || !targetNode) return null;
	const from = boxOf(sourceNode);
	const to = boxOf(targetNode);
	return { start: borderPoint(from, center(to)), end: borderPoint(to, center(from)) };
}

/** An Inheritance's line to a child (stored, selectable: deleting it frees the child) or to its parent. */
export function IsaEdge({ id, source, target, selected }: EdgeProps) {
	const line = useStraightLine(source, target);
	if (!line) return null;
	return (
		<BaseEdge
			id={id}
			path={`M ${line.start.x},${line.start.y} L ${line.end.x},${line.end.y}`}
			style={{ stroke: selected ? 'var(--accent)' : '#1d1b22', strokeWidth: 1.2 }}
		/>
	);
}

/** UML: from a child to its parent, a hollow triangle at the parent, the constraint beside it. */
export function GeneralizationEdge({ id, source, target, data }: EdgeProps) {
	const line = useStraightLine(source, target);
	if (!line) return null;
	const marker = `generalization-${id}`;
	const { constraint } = data as Generalization;
	return (
		<>
			<defs>
				<marker
					id={marker}
					viewBox="0 0 12 12"
					refX="12"
					refY="6"
					markerWidth="14"
					markerHeight="14"
					markerUnits="userSpaceOnUse"
					orient="auto"
				>
					<path className="generalization-arrow" d="M 0 0 L 12 6 L 0 12 z" />
				</marker>
			</defs>
			<BaseEdge
				id={id}
				path={`M ${line.start.x},${line.start.y} L ${line.end.x},${line.end.y}`}
				markerEnd={`url(#${marker})`}
				style={{ stroke: '#1d1b22', strokeWidth: 1.2 }}
			/>
			{constraint && (
				<EdgeLabelRenderer>
					<span
						className="generalization-constraint"
						style={{
							transform: `translate(8px, 12px) translate(${line.end.x}px, ${line.end.y}px)`
						}}
					>
						{constraint}
					</span>
				</EdgeLabelRenderer>
			)}
		</>
	);
}
