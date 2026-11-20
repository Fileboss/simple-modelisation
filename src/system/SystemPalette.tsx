import { NOTE_ITEM } from '../canvas/palette-drag';
import { PaletteItem } from '../canvas/PaletteItem';
import { GesturesHint } from '../canvas/GesturesHint';
import { strings } from '../ui/strings';
import { COMPONENT_TYPES, ZONE_ITEM } from './catalog';
import { GenericIcon } from './ComponentIcon';

export function SystemPalette() {
	return (
		<aside className="palette">
			<h2>{strings.system.palette}</h2>
			{COMPONENT_TYPES.map((info) => (
				<PaletteItem key={info.type} item={info.type}>
					<GenericIcon type={info.type} color={info.color} />
					{info.label}
				</PaletteItem>
			))}
			<PaletteItem item={ZONE_ITEM}>
				<svg className="zone-icon" viewBox="0 0 24 24" aria-hidden="true">
					<rect x="2.5" y="4.5" width="19" height="15" rx="2" />
				</svg>
				{strings.system.zone}
			</PaletteItem>
			<PaletteItem item={NOTE_ITEM}>
				<span className="palette-note" aria-hidden="true" />
				{strings.note.title}
			</PaletteItem>
			<p className="palette-hint">{strings.system.paletteHint}</p>
			<GesturesHint />
		</aside>
	);
}
