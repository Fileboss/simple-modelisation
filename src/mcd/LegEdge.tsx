import { BaseEdge, EdgeLabelRenderer, useInternalNode, type EdgeProps } from '@xyflow/react';
import { useCanvas } from '../canvas/canvas-context';
import type { RemoteHighlight, TwinPosition } from '../canvas/DiagramCanvas';
import { borderPoint, boxOf, center, drawnRoute, routedPath } from '../canvas/geometry';
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
	const sourceBox = boxOf(sourceNode);
	const targetBox = boxOf(targetNode);
	const route = bends && drawnRoute(sourceBox, bends, targetBox);
	let path: string;
	let label: { x: number; y: number };
	if (route) {
		path = routedPath(route);
		// The Cardinality sits on the last segment, next to its Entity, as in Looping.
		const [a, b] = route.slice(-2);
		label = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
	} else {
		// Twin Legs bend apart around the straight line between the two centers.
		const from = center(sourceBox);
		const to = center(targetBox);
		const length = Math.hypot(to.x - from.x, to.y - from.y) || 1;
		const offset = (leg.twinIndex - (leg.twinCount - 1) / 2) * SPREAD * 2;
		const control = {
			x: (from.x + to.x) / 2 - ((to.y - from.y) / length) * offset,
			y: (from.y + to.y) / 2 + ((to.x - from.x) / length) * offset
		};
		const start = borderPoint(sourceBox, control);
		const end = borderPoint(targetBox, control);
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
