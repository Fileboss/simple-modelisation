import { useCanvas } from '../canvas/canvas-context';
import { PALETTE_MIME } from '../canvas/DiagramCanvas';
import { strings } from '../ui/strings';
import { setNotation, useNotation } from './notation';

export function McdPalette() {
	const { diagramId } = useCanvas();
	const notation = useNotation(diagramId);
	return (
		<aside className="palette">
			<h2>{strings.mcd.notation}</h2>
			<div className="notation-switch" role="radiogroup" aria-label={strings.mcd.notation}>
				{(['merise', 'uml'] as const).map((value) => (
					<button
						key={value}
						role="radio"
						aria-checked={notation === value}
						className={notation === value ? 'notation-current' : ''}
						onClick={() => setNotation(diagramId, value)}
					>
						{strings.mcd.notations[value]}
					</button>
				))}
			</div>
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
