import { AREA_LOOKS } from '@simple-modelisation/model/looks.ts';
import { useCanvas } from '../canvas/canvas-context';
import { AREA_ITEM, NOTE_ITEM } from '../canvas/palette-drag';
import { PaletteItem } from '../canvas/PaletteItem';
import { GesturesHint } from '../canvas/GesturesHint';
import { HelpHeading } from '../ui/HelpHeading';
import { strings } from '../ui/strings';
import { useProjectVersion } from '../app/project-hooks';
import { setNotation, setTypesShown, useNotation, useTypesShown } from './notation';

export function McdPalette() {
	const { project, diagramId } = useCanvas();
	const notation = useNotation(diagramId);
	const typesShown = useTypesShown(diagramId);
	// Shared with every Participant, unlike the Notation: the positions it produces are.
	useProjectVersion(project);
	const direction = project.diagram(diagramId)?.tidyDirection ?? 'horizontal';
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
			{/* UML always writes the Data types. */}
			{notation === 'merise' && (
				<label className="panel-check">
					<input
						type="checkbox"
						checked={typesShown}
						onChange={(e) => setTypesShown(diagramId, e.currentTarget.checked)}
					/>
					{strings.mcd.showTypes}
				</label>
			)}
			<h2>{strings.mcd.tidyDirection}</h2>
			<div className="notation-switch" role="radiogroup" aria-label={strings.mcd.tidyDirection}>
				{(['horizontal', 'vertical'] as const).map((value) => (
					<button
						key={value}
						role="radio"
						aria-checked={direction === value}
						className={direction === value ? 'notation-current' : ''}
						onClick={() => project.setTidyDirection(diagramId, value)}
					>
						{strings.mcd.tidyDirections[value]}
					</button>
				))}
			</div>
			<HelpHeading title={strings.mcd.palette}>
				<p>{strings.mcd.paletteHint}</p>
				<GesturesHint />
			</HelpHeading>
			<PaletteItem item="entity">
				<span className="palette-entity" />
				{strings.mcd.entity}
			</PaletteItem>
			<PaletteItem item={NOTE_ITEM}>
				<span className="palette-note" aria-hidden="true" />
				{strings.note.title}
			</PaletteItem>
			<PaletteItem item={AREA_ITEM}>
				<span
					className="palette-area"
					style={{ background: AREA_LOOKS.blue.fill, borderColor: AREA_LOOKS.blue.edge }}
					aria-hidden="true"
				/>
				{strings.area.title}
			</PaletteItem>
		</aside>
	);
}
