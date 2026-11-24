import { useCoarsePointer } from '../ui/media';
import { strings } from '../ui/strings';

/** The canvas gestures, in every palette's help. */
export function GesturesHint() {
	const coarsePointer = useCoarsePointer();
	return <p>{coarsePointer ? strings.canvas.touchGestures : strings.canvas.gestures}</p>;
}
