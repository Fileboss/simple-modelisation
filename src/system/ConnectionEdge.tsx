import { BaseEdge, EdgeLabelRenderer, useInternalNode, type EdgeProps } from '@xyflow/react';
import type { RemoteHighlight } from '../canvas/DiagramCanvas';
import { useCanvas } from '../canvas/canvas-context';
import { boxOf, connectionRoute, labelPoint, routedPath, type Box } from '../canvas/geometry';
import { connectionPill, pillInPage, type PlacedLabel } from './label-placement';
import { useLabelDrag } from './use-label-drag';
import { pointAlong } from '@simple-modelisation/model/geometry.ts';
import { clearPosition } from '@simple-modelisation/model/label-placement.ts';
import type { ConnectionEdge as ConnectionData } from '@simple-modelisation/model/project.ts';
import { FLOW_COLORS } from '@simple-modelisation/model/looks.ts';
import { useCoarsePointer } from '../ui/media';
import { strings } from '../ui/strings';

/**
 * An arrow between two Components, with its label in the middle: along the
 * route a Tidy up stored, else with right angles between the sides they face.
 */
export function ConnectionEdge(props: EdgeProps) {
	const source = useInternalNode(props.source);
	const target = useInternalNode(props.target);
	if (!source || !target) return null;
	return <ConnectionLine {...props} sourceBox={boxOf(source)} targetBox={boxOf(target)} />;
}

type LineProps = EdgeProps & { sourceBox: Box; targetBox: Box };

function ConnectionLine({ id, sourceBox, targetBox, data, selected = false }: LineProps) {
	const { project, diagramId } = useCanvas();
	const coarsePointer = useCoarsePointer();
	const connection = data as ConnectionData & PlacedLabel;
	const { points, labelAt, flow } = connection;
	// The same route the label placement used: stored bends, else a right-angle step.
	const route = connectionRoute(sourceBox, targetBox, points);
	const path = routedPath(route);
	const pill = connectionPill(connection);
	const size = pill ? pillInPage(pill) : null;
	const clear = (position: number) =>
		size ? clearPosition(route, position, size, [sourceBox, targetBox]) : position;
	const drag = useLabelDrag(id, route, selected, clear, (position) => {
		project.stopCapturing();
		project.setLabelPosition(diagramId, id, position);
		project.stopCapturing();
	});
	const at =
		drag.position !== null ? pointAlong(route, drag.position) : (labelAt ?? labelPoint(route));
	const { remoteColor } = data as RemoteHighlight;
	// Read through the Project document, which drops a Flow it does not know; checked again
	// so that a peer's "constructor" can never index the catalogs.
	const known = flow && Object.hasOwn(FLOW_COLORS, flow) ? flow : undefined;
	const flowColor = known && FLOW_COLORS[known];
	const lines = size?.lines ?? [];
	const flowName = known ? strings.flow.names[known] : '';
	const color = selected ? 'var(--accent)' : (remoteColor ?? flowColor ?? '#475569');
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
			{pill && (
				<EdgeLabelRenderer>
					<div
						className={[
							'edge-label',
							lines.length > 1 && 'edge-label-wrapped',
							// A finger moves the label of a selected Connection, and pans otherwise.
							selected && coarsePointer && 'edge-label-selected nopan',
							drag.position !== null && 'edge-label-moving'
						]
							.filter(Boolean)
							.join(' ')}
						data-id={id}
						title={strings.connection.moveLabel}
						onPointerDown={drag.onPointerDown}
						style={{
							transform: `translate(-50%, -50%) translate(${at.x}px, ${at.y}px)`
						}}
					>
						{lines.map((line, i) => (
							<div key={i}>
								{i === 0 && known && <span style={{ color: flowColor }}>{flowName}</span>}
								{i === 0 ? line.slice(flowName.length) : line}
							</div>
						))}
					</div>
				</EdgeLabelRenderer>
			)}
		</>
	);
}
