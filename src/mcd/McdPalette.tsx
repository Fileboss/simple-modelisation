import { useCanvas } from '../canvas/canvas-context';
import { NOTE_ITEM } from '../canvas/palette-drag';
import { PaletteItem } from '../canvas/PaletteItem';
import { GesturesHint } from '../canvas/GesturesHint';
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
			<PaletteItem item="entity">
				<span className="palette-entity" />
				{strings.mcd.entity}
			</PaletteItem>
			<PaletteItem item={NOTE_ITEM}>
				<span className="palette-note" aria-hidden="true" />
				{strings.note.title}
			</PaletteItem>
			<p className="palette-hint">{strings.mcd.paletteHint}</p>
			<GesturesHint />
		</aside>
	);
}
