import * as Y from 'yjs';

/**
 * What the tabs of this browser tell each other. `state`: a tab holding the
 * document `name` gives its state vector, to be sent what it misses (`reply`
 * when it answers another tab's). `update`: a Yjs update to `name`.
 * `replaced`: the Project `id` is replaced by its Local copy `copyId` (stopping
 * sharing); never stored.
 */
export type TabMessage =
	| { kind: 'state'; name: string; vector: Uint8Array; reply: boolean }
	| { kind: 'update'; name: string; update: Uint8Array }
	| { kind: 'replaced'; id: string; copyId: string };

/** A channel to the other tabs: what is posted reaches them, never this tab. */
export type TabChannel = {
	post: (message: TabMessage) => void;
	subscribe: (listener: (message: TabMessage) => void) => () => void;
};

/** Transaction origin of the updates received from other tabs. */
export const FROM_TABS = Symbol('from other tabs');

const CHANNEL_NAME = 'simple-modelisation:tabs';
let browserChannel: TabChannel | null | undefined;

/** The browser's channel between tabs, one per tab; null without BroadcastChannel. */
export function tabChannel(): TabChannel | null {
	if (browserChannel !== undefined) return browserChannel;
	if (typeof BroadcastChannel === 'undefined') return (browserChannel = null);
	const channel = new BroadcastChannel(CHANNEL_NAME);
	const listeners = new Set<(message: TabMessage) => void>();
	channel.onmessage = (event: MessageEvent<TabMessage>) => {
		for (const listener of [...listeners]) listener(event.data);
	};
	return (browserChannel = {
		post: (message) => channel.postMessage(message),
		subscribe: (listener) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		}
	});
}

/**
 * Keeps `doc` in step with the copies of the document `name` other tabs hold,
 * until the returned function is called: its updates go to them, theirs come in
 * with the origin FROM_TABS (undo does not track them), and on joining it gets
 * what they hold that it does not, and gives them what it holds.
 */
export function joinTabs(
	name: string,
	doc: Y.Doc,
	channel: TabChannel | null = tabChannel()
): () => void {
	if (!channel) return () => {};
	const send = (update: Uint8Array, origin: unknown) => {
		if (origin !== FROM_TABS) channel.post({ kind: 'update', name, update });
	};
	const receive = (message: TabMessage) => {
		if (message.kind === 'replaced' || message.name !== name) return;
		if (message.kind === 'update') {
			Y.applyUpdate(doc, message.update, FROM_TABS);
			return;
		}
		const missing = Y.encodeStateAsUpdate(doc, message.vector);
		// Two zero bytes: nothing missing. The delete set always goes along once
		// something was deleted; applying it again changes nothing.
		if (missing.length > 2) channel.post({ kind: 'update', name, update: missing });
		if (!message.reply) {
			channel.post({ kind: 'state', name, vector: Y.encodeStateVector(doc), reply: true });
		}
	};
	const unsubscribe = channel.subscribe(receive);
	doc.on('update', send);
	channel.post({ kind: 'state', name, vector: Y.encodeStateVector(doc), reply: false });
	return () => {
		unsubscribe();
		doc.off('update', send);
	};
}

/** Tells the other tabs that the Project `id` is replaced by its Local copy `copyId`. */
export function announceReplaced(
	id: string,
	copyId: string,
	channel: TabChannel | null = tabChannel()
): void {
	channel?.post({ kind: 'replaced', id, copyId });
}

/** Calls `listener` with the Local copy's id when another tab replaces the Project `id`. */
export function subscribeReplaced(
	id: string,
	listener: (copyId: string) => void,
	channel: TabChannel | null = tabChannel()
): () => void {
	if (!channel) return () => {};
	return channel.subscribe((message) => {
		if (message.kind === 'replaced' && message.id === id) listener(message.copyId);
	});
}
