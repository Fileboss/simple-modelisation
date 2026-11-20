import { BaseEdge, Handle, Position, useInternalNode, type EdgeProps } from '@xyflow/react';
import { borderPoint, boxOf, center } from '../canvas/geometry';
import type { CifLink } from './cif';

/** A CIF, as in Looping: a small circle marked CIF beside its Association. */
export function CifNode({ selected }: { selected?: boolean }) {
	return (
		<div className={`cif ${selected ? 'selected' : ''}`}>
			CIF
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

/** From a CIF to an Entity: a dashed line, with an arrow to the determined Entity. */
export function CifLinkEdge({ id, source, target, data }: EdgeProps) {
	const sourceNode = useInternalNode(source);
	const targetNode = useInternalNode(target);
	if (!sourceNode || !targetNode) return null;
	const from = boxOf(sourceNode);
	const to = boxOf(targetNode);
	const start = borderPoint(from, center(to));
	const end = borderPoint(to, center(from));
	const determined = (data as CifLink).determined;
	// Its own arrowhead, so that nothing else on the canvas has to define it.
	const marker = `cif-arrow-${id}`;
	return (
		<>
			{determined && (
				<defs>
					<marker
						id={marker}
						viewBox="0 0 10 10"
						refX="10"
						refY="5"
						markerWidth="8"
						markerHeight="8"
						orient="auto"
					>
						<path className="cif-arrow" d="M 0 0 L 10 5 L 0 10 z" />
					</marker>
				</defs>
			)}
			<BaseEdge
				id={id}
				path={`M ${start.x},${start.y} L ${end.x},${end.y}`}
				markerEnd={determined ? `url(#${marker})` : undefined}
				className="cif-link"
			/>
		</>
	);
}
