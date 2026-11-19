// What the sync server and the app agree on; the app imports this file too.

/** The path the sync WebSocket listens on, beside the app. */
export const SYNC_PATH = '/sync';

/**
 * What a client declares when it connects, as its token: `share` may create
 * the document, `join` only opens one that exists.
 */
export type SyncIntent = 'share' | 'join';

/** Why the server refused to open a document, as the client receives it. */
export const REFUSAL = {
	/** Relay mode: the document lives only while someone has it open, and nobody has. */
	notOpen: 'not-open',
	/** The server holds as many documents in memory as it allows: try again later. */
	full: 'server-full',
	/** Refused for good (a creation limit, a bad name): changes stay on this device. */
	refused: 'refused'
} as const;

/** Stateless message sent when a document reached its size limit: the server takes no more changes. */
export const DOCUMENT_TOO_LARGE = 'document-too-large';
