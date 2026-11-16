import { PALETTE_MIME } from '../canvas/DiagramCanvas';
import { strings } from '../ui/strings';
import { COMPONENT_TYPES } from './catalog';
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
			<p className="palette-hint">{strings.system.paletteHint}</p>
		</aside>
	);
}
