export type TabBox = { id: string; left: number; width: number };

/**
 * Where a tab dragged by `dx` goes: its place in the row. It takes another's place
 * once the edge it moves with passes that one's middle, whatever their widths.
 */
export function dropIndex(boxes: TabBox[], id: string, dx: number): number {
	const from = boxes.findIndex((b) => b.id === id);
	if (from === -1) return -1;
	const middle = (box: TabBox) => box.left + box.width / 2;
	const left = boxes[from].left + dx;
	const right = left + boxes[from].width;
	const passed = boxes.filter((b, i) =>
		i < from ? middle(b) <= left : i > from && middle(b) < right
	);
	return passed.length;
}

/** A drag kept within the row: the tab does not leave it. */
export function withinRow(boxes: TabBox[], id: string, dx: number): number {
	const dragged = boxes.find((b) => b.id === id);
	if (!dragged) return 0;
	const last = boxes[boxes.length - 1];
	return Math.min(
		last.left + last.width - dragged.left - dragged.width,
		Math.max(boxes[0].left - dragged.left, dx)
	);
}

/** How far each tab shifts to make room for the dragged one at `index`. */
export function shiftOf(boxes: TabBox[], id: string, index: number, tab: string): number {
	const from = boxes.findIndex((b) => b.id === id);
	const at = boxes.findIndex((b) => b.id === tab);
	if (from === -1 || at === -1 || at === from) return 0;
	// The dragged tab's place, the gap beside it included.
	const next = boxes[from + 1];
	const previous = boxes[from - 1];
	const gap = next
		? next.left - boxes[from].left - boxes[from].width
		: previous
			? boxes[from].left - previous.left - previous.width
			: 0;
	const room = boxes[from].width + gap;
	if (from < at && at <= index) return -room;
	if (index <= at && at < from) return room;
	return 0;
}
