import { BaseEdge, EdgeLabelRenderer, useInternalNode, type EdgeProps } from '@xyflow/react';
import { useCanvas } from '../canvas/canvas-context';
import type { RemoteHighlight, TwinPosition } from '../canvas/DiagramCanvas';
import { boxOf } from '../canvas/geometry';
import { legLine } from '@simple-modelisation/model/mcd-drawing.ts';
import type { LegEdge as LegData } from '@simple-modelisation/model/project.ts';
import { umlMultiplicity, useNotation, type PeerLeg } from './notation';

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

	const { path, label } = legLine(boxOf(sourceNode), boxOf(targetNode), leg, isUml);

	// The composition's diamond takes the line's color, selected or another Participant's.
	const stroke = selected ? 'var(--accent)' : (leg.remoteColor ?? '#1d1b22');
	return (
		<>
			{leg.composition && isUml && (
				<defs>
					<marker
						id={`composition-${id}`}
						viewBox="0 0 16 10"
						refX="16"
						refY="5"
						markerWidth="24"
						markerHeight="15"
						markerUnits="userSpaceOnUse"
						orient="auto"
					>
						<path d="M 0 5 L 8 0 L 16 5 L 8 10 z" style={{ fill: stroke }} />
					</marker>
				</defs>
			)}
			<BaseEdge
				id={id}
				path={path}
				markerEnd={leg.composition && isUml ? `url(#composition-${id})` : undefined}
				style={{
					stroke,
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
					{!isUml && leg.relative && <span className="relative-mark"> R</span>}
				</button>
			</EdgeLabelRenderer>
		</>
	);
}
