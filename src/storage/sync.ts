import { HocuspocusProvider, WebSocketStatus } from '@hocuspocus/provider';
import type * as Y from 'yjs';
import {
	DOCUMENT_TOO_LARGE,
	REFUSAL,
	SYNC_PATH,
	type SyncIntent
} from '../../server/src/protocol.ts';

/** How long a Project refused by a full server waits before asking again. */
const BUSY_RETRY_MS = 30_000;

/**
 * Local: never shared. Synced: the server has every change. Offline: changes
 * wait for the connection. Full: the document reached the server's size limit,
 * so changes stay on this device. Busy: the server holds as many documents as
 * it allows; it is asked again every half minute. Refused: the server will not
 * take this Project (a creation limit); changes stay on this device.
 */
export type SyncStatus = 'local' | 'synced' | 'offline' | 'full' | 'busy' | 'refused';

/** Where Participants exchange their Presence. */
export type Awareness = NonNullable<HocuspocusProvider['awareness']>;

export type SyncConnection = { disconnect: () => void };

type Callbacks = {
	/** Called at once with the connection's awareness, then on every status change. */
	onStatus: (status: SyncStatus, awareness: Awareness) => void;
	/** The server refused: an unknown document on join, a refused name, a full server; its reason (REFUSAL) if any. */
	onRefused?: (reason: string | undefined) => void;
};

/**
 * Syncs a Project document with the server on the page's origin, beside its
 * browser storage, and exchanges Presence through its awareness.
 */
export function connectSync(
	projectId: string,
	doc: Y.Doc,
	intent: SyncIntent,
	{ onStatus, onRefused }: Callbacks
): SyncConnection {
	let connected = false;
	let synced = false;
	let unsynced = 0;
	let full = false;
	let refusal: 'busy' | 'refused' | null = null;
	let retry: ReturnType<typeof setTimeout> | undefined;
	// The provider may report while it is being built: wait for it.
	let provider: HocuspocusProvider | undefined = undefined;
	const report = () => {
		if (!provider) return;
		const status =
			refusal ?? (full ? 'full' : connected && synced && unsynced === 0 ? 'synced' : 'offline');
		onStatus(status, provider.awareness!);
	};

	const open = () => {
		provider = new HocuspocusProvider({
			url: `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}${SYNC_PATH}`,
			name: projectId,
			document: doc,
			token: intent,
			onStatus: ({ status }) => {
				connected = status === WebSocketStatus.Connected;
				if (!connected) synced = false;
				report();
			},
			onSynced: ({ state }) => {
				synced = state;
				report();
			},
			onUnsyncedChanges: ({ number }) => {
				unsynced = number;
				report();
			},
			onStateless: ({ payload }) => {
				if (payload !== DOCUMENT_TOO_LARGE) return;
				full = true;
				report();
			},
			onAuthenticationFailed: ({ reason }) => {
				onRefused?.(reason);
				if (intent !== 'share') return;
				refusal = reason === REFUSAL.full ? 'busy' : 'refused';
				report();
				// A full server frees room as Projects close: ask again a little later, on a new
				// connection (a refused one does not authenticate again).
				if (refusal === 'busy') {
					retry = setTimeout(() => {
						refusal = null;
						provider?.destroy();
						open();
					}, BUSY_RETRY_MS);
				}
			},
			onAuthenticated: () => {
				refusal = null;
				report();
			}
		});
		report();
	};
	open();
	return {
		disconnect: () => {
			clearTimeout(retry);
			provider?.destroy();
		}
	};
}

export function shareLink(projectId: string): string {
	return `${location.origin}/s/${projectId}`;
}
