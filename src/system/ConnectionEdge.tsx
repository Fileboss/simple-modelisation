import { BaseEdge, EdgeLabelRenderer, useInternalNode, type EdgeProps } from '@xyflow/react';
import type { RemoteHighlight } from '../canvas/DiagramCanvas';
import { borderPoint, center } from '../canvas/geometry';
import type { ConnectionEdge as ConnectionData } from '../document/project';

/** A straight arrow between the borders of two Components, with its label in the middle. */
export function ConnectionEdge({ id, source, target, data, selected }: EdgeProps) {
	const sourceNode = useInternalNode(source);
	const targetNode = useInternalNode(target);
	if (!sourceNode || !targetNode) return null;

	const start = borderPoint(sourceNode, center(targetNode));
	const end = borderPoint(targetNode, center(sourceNode));
	const label = (data as ConnectionData).label;
	const { remoteColor } = data as RemoteHighlight;
	const color = selected ? 'var(--accent)' : (remoteColor ?? '#475569');
	const arrow = `arrow-${id}`;

	return (
		<>
			<defs>
				<marker
					id={arrow}
					viewBox="0 0 10 10"
					refX="10"
					refY="5"
					markerWidth="8"
					markerHeight="8"
					orient="auto"
				>
					<path d="M0,0 L10,5 L0,10 z" fill={color} />
				</marker>
			</defs>
			<BaseEdge
				id={id}
				path={`M ${start.x},${start.y} L ${end.x},${end.y}`}
				markerEnd={`url(#${arrow})`}
				style={{ stroke: color, strokeWidth: remoteColor && !selected ? 3 : 1.5 }}
			/>
			{label && (
				<EdgeLabelRenderer>
					<div
						className="edge-label"
						style={{
							transform: `translate(-50%, -50%) translate(${(start.x + end.x) / 2}px, ${(start.y + end.y) / 2}px)`
						}}
					>
						{label}
					</div>
				</EdgeLabelRenderer>
			)}
		</>
	);
}
