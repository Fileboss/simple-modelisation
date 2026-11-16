import { BaseEdge, EdgeLabelRenderer, useInternalNode, type EdgeProps } from '@xyflow/react';
import { useCanvas } from '../canvas/canvas-context';
import type { RemoteHighlight, TwinPosition } from '../canvas/DiagramCanvas';
import { borderPoint, center, pointAlong, routedPath } from '../canvas/geometry';
import type { LegEdge as LegData } from '@simple-modelisation/model/project.ts';
import { umlMultiplicity, useNotation, type PeerLeg } from './notation';

/** Gap between Legs joining the same Association and Entity (a reflexive Association has two). */
const SPREAD = 40;

/**
 * A Leg from an Association to an Entity, with its Cardinality near the Entity;
 * clicking it moves to the next one. In UML, the label near the Entity is the
 * other Leg's Cardinality as a multiplicity, and clicking it cycles that Leg.
 */
export function LegEdge({ id, source, target, data, selected }: EdgeProps) {
	const { project, diagramId } = useCanvas();
	const sourceNode = useInternalNode(source);
	const targetNode = useInternalNode(target);
	const leg = data as LegData & TwinPosition & RemoteHighlight & PeerLeg;
	const isUml = useNotation(diagramId) === 'uml' && leg.peer !== undefined;
	const shown = isUml ? leg.peer! : { id, cardinality: leg.cardinality };
	if (!sourceNode || !targetNode) return null;

	// A route stored by a Tidy up (Merise only: in UML the Leg starts at the label).
	// Stored bends, ends attached to the boxes as they are drawn now.
	const bends = !isUml && leg.points && leg.points.length > 0 ? leg.points : null;
	const route = bends && [
		borderPoint(sourceNode, bends[0]),
		...bends,
		borderPoint(targetNode, bends.at(-1)!)
	];
	let path: string;
	let label: { x: number; y: number };
	if (route) {
		path = routedPath(route);
		label = pointAlong(route, 0.7);
	} else {
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
		path = `M ${start.x},${start.y} Q ${control.x},${control.y} ${end.x},${end.y}`;
		label = at(isUml ? 0.82 : 0.7);
	}

	return (
		<>
			<BaseEdge
				id={id}
				path={path}
				style={{
					stroke: selected ? 'var(--accent)' : (leg.remoteColor ?? '#1d1b22'),
					strokeWidth: leg.remoteColor && !selected ? 3 : 1.2
				}}
			/>
			<EdgeLabelRenderer>
				<button
					className={`nodrag nopan cardinality ${isUml ? 'multiplicity' : ''}`}
					style={{ transform: `translate(-50%, -50%) translate(${label.x}px, ${label.y}px)` }}
					onClick={() => {
						project.stopCapturing();
						project.cycleCardinality(diagramId, shown.id);
					}}
				>
					{isUml ? umlMultiplicity(shown.cardinality) : shown.cardinality}
				</button>
			</EdgeLabelRenderer>
		</>
	);
}
