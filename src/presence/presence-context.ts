import { createContext, use, useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import type { Awareness } from '../storage/sync';
import {
	participantsFrom,
	PRESENCE_FIELD,
	type Identity,
	type Participant,
	type PresenceState
} from './presence';

export type PresenceContextValue = {
	/** Null on a Local Project, which has no Presence. */
	awareness: Awareness | null;
	identity: Identity;
	rename: (name: string) => void;
};

export const PresenceContext = createContext<PresenceContextValue | null>(null);

export function usePresence(): PresenceContextValue {
	const value = use(PresenceContext);
	if (!value) throw new Error('usePresence needs a PresenceProvider');
	return value;
}

/**
 * A projection of the other Participants that re-renders the caller only when
 * the projection changes: a cursor move does not re-render the avatars.
 */
function useParticipantsView<T>(project: (participants: Participant[]) => T): T {
	const { awareness } = usePresence();
	const subscribe = useCallback(
		(onChange: () => void) => {
			awareness?.on('change', onChange);
			return () => awareness?.off('change', onChange);
		},
		[awareness]
	);
	const key = useSyncExternalStore(subscribe, () => {
		if (!awareness) return JSON.stringify(project([]));
		const states = awareness.getStates() as Map<number, Record<string, unknown>>;
		return JSON.stringify(project(participantsFrom(states, awareness.clientID)));
	});
	return useMemo(() => JSON.parse(key) as T, [key]);
}

/** Who else is on the Project, and on which Diagram (no cursors or selections). */
export function useParticipants(): Omit<Participant, 'cursor' | 'selection'>[] {
	return useParticipantsView((all) =>
		all.map(({ clientId, name, color, diagramId }) => ({ clientId, name, color, diagramId }))
	);
}

/** The other Participants on `diagramId` with a cursor on the canvas. */
export function useRemoteCursors(diagramId: string): Participant[] {
	return useParticipantsView((all) => all.filter((p) => p.diagramId === diagramId && p.cursor));
}

/** Element id → color of the Participants on `diagramId` who selected it. */
export function useRemoteSelections(diagramId: string): Map<string, string> {
	const pairs = useParticipantsView((all) =>
		all
			.filter((p) => p.diagramId === diagramId)
			.flatMap((p) => p.selection.map((id): [string, string] => [id, p.color]))
	);
	return useMemo(() => new Map(pairs), [pairs]);
}

// The full Presence last reported per awareness, to restore it when the provider
// clears the local state (it does on pagehide, before a back/forward cache restore).
const reported = new WeakMap<Awareness, Partial<PresenceState>>();

/** Shares part of this Participant's Presence (identity, Diagram, cursor or selection). */
export function reportPresence(awareness: Awareness | null, change: Partial<PresenceState>): void {
	if (!awareness) return;
	const presence = { ...reported.get(awareness), ...change };
	reported.set(awareness, presence);
	awareness.setLocalState({ ...awareness.getLocalState(), [PRESENCE_FIELD]: presence });
}

/** Shares the whole Presence again, after the provider cleared it. */
export function restorePresence(awareness: Awareness | null): void {
	if (awareness && !awareness.getLocalState()) reportPresence(awareness, {});
}

const CURSOR_INTERVAL = 50;
const CURSOR_IDLE = 30_000;

/**
 * Shares this Participant's cursor: at most every 50 ms, cleared when it
 * leaves the canvas or stays still for 30 s.
 */
class CursorReporter {
	private last = 0;
	private next: { x: number; y: number } | null = null;
	private pending: ReturnType<typeof setTimeout> | undefined;
	private idle: ReturnType<typeof setTimeout> | undefined;
	private readonly awareness: Awareness | null;

	constructor(awareness: Awareness | null) {
		this.awareness = awareness;
	}

	move = (x: number, y: number): void => {
		this.next = { x: Math.round(x), y: Math.round(y) };
		clearTimeout(this.idle);
		this.idle = setTimeout(this.leave, CURSOR_IDLE);
		if (this.pending) return;
		const wait = CURSOR_INTERVAL - (Date.now() - this.last);
		if (wait <= 0) this.send();
		else this.pending = setTimeout(this.send, wait);
	};

	leave = (): void => {
		this.stop();
		this.next = null;
		reportPresence(this.awareness, { cursor: null });
	};

	stop(): void {
		clearTimeout(this.pending);
		clearTimeout(this.idle);
		this.pending = undefined;
	}

	private send = (): void => {
		this.pending = undefined;
		this.last = Date.now();
		reportPresence(this.awareness, { cursor: this.next });
	};
}

export function useCursorReporter(): Pick<CursorReporter, 'move' | 'leave'> {
	const { awareness } = usePresence();
	const reporter = useMemo(() => new CursorReporter(awareness), [awareness]);
	useEffect(() => () => reporter.stop(), [reporter]);
	return reporter;
}
