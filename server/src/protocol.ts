// What the sync server and the app agree on; the app imports this file too.

/** The path the sync WebSocket listens on, beside the app. */
export const SYNC_PATH = '/sync';

/**
 * What a client declares when it connects, as its token: `share` may create
 * the document, `join` only opens one that exists.
 */
export type SyncIntent = 'share' | 'join';

/** Stateless message sent when a document reached its size limit: the server takes no more changes. */
export const DOCUMENT_TOO_LARGE = 'document-too-large';
