import { BaseEdge, EdgeLabelRenderer, useInternalNode, type EdgeProps } from '@xyflow/react';
import { useCanvas } from '../canvas/canvas-context';
import type { TwinPosition } from '../canvas/DiagramCanvas';
import { borderPoint, center } from '../canvas/geometry';
import type { LegEdge as LegData } from '../document/project';

/** Gap between Legs joining the same Association and Entity (a reflexive Association has two). */
const SPREAD = 40;

/**
 * A Leg from an Association to an Entity, with its Cardinality near the Entity.
 * Clicking the Cardinality moves it to the next one.
 */
export function LegEdge({ id, source, target, data, selected }: EdgeProps) {
	const { project, diagramId } = useCanvas();
	const sourceNode = useInternalNode(source);
	const targetNode = useInternalNode(target);
	const leg = data as LegData & TwinPosition;
	if (!sourceNode || !targetNode) return null;

	// Twin Legs bend apart around the straight line between the two centers.
	const from = center(sourceNode);
	const to = center(targetNode);
	const length = Math.hypot(to.x - from.x, to.y - from.y) || 1;
	const offset = (leg.twinIndex - (leg.twinCount - 1) / 2) * SPREAD * 2;
	const control = {
		x: (from.x + to.x) / 2 - ((to.y - from.y) / length) * offset,
		y: (from.y + to.y) / 2 + ((to.x - from.x) / length) * offset
	};
	const start = borderPoint(sourceNode, control);
	const end = borderPoint(targetNode, control);
	const at = (t: number) => ({
		x: (1 - t) ** 2 * start.x + 2 * (1 - t) * t * control.x + t ** 2 * end.x,
		y: (1 - t) ** 2 * start.y + 2 * (1 - t) * t * control.y + t ** 2 * end.y
	});
	const label = at(0.7);

	return (
		<>
			<BaseEdge
				id={id}
				path={`M ${start.x},${start.y} Q ${control.x},${control.y} ${end.x},${end.y}`}
				style={{ stroke: selected ? 'var(--accent)' : '#1d1b22', strokeWidth: 1.2 }}
			/>
			<EdgeLabelRenderer>
				<button
					className="nodrag nopan cardinality"
					style={{ transform: `translate(-50%, -50%) translate(${label.x}px, ${label.y}px)` }}
					onClick={() => {
						project.stopCapturing();
						project.cycleCardinality(diagramId, id);
					}}
				>
					{leg.cardinality}
				</button>
			</EdgeLabelRenderer>
		</>
	);
}
