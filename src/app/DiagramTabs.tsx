import {
	useEffect,
	useRef,
	useState,
	type CSSProperties,
	type KeyboardEvent as ReactKeyboardEvent,
	type PointerEvent as ReactPointerEvent,
	type RefObject
} from 'react';
import type { Diagram, DiagramKind, ProjectDocument } from '@simple-modelisation/model/project.ts';
import { EditableText } from '../canvas/EditableText';
import { strings } from '../ui/strings';
import { followDrag } from '../ui/follow-drag';
import { dropIndex, shiftOf, withinRow, type TabBox } from './tab-order';

/** How far, in pixels, a press on a tab goes before it drags it rather than opens it. */
const DRAG_START = 5;

type Props = {
	project: ProjectDocument;
	diagrams: Diagram[];
	openId: string | undefined;
	onSelect: (id: string) => void;
	onDuplicate: (id: string) => void;
	onAdd: (kind: DiagramKind) => void;
};

/** The Diagrams' tabs, dragged into another order (Alt+Shift+Left or Right on the keyboard). */
export function DiagramTabs({ project, diagrams, openId, onSelect, onDuplicate, onAdd }: Props) {
	const nav = useRef<HTMLElement>(null);
	// The open Diagram's tab shows, however many there are.
	useEffect(() => {
		tabsIn(nav.current)
			.find((tab) => tab.dataset.tab === openId)
			?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
	}, [openId]);

	const order = diagrams.map((d) => `${d.id} ${d.name}`).join('\n');
	const { drag, start } = useTabDrag(nav, order, (id, index) => project.moveDiagram(id, index));

	const moveBy = (id: string, step: -1 | 1) => {
		const at = diagrams.findIndex((d) => d.id === id);
		project.moveDiagram(id, at + step);
		// Moved in the page, the tab may lose the focus.
		requestAnimationFrame(() =>
			tabsIn(nav.current)
				.find((tab) => tab.dataset.tab === id)
				?.querySelector<HTMLElement>('.tab-name')
				?.focus()
		);
	};

	const style = (id: string): CSSProperties | undefined => {
		if (!drag) return undefined;
		const x = id === drag.id ? drag.dx : shiftOf(drag.boxes, drag.id, drag.index, id);
		return { transform: `translateX(${x}px)` };
	};
	return (
		<nav className={`tabs ${drag ? 'tabs-dragging' : ''}`} ref={nav}>
			{diagrams.map((d) => (
				<div
					key={d.id}
					data-tab={d.id}
					className={`tab ${d.id === openId ? 'tab-open' : ''} ${d.id === drag?.id ? 'tab-dragged' : ''}`}
					style={style(d.id)}
					onPointerDown={(e) => start(e, d.id)}
				>
					<div
						className="tab-name"
						role="button"
						tabIndex={0}
						title={strings.project.moveTabHint}
						onClick={() => onSelect(d.id)}
						onKeyDown={(e: ReactKeyboardEvent) => {
							if (!e.altKey || !e.shiftKey) return;
							const step = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : null;
							if (step === null) return;
							e.preventDefault();
							moveBy(d.id, step);
						}}
					>
						<DiagramKindBadge kind={d.kind} />
						<EditableText value={d.name} onChange={(name) => project.renameDiagram(d.id, name)} />
					</div>
					{d.id === openId && (
						<>
							<button
								className="tab-action"
								title={strings.project.duplicateDiagram}
								aria-label={strings.project.duplicateDiagram}
								onClick={() => onDuplicate(d.id)}
							>
								⧉
							</button>
							<button
								className="tab-action"
								title={strings.project.deleteDiagram}
								aria-label={strings.project.deleteDiagram}
								onClick={() => project.deleteDiagram(d.id)}
							>
								×
							</button>
						</>
					)}
				</div>
			))}
			<button onClick={() => onAdd('system')}>{strings.project.addSystem}</button>
			<button onClick={() => onAdd('mcd')}>{strings.project.addMcd}</button>
		</nav>
	);
}

export function DiagramKindBadge({ kind }: { kind: DiagramKind }) {
	return <span className={`tab-kind tab-kind-${kind}`}>{kind === 'mcd' ? 'MCD' : 'SD'}</span>;
}

type Drag = { id: string; dx: number; index: number; boxes: TabBox[] };

/** How long a finger rests on a tab to drag it; moving before that scrolls the row. */
const LONG_PRESS = 300;
/** How near an end of the row a drag scrolls it, and how fast, in pixels (per frame). */
const SCROLL_EDGE = 40;
const SCROLL_STEP = 10;

const tabsIn = (nav: HTMLElement | null) => [
	...(nav?.querySelectorAll<HTMLElement>('[data-tab]') ?? [])
];

/**
 * Dragging a tab along its row, with a mouse, a pen, or a finger after a long
 * press: followed on the window, so that it goes on outside the row. Escape,
 * losing the pointer or a change of the tabs (`order`, by a peer or an agent)
 * leaves them as they are.
 */
function useTabDrag(
	nav: RefObject<HTMLElement | null>,
	order: string,
	onDrop: (id: string, index: number) => void
) {
	const [drag, setDrag] = useState<Drag | null>(null);
	const cancel = useRef<(() => void) | null>(null);
	useEffect(() => () => cancel.current?.(), [order]);

	const start = (event: ReactPointerEvent, id: string) => {
		const target = event.target as Element;
		// Ctrl+click is a right click on a Mac.
		if (event.button !== 0 || event.ctrlKey || !event.isPrimary) return;
		if (target.closest('input, button')) return;
		cancel.current?.();

		const row = nav.current;
		const startX = event.clientX;
		const startScroll = row?.scrollLeft ?? 0;
		let x = startX;
		let current: Drag | null = null;
		let frame = 0;

		const follow = () => {
			if (!current) return;
			const { boxes } = current;
			const dx = withinRow(boxes, id, x - startX + (row?.scrollLeft ?? 0) - startScroll);
			current = { id, dx, index: dropIndex(boxes, id, dx), boxes };
			setDrag(current);
		};
		/** Near an end of the row, scrolls it: the tabs out of sight can be reached. */
		const scroll = () => {
			const bounds = row?.getBoundingClientRect();
			if (row && bounds) {
				const by =
					x > bounds.right - SCROLL_EDGE
						? SCROLL_STEP
						: x < bounds.left + SCROLL_EDGE
							? -SCROLL_STEP
							: 0;
				const before = row.scrollLeft;
				if (by) row.scrollLeft += by;
				if (row.scrollLeft !== before) follow();
			}
			frame = requestAnimationFrame(scroll);
		};
		cancel.current = followDrag(event, {
			distance: DRAG_START,
			pressDelay: event.pointerType === 'touch' ? LONG_PRESS : undefined,
			onBegin: () => {
				const boxes = tabsIn(row).map((tab) => {
					const { left, width } = tab.getBoundingClientRect();
					return { id: tab.dataset.tab!, left, width };
				});
				current = { id, dx: 0, index: boxes.findIndex((b) => b.id === id), boxes };
				frame = requestAnimationFrame(scroll);
			},
			onMove: ({ clientX }) => {
				x = clientX;
				follow();
			},
			onDrop: () => {
				if (!current) return;
				const { index, boxes } = current;
				if (index !== boxes.findIndex((b) => b.id === id)) onDrop(id, index);
			},
			onEnd: () => {
				cancel.current = null;
				cancelAnimationFrame(frame);
				setDrag(null);
			}
		});
	};
	return { drag, start };
}
