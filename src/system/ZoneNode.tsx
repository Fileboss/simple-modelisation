import { NodeResizer, type NodeProps } from '@xyflow/react';
import { useCanvas } from '../canvas/canvas-context';
import { EditableText } from '../canvas/EditableText';
import { ZONE_MIN, type ZoneNode as ZoneData } from '@simple-modelisation/model/project.ts';
import { strings } from '../ui/strings';
import { providerLook } from './provider-catalog';
import { ProviderIcon } from './ProviderIcon';

/**
 * A Zone: a dashed area under the Components. Only its title bar and, once
 * selected, its resize handles catch the pointer, so what lies inside stays
 * clickable; it is dragged by the title bar.
 */
export function ZoneNode({ id, data, selected }: NodeProps) {
	const { project, diagramId } = useCanvas();
	const zone = data as ZoneData;
	const provider = providerLook(zone.provider);

	return (
		<div className={`zone ${selected ? 'selected' : ''}`}>
			<NodeResizer
				isVisible={selected}
				minWidth={ZONE_MIN.width}
				minHeight={ZONE_MIN.height}
				handleClassName="zone-handle"
				lineClassName="zone-line"
				onResizeStart={() => project.stopCapturing()}
				onResizeEnd={(_event, box) => project.setZoneBox(diagramId, id, box)}
			/>
			<div className="zone-title">
				{provider && (
					<span
						className="zone-provider"
						role="img"
						aria-label={`${strings.provider.title}: ${provider.label}`}
						title={`${strings.provider.title}: ${provider.label}`}
					>
						<ProviderIcon look={provider} size={16} />
					</span>
				)}
				<EditableText
					className="zone-name"
					value={zone.name}
					onChange={(name) => project.renameNode(diagramId, id, name)}
				/>
			</div>
		</div>
	);
}
