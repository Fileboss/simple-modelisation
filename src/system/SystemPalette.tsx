import { PALETTE_MIME } from '../canvas/DiagramCanvas';
import { strings } from '../ui/strings';
import { COMPONENT_TYPES, ZONE_ITEM } from './catalog';
import { GenericIcon } from './ComponentIcon';

export function SystemPalette() {
	return (
		<aside className="palette">
			<h2>{strings.system.palette}</h2>
			{COMPONENT_TYPES.map((info) => (
				<div
					key={info.type}
					className="palette-item"
					draggable
					onDragStart={(e) => {
						e.dataTransfer.setData(PALETTE_MIME, info.type);
						e.dataTransfer.effectAllowed = 'copy';
					}}
				>
					<GenericIcon type={info.type} color={info.color} />
					{info.label}
				</div>
			))}
			<div
				className="palette-item"
				draggable
				onDragStart={(e) => {
					e.dataTransfer.setData(PALETTE_MIME, ZONE_ITEM);
					e.dataTransfer.effectAllowed = 'copy';
				}}
			>
				<svg className="zone-icon" viewBox="0 0 24 24" aria-hidden="true">
					<rect x="2.5" y="4.5" width="19" height="15" rx="2" />
				</svg>
				{strings.system.zone}
			</div>
			<p className="palette-hint">{strings.system.paletteHint}</p>
		</aside>
	);
}
