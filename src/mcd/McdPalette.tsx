import { PALETTE_MIME } from '../canvas/DiagramCanvas';
import { strings } from '../ui/strings';

export function McdPalette() {
	return (
		<aside className="palette">
			<h2>{strings.mcd.palette}</h2>
			<div
				className="palette-item"
				draggable
				onDragStart={(e) => {
					e.dataTransfer.setData(PALETTE_MIME, 'entity');
					e.dataTransfer.effectAllowed = 'copy';
				}}
			>
				<span className="palette-entity" />
				{strings.mcd.entity}
			</div>
			<p className="palette-hint">{strings.mcd.paletteHint}</p>
		</aside>
	);
}
