import { BaseEdge, EdgeLabelRenderer, useInternalNode, type EdgeProps } from '@xyflow/react';
import type { RemoteHighlight } from '../canvas/DiagramCanvas';
import { boxOf, connectionRoute, labelPoint, routedPath } from '../canvas/geometry';
import type { PlacedLabel } from './label-placement';
import type { ConnectionEdge as ConnectionData } from '@simple-modelisation/model/project.ts';

/**
 * An arrow between two Components, with its label in the middle: along the
 * route a Tidy up stored, else with right angles between the sides they face.
 */
export function ConnectionEdge({ id, source, target, data, selected }: EdgeProps) {
	const sourceNode = useInternalNode(source);
	const targetNode = useInternalNode(target);
	if (!sourceNode || !targetNode) return null;

	const { label, points, labelAt } = data as ConnectionData & PlacedLabel;
	// The same route the label placement used: stored bends, else a right-angle step.
	const route = connectionRoute(boxOf(sourceNode), boxOf(targetNode), points);
	const path = routedPath(route);
	const at = labelAt ?? labelPoint(route);
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
				path={path}
				markerEnd={`url(#${arrow})`}
				style={{ stroke: color, strokeWidth: remoteColor && !selected ? 3 : 1.5 }}
			/>
			{label && (
				<EdgeLabelRenderer>
					<div
						className="edge-label"
						style={{
							transform: `translate(-50%, -50%) translate(${at.x}px, ${at.y}px)`
						}}
					>
						{label}
					</div>
				</EdgeLabelRenderer>
			)}
		</>
	);
}
