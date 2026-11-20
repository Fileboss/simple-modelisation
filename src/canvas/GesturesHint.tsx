import { useCoarsePointer } from '../ui/media';
import { strings } from '../ui/strings';

/** The canvas gestures, under every palette. */
export function GesturesHint() {
	const coarsePointer = useCoarsePointer();
	return (
		<p className="palette-hint">
			{coarsePointer ? strings.canvas.touchGestures : strings.canvas.gestures}
		</p>
	);
}
