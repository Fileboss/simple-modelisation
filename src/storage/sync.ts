import { HocuspocusProvider, WebSocketStatus } from '@hocuspocus/provider';
import type * as Y from 'yjs';
import { DOCUMENT_TOO_LARGE, SYNC_PATH, type SyncIntent } from '../../server/src/protocol.ts';

/**
 * Local: never shared. Synced: the server has every change. Offline: changes
 * wait for the connection. Full: the document reached the server's size limit,
 * so changes stay on this device.
 */
export type SyncStatus = 'local' | 'synced' | 'offline' | 'full';

type Callbacks = {
	onStatus: (status: SyncStatus) => void;
	/** The server refused: an unknown document on join, or a refused name. */
	onRefused?: () => void;
};

/**
 * Syncs a Project document with the server on the page's origin, beside its
 * browser storage; returns a function that disconnects.
 */
export function connectSync(
	projectId: string,
	doc: Y.Doc,
	intent: SyncIntent,
	{ onStatus, onRefused }: Callbacks
): () => void {
	let connected = false;
	let synced = false;
	let unsynced = 0;
	let full = false;
	const report = () => {
		if (full) onStatus('full');
		else onStatus(connected && synced && unsynced === 0 ? 'synced' : 'offline');
	};

	const provider = new HocuspocusProvider({
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
		onAuthenticationFailed: () => onRefused?.()
	});
	report();
	return () => provider.destroy();
}

export function shareLink(projectId: string): string {
	return `${location.origin}/s/${projectId}`;
}
