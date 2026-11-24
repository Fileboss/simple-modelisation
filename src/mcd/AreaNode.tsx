import {
	NodeResizeControl,
	ResizeControlVariant,
	type ControlPosition,
	type NodeProps
} from '@xyflow/react';
import { AREA_LOOKS } from '@simple-modelisation/model/looks.ts';
import {
	AREA_COLORS,
	AREA_MIN,
	type AreaNode as AreaData
} from '@simple-modelisation/model/project.ts';
import { useCanvas } from '../canvas/canvas-context';
import { ColorSwatches } from '../canvas/ColorSwatches';
import { EditableText } from '../canvas/EditableText';
import { PanelField } from '../canvas/PanelField';
import { HelpHeading } from '../ui/HelpHeading';
import { strings } from '../ui/strings';

const HANDLES: ControlPosition[] = [
	'top',
	'right',
	'bottom',
	'left',
	'top-left',
	'top-right',
	'bottom-left',
	'bottom-right'
];

/**
 * An Area: a light rectangle behind an MCD. Only its label, its border and,
 * once selected, its resize handles catch the pointer: its inside is the
 * background, so that a drag there selects.
 */
export function AreaNode({ id, data, selected }: NodeProps) {
	const { project, diagramId } = useCanvas();
	const area = data as AreaData;
	const look = AREA_LOOKS[area.color ?? 'blue'];
	return (
		<div
			className={`area ${selected ? 'selected' : ''}`}
			style={{ background: look.fill, borderColor: look.edge, color: look.text }}
		>
			{(['top', 'right', 'bottom', 'left'] as const).map((side) => (
				<span key={side} className={`area-grip area-border area-border-${side}`} />
			))}
			{(area.label || selected) && (
				<div className={`area-grip area-label ${area.label ? '' : 'area-unnamed'}`}>
					<EditableText
						className="area-name"
						value={area.label}
						display={area.label || strings.area.unnamed}
						allowBlank
						onChange={(label) => {
							project.stopCapturing();
							project.setAreaLabel(diagramId, id, label);
						}}
					/>
				</div>
			)}
			{selected &&
				HANDLES.map((position) => (
					<NodeResizeControl
						key={position}
						position={position}
						variant={ResizeControlVariant.Handle}
						minWidth={AREA_MIN.width}
						minHeight={AREA_MIN.height}
						className="area-handle"
						onResizeStart={() => project.stopCapturing()}
						// The canvas saves the box at the end of the resize (see useSnapGestures).
					/>
				))}
		</div>
	);
}

/** An Area's panel: its label and its color. */
export function AreaPanel({ area }: { area: AreaData }) {
	const { project, diagramId } = useCanvas();
	return (
		<>
			<HelpHeading title={strings.area.title}>
				<p>{strings.area.hint}</p>
			</HelpHeading>
			<PanelField
				label={strings.area.label}
				value={area.label}
				allowBlank
				onChange={(label) => {
					project.stopCapturing();
					project.setAreaLabel(diagramId, area.id, label);
				}}
			/>
			<ColorSwatches
				title={strings.area.color}
				colors={AREA_COLORS}
				current={area.color ?? 'blue'}
				names={strings.area.colors}
				look={(color) => ({
					background: AREA_LOOKS[color].fill,
					borderColor: AREA_LOOKS[color].edge
				})}
				onPick={(color) => {
					project.stopCapturing();
					project.setAreaColor(diagramId, area.id, color);
				}}
			/>
		</>
	);
}
