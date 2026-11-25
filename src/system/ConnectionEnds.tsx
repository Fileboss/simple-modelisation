import { ViewportPortal } from '@xyflow/react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { ANCHORS, anchorPoint } from '@simple-modelisation/model/anchors.ts';
import type { Point } from '../canvas/geometry';
import { useCoarsePointer } from '../ui/media';
import { strings } from '../ui/strings';
import type { EndDrag, EndName } from './use-end-drag';

type Props = {
	id: string;
	ends: Record<EndName, Point>;
	drag: EndDrag | null;
	onStart: (event: ReactPointerEvent, end: EndName) => void;
};

/**
 * The grips at the ends of the selected Connection, over the boxes, and while
 * one is dragged the Anchors of the Component it is over.
 */
export function ConnectionEnds({ id, ends, drag, onStart }: Props) {
	const coarsePointer = useCoarsePointer();
	const place = ({ x, y }: Point) => ({
		transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`
	});
	return (
		<ViewportPortal>
			{drag?.over &&
				ANCHORS.map((anchor) => (
					<span
						key={anchor}
						className={`anchor ${anchor === drag.over!.anchor ? 'anchor-taken' : ''}`}
						style={place(anchorPoint(drag.over!.box, anchor))}
					/>
				))}
			{(['source', 'target'] as const).map((end) => (
				<span
					key={end}
					// No Shift+drag lasso from a grip (nokey): it would go with the selection, mid-press.
					className={`connection-end nodrag nokey ${coarsePointer ? 'nopan' : ''} ${drag?.end === end ? 'connection-end-moving' : ''}`}
					data-id={id}
					data-end={end}
					title={strings.connection.moveEnd}
					style={place(drag?.end === end ? drag.at : ends[end])}
					onPointerDown={(e) => onStart(e, end)}
				/>
			))}
		</ViewportPortal>
	);
}
