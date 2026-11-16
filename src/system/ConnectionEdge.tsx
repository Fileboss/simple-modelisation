import {
	BaseEdge,
	EdgeLabelRenderer,
	getSmoothStepPath,
	useInternalNode,
	type EdgeProps
} from '@xyflow/react';
import type { RemoteHighlight } from '../canvas/DiagramCanvas';
import { borderPoint, facingSides, pointAlong, routedPath } from '../canvas/geometry';
import type { ConnectionEdge as ConnectionData } from '@simple-modelisation/model/project.ts';

/**
 * An arrow between two Components, with its label in the middle: along the
 * route a Tidy up stored, else with right angles between the sides they face.
 */
export function ConnectionEdge({ id, source, target, data, selected }: EdgeProps) {
	const sourceNode = useInternalNode(source);
	const targetNode = useInternalNode(target);
	if (!sourceNode || !targetNode) return null;

	const { label, points } = data as ConnectionData;
	let path: string;
	let middle: { x: number; y: number };
	if (points && points.length > 0) {
		// Stored bends; the ends attach to the boxes as they are drawn now.
		const route = [
			borderPoint(sourceNode, points[0]),
			...points,
			borderPoint(targetNode, points.at(-1)!)
		];
		path = routedPath(route);
		middle = pointAlong(route, 0.5);
	} else {
		const { start, end, sourcePosition, targetPosition } = facingSides(sourceNode, targetNode);
		const [stepPath, x, y] = getSmoothStepPath({
			sourceX: start.x,
			sourceY: start.y,
			sourcePosition,
			targetX: end.x,
			targetY: end.y,
			targetPosition,
			borderRadius: 10
		});
		path = stepPath;
		middle = { x, y };
	}
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
							transform: `translate(-50%, -50%) translate(${middle.x}px, ${middle.y}px)`
						}}
					>
						{label}
					</div>
				</EdgeLabelRenderer>
			)}
		</>
	);
}
