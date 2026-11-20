import type { ReactNode } from 'react';
import { useCoarsePointer } from '../ui/media';
import { useCanvas } from './canvas-context';
import { armPaletteItem, endPaletteDrag, startPaletteDrag, useArmedItem } from './palette-drag';

/**
 * One palette item: dragged onto the canvas with a mouse; on a touch screen,
 * tapped to arm it, then placed by a tap on the canvas (a second tap disarms).
 */
export function PaletteItem({ item, children }: { item: string; children: ReactNode }) {
	const coarsePointer = useCoarsePointer();
	const { diagramId } = useCanvas();
	const current = useArmedItem();
	const armed = current?.item === item && current.diagramId === diagramId;
	return (
		<div
			className={`palette-item ${armed ? 'palette-item-armed' : ''}`}
			draggable
			role={coarsePointer ? 'button' : undefined}
			aria-pressed={coarsePointer ? armed : undefined}
			onDragStart={(e) => startPaletteDrag(e, item)}
			onDragEnd={endPaletteDrag}
			onClick={coarsePointer ? () => armPaletteItem(armed ? null : { item, diagramId }) : undefined}
		>
			{children}
		</div>
	);
}
