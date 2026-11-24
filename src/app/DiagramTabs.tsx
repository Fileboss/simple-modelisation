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

/** The click a drag ends with does not open a tab. */
function swallowClick() {
	const swallow = (click: MouseEvent) => {
		click.stopPropagation();
		click.preventDefault();
	};
	window.addEventListener('click', swallow, { capture: true, once: true });
	setTimeout(() => window.removeEventListener('click', swallow, { capture: true }));
}

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
		const { pointerId } = event;
		const isTouch = event.pointerType === 'touch';
		let x = startX;
		let current: Drag | null = null;
		let frame = 0;

		const begin = () => {
			const boxes = tabsIn(row).map((tab) => {
				const { left, width } = tab.getBoundingClientRect();
				return { id: tab.dataset.tab!, left, width };
			});
			current = { id, dx: 0, index: boxes.findIndex((b) => b.id === id), boxes };
			follow();
			frame = requestAnimationFrame(scroll);
		};
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
		const press = isTouch ? setTimeout(begin, LONG_PRESS) : undefined;

		const onMove = (e: PointerEvent) => {
			if (e.pointerId !== pointerId) return;
			// Released where the page could not see it (a menu, another window).
			if (e.buttons === 0) return stop();
			x = e.clientX;
			if (current) return follow();
			if (Math.abs(x - startX) < DRAG_START) return;
			if (isTouch) stop();
			else begin();
		};
		const onUp = (e: PointerEvent) => {
			if (e.pointerId !== pointerId) return;
			const done = current;
			stop();
			if (!done) return;
			swallowClick();
			if (done.index !== done.boxes.findIndex((b) => b.id === id)) onDrop(id, done.index);
		};
		const onCancel = (e: PointerEvent) => {
			if (e.pointerId === pointerId) stop();
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== 'Escape' || !current) return;
			e.stopPropagation();
			abandon();
		};
		// Once a finger drags a tab, it no longer scrolls, nor opens the browser's menu.
		const onTouchMove = (e: TouchEvent) => {
			if (current) e.preventDefault();
		};
		const onMenu = (e: Event) => {
			if (isTouch) e.preventDefault();
		};

		const stop = () => {
			cancel.current = null;
			clearTimeout(press);
			cancelAnimationFrame(frame);
			window.removeEventListener('pointermove', onMove);
			window.removeEventListener('pointerup', onUp);
			window.removeEventListener('pointercancel', onCancel);
			window.removeEventListener('blur', abandon);
			window.removeEventListener('keydown', onKey, true);
			window.removeEventListener('touchmove', onTouchMove);
			window.removeEventListener('contextmenu', onMenu, true);
			current = null;
			setDrag(null);
		};
		/** Stops with the button still down: its release opens nothing either. */
		const abandon = () => {
			const wasDragging = current !== null;
			stop();
			if (wasDragging) window.addEventListener('pointerup', swallowClick, { once: true });
		};
		window.addEventListener('pointermove', onMove);
		window.addEventListener('pointerup', onUp);
		window.addEventListener('pointercancel', onCancel);
		window.addEventListener('blur', abandon);
		window.addEventListener('keydown', onKey, true);
		window.addEventListener('touchmove', onTouchMove, { passive: false });
		window.addEventListener('contextmenu', onMenu, true);
		cancel.current = abandon;
	};
	return { drag, start };
}
