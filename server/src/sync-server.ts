import { Database } from '@hocuspocus/extension-database';
import { Server, type Document } from '@hocuspocus/server';
import type { IncomingMessage } from 'node:http';
import type { Socket } from 'node:net';
import * as Y from 'yjs';
import { DocumentStore } from './document-store.ts';
import { createMcpHandler, MCP_PATH } from './mcp.ts';
import { DOCUMENT_TOO_LARGE, REFUSAL, SYNC_PATH, type SyncIntent } from './protocol.ts';
import { SECURITY_HEADERS, serveStatic } from './static-files.ts';

export type SyncServerOptions = {
	port: number;
	/**
	 * `sqlite` keeps Shared Projects in a file; `none` makes the server a relay:
	 * a document lives in memory only while someone has it open.
	 */
	storage?: 'sqlite' | 'none';
	/** Where the SQLite file lives (sqlite storage only). */
	dataDir?: string;
	/** The MCP endpoint; it works on stored documents, so not without storage. */
	mcp?: boolean;
	/** Documents held in memory at once; past it, a new one is refused. */
	maxDocuments?: number;
	/** The built app to serve; without it, only the sync endpoint answers. */
	staticDir?: string;
	maxDocumentBytes?: number;
	maxConnectionsPerIp?: number;
	/** Documents one address may create (share) per hour. */
	maxNewDocumentsPerIpPerHour?: number;
	/** Documents one address may have loaded into memory at once (joining an open one is free). */
	maxDocumentsPerIp?: number;
	/** The largest Presence message a connection may send before it is closed. */
	maxPresenceBytes?: number;
	/** Take the client address from X-Forwarded-For: only behind a reverse proxy that sets it. */
	trustProxy?: boolean;
	/** Messages one connection may send in 10 seconds before it is closed. */
	maxMessagesPerWindow?: number;
	/** Requests one address may make to the MCP endpoint per minute. */
	maxMcpRequestsPerMinute?: number;
	log?: (message: string) => void;
};

export type SyncServer = { port: number; stop: () => Promise<void> };

/** Answers 200 while the process serves requests: for Docker's HEALTHCHECK and proxies. */
export const HEALTH_PATH = '/health';

/** Messages one connection may send in MESSAGE_WINDOW_MS before it is closed. */
const MESSAGE_WINDOW_MS = 10_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const HOUR = 60 * 60 * 1000;
// The y-protocols sync steps that carry changes.
const SYNC_STEP_2 = 1;
const SYNC_UPDATE = 2;
/** Carries the client address from the upgrade to the hooks that only see headers; any client value is overwritten. */
const CLIENT_IP_HEADER = 'x-simple-modelisation-client-ip';

/** One Node process serving the app and syncing Shared Projects (ADR 0003). */
export async function startSyncServer(options: SyncServerOptions): Promise<SyncServer> {
	const {
		storage = 'sqlite',
		dataDir,
		mcp: mcpOn = storage === 'sqlite',
		maxDocuments = 500,
		staticDir,
		maxDocumentBytes = 5 * 1024 * 1024,
		maxConnectionsPerIp = 50,
		maxNewDocumentsPerIpPerHour = 30,
		maxDocumentsPerIp = 20,
		maxPresenceBytes = 64 * 1024,
		trustProxy = false,
		maxMessagesPerWindow = 1000,
		log = console.log
	} = options;
	if (storage === 'none' && mcpOn) throw new Error('The MCP endpoint needs storage: set MCP=off.');
	if (storage === 'sqlite' && !dataDir) throw new Error('SQLite storage needs a data directory.');
	const store = storage === 'sqlite' && dataDir ? new DocumentStore(dataDir) : null;
	const connectionsPerIp = new Map<string, number>();
	const creationsPerIp = new Map<string, number[]>();
	const forgetOldCreations = (now: number) => {
		if (creationsPerIp.size < 1000) return;
		for (const [ip, times] of creationsPerIp) {
			if (now - (times.at(-1) ?? 0) >= HOUR) creationsPerIp.delete(ip);
		}
	};
	// When and at what size each document was last measured: a full encode, so once a second,
	// or once a tenth of the limit has come in since, at most.
	const measured = new Map<string, { at: number; size: number }>();
	// Messages each socket sent in its current window (MESSAGE_WINDOW_MS).
	const messageWindows = new Map<string, { start: number; count: number }>();
	const forgetStaleWindows = (now: number) => {
		if (messageWindows.size < 1000) return;
		for (const [id, window] of messageWindows) {
			if (now - window.start > MESSAGE_WINDOW_MS) messageWindows.delete(id);
		}
	};
	// Documents allowed to open whose loading has not finished, so concurrent openings count,
	// with the address opening each.
	const opening = new Map<string, { at: number; ip: string }>();
	const forgetStaleOpenings = () => {
		for (const [name, { at }] of opening) if (Date.now() - at > 30_000) opening.delete(name);
	};
	// The documents each address has open now, with its connections to each, kept by the
	// connection hooks; and the address each document was loaded for, which it counts for
	// while nobody has it open, until it is unloaded.
	const openBy = new Map<string, Map<string, number>>();
	const loadedBy = new Map<string, Set<string>>();
	const loaderOf = new Map<string, string>();
	/** Documents an address has open, is opening, or loaded and nobody has open. */
	const documentsOf = (ip: string, loaded: Map<string, Document>) => {
		const names = new Set(openBy.get(ip)?.keys());
		for (const [name, by] of opening) if (by.ip === ip) names.add(name);
		for (const name of loadedBy.get(ip) ?? []) {
			if ((loaded.get(name)?.getConnectionsCount() ?? 0) === 0) names.add(name);
		}
		return names.size;
	};
	const forgetLoader = (name: string) => {
		const ip = loaderOf.get(name);
		if (ip === undefined) return;
		loaderOf.delete(name);
		loadedBy.get(ip)?.delete(name);
		if (loadedBy.get(ip)?.size === 0) loadedBy.delete(ip);
	};
	// Size of each open document: its stored size plus the updates applied since.
	const sizes = new Map<string, number>();

	// `reason` reaches the client (REFUSAL); the log keeps what was refused, on one line. The
	// error has no message: Hocuspocus then prints no stack trace, which anyone could trigger.
	const refuse = (logged: string, detail: string, reason?: string): never => {
		log(`refused ${logged}: ${detail}`);
		throw Object.assign(new Error(), reason ? { reason } : {});
	};

	const server = new Server({
		port: options.port,
		quiet: true,
		// Room for a first sync well past the document limit, so it reaches the size check
		// and the client is told the document is too large; beyond, ws closes it (1009).
		websocketOptions: { maxPayload: maxDocumentBytes * 4 },
		stopOnSignals: false,
		extensions: store
			? [
					new Database({
						fetch: async ({ documentName }) => store.fetch(documentName),
						store: async ({ documentName, state }) => {
							store.store(documentName, state);
							sizes.set(documentName, state.byteLength);
						}
					})
				]
			: [],

		async onRequest({ request, response }) {
			// Every response of this origin, errors and MCP included.
			for (const [name, value] of Object.entries(SECURITY_HEADERS)) response.setHeader(name, value);
			const pathname = new URL(request.url ?? '/', 'http://local').pathname;
			if (pathname === HEALTH_PATH) {
				if (request.method === 'GET' || request.method === 'HEAD') {
					response.writeHead(200, { 'Content-Type': 'text/plain' }).end('ok');
				} else response.writeHead(405, { Allow: 'GET, HEAD' }).end();
				throw null;
			}
			const isMcp = pathname === MCP_PATH;
			if (!isMcp && !staticDir) return;
			try {
				if (isMcp && !mcp) response.writeHead(404).end();
				else if (isMcp) await mcp!(request, response);
				else await serveStatic(staticDir!, request, response);
			} catch (error) {
				// Hocuspocus rethrows hook errors from its HTTP handler, which would stop the process.
				log(`request error: ${request.url} ${String(error)}`);
				if (!response.headersSent) response.writeHead(isMcp ? 500 : 400).end();
			}
			// Tells Hocuspocus the response is sent.
			throw null;
		},

		async onUpgrade({ request, socket }) {
			const ip = clientIp(request, trustProxy);
			request.headers[CLIENT_IP_HEADER] = ip;
			const reject = (status: string, reason: string) => {
				log(`refused ${reason}: ${ip} ${request.url}`);
				(socket as Socket).end(`HTTP/1.1 ${status}\r\n\r\n`);
				throw null;
			};
			if (new URL(request.url ?? '/', 'http://local').pathname !== SYNC_PATH) {
				reject('404 Not Found', 'path');
			}
			// Only the app's own pages: another site must not drive a visitor's browser here,
			// nor use this server as its sync backend. Clients without an Origin are not browsers
			// and could send any header: the check is not for them.
			if (!sameOrigin(request, trustProxy)) reject('403 Forbidden', 'origin');
			const count = connectionsPerIp.get(ip) ?? 0;
			if (count >= maxConnectionsPerIp) reject('429 Too Many Requests', 'connection limit');
			connectionsPerIp.set(ip, count + 1);
			(socket as Socket).once('close', () => {
				const left = (connectionsPerIp.get(ip) ?? 1) - 1;
				if (left > 0) connectionsPerIp.set(ip, left);
				else connectionsPerIp.delete(ip);
			});
		},

		async onAuthenticate({ documentName, token, instance, requestHeaders }) {
			if (!UUID.test(documentName)) refuse('document name', documentName, REFUSAL.refused);
			const loaded = instance.documents.get(documentName);
			const sharing = (token as SyncIntent) === 'share';
			// A relay's document with nobody left is being forgotten: joining it would attach to
			// what is about to go. The one who shares it brings it back.
			if (loaded && (store || sharing || loaded.getConnectionsCount() > 0)) return;
			const stored = store?.has(documentName) ?? false;
			if (!stored && !sharing) {
				refuse('unknown document', documentName, store ? undefined : REFUSAL.notOpen);
			}
			// Opening one more document: memory is bounded, openings still loading included.
			forgetStaleOpenings();
			const open = instance.documents.size + opening.size;
			if (!opening.has(documentName) && open >= maxDocuments) {
				refuse('document limit', `${open} open`, REFUSAL.full);
			}
			// And so is each address's share of it: one client must not take every slot. A document
			// counts for every address that has it open, not only for the one that loaded it.
			const ip = requestHeaders.get(CLIENT_IP_HEADER) ?? 'unknown';
			const mine = !opening.has(documentName);
			if (mine) {
				if (documentsOf(ip, instance.documents) >= maxDocumentsPerIp) {
					refuse('address document limit', ip, REFUSAL.full);
				}
				opening.set(documentName, { at: Date.now(), ip });
			}
			if (stored) return;

			// Creating a document: the self-declared intent proves nothing, so creations are rate
			// limited. A relay re-creates a document each time someone reopens it, and its memory
			// is bounded by the open documents, per address too, instead.
			if (!store) return;
			const now = Date.now();
			const recent = (creationsPerIp.get(ip) ?? []).filter((at) => now - at < HOUR);
			if (recent.length >= maxNewDocumentsPerIpPerHour) {
				// Only this opening is undone: another client's of the same document stays counted.
				if (mine) opening.delete(documentName);
				refuse('creation limit', ip, REFUSAL.refused);
			}
			creationsPerIp.set(ip, [...recent, now]);
			forgetOldCreations(now);
		},

		async connected({ documentName, requestHeaders }) {
			const ip = requestHeaders.get(CLIENT_IP_HEADER) ?? 'unknown';
			const documents = openBy.get(ip) ?? new Map<string, number>();
			documents.set(documentName, (documents.get(documentName) ?? 0) + 1);
			openBy.set(ip, documents);
		},

		async onDisconnect({ documentName, requestHeaders }) {
			const ip = requestHeaders.get(CLIENT_IP_HEADER) ?? 'unknown';
			const documents = openBy.get(ip);
			const left = (documents?.get(documentName) ?? 1) - 1;
			if (left > 0) documents?.set(documentName, left);
			else documents?.delete(documentName);
			if (documents?.size === 0) openBy.delete(ip);
		},

		async afterLoadDocument({ documentName, document }) {
			const ip = opening.get(documentName)?.ip;
			if (ip !== undefined) {
				loaderOf.set(documentName, ip);
				loadedBy.set(ip, (loadedBy.get(ip) ?? new Set()).add(documentName));
			}
			opening.delete(documentName);
			sizes.set(documentName, Y.encodeStateAsUpdate(document).byteLength);
			document.on('update', (update: Uint8Array) => {
				sizes.set(documentName, (sizes.get(documentName) ?? 0) + update.byteLength);
			});
		},

		// A socket flooding messages is cut off: thrown, the error closes it and drops what it
		// queued. Counted per socket, so re-authenticating or spreading over documents does
		// not start a new count.
		async beforeHandleMessage({ documentName, socketId }) {
			const now = Date.now();
			const window = messageWindows.get(socketId);
			if (!window || now - window.start > MESSAGE_WINDOW_MS) {
				messageWindows.set(socketId, { start: now, count: 1 });
				forgetStaleWindows(now);
			} else if (++window.count > maxMessagesPerWindow) {
				log(`refused message rate: ${documentName}`);
				throw Object.assign(new Error(), { code: 1008, reason: 'message-rate' });
			}
		},

		// A change that would take the document past its limit is not applied: the connection
		// stays readable, stops sending changes and is told why. `payload` is the very update
		// Hocuspocus applies next.
		async beforeSync({ documentName, document, connection, type, payload }) {
			if ((type !== SYNC_STEP_2 && type !== SYNC_UPDATE) || connection.readOnly) return;
			const running = sizes.get(documentName) ?? 0;
			let size = running + payload.byteLength;
			if (size <= maxDocumentBytes) return;
			// A client coming back resends what the server already has: count what it adds.
			const adds = () => Y.diffUpdate(payload, Y.encodeStateVector(document)).byteLength;
			size = running + adds();
			// The running size grows with every update, even those that replace content: past the
			// limit, the real size is measured, if not too lately.
			const now = Date.now();
			const last = measured.get(documentName);
			const due = !last || now - last.at >= 1000 || running - last.size >= maxDocumentBytes / 10;
			if (size > maxDocumentBytes && due) {
				const real = Y.encodeStateAsUpdate(document).byteLength;
				measured.set(documentName, { at: now, size: real });
				sizes.set(documentName, real);
				size = real + adds();
			}
			if (size <= maxDocumentBytes) return;
			log(`refused document size: ${documentName} ${size} bytes`);
			connection.readOnly = true;
			connection.sendStateless(DOCUMENT_TOO_LARGE);
		},

		// The app's Presence is a name, a color, a cursor and a bounded selection: an update
		// past the bound, however its bytes were framed, closes its connection.
		async beforeHandleAwareness({ documentName, states }) {
			let bytes = 0;
			for (const state of states.values()) bytes += JSON.stringify(state).length + 8;
			if (bytes <= maxPresenceBytes) return;
			log(`refused presence size: ${documentName} ${bytes} bytes`);
			throw Object.assign(new Error(), { code: 1008, reason: 'presence-size' });
		},

		async afterUnloadDocument({ documentName }) {
			sizes.delete(documentName);
			measured.delete(documentName);
			forgetLoader(documentName);
		}
	});

	const mcp =
		mcpOn && store
			? createMcpHandler({
					instance: server.hocuspocus,
					store,
					maxDocuments,
					log,
					maxRequestsPerMinute: options.maxMcpRequestsPerMinute ?? 120,
					maxDocumentBytes,
					clientIp: (request) => clientIp(request, trustProxy)
				})
			: null;

	// Slow clients (headers sent a byte at a time) must not hold sockets for long.
	server.httpServer.headersTimeout = 10_000;
	server.httpServer.requestTimeout = 30_000;
	// Node checks those every 30 s (an option of the HTTP server Hocuspocus creates): a slow
	// client goes within about 40 s.
	server.httpServer.keepAliveTimeout = 5_000;
	await server.listen();
	let stopping: Promise<void> | undefined;
	return {
		port: server.address.port,
		// Stores pending documents, then closes; calling it again waits for the first call.
		stop: () => (stopping ??= server.destroy().then(() => store?.close()))
	};
}

/**
 * A browser's request from the app's own pages: its Origin names the host it
 * asks (the proxy's X-Forwarded-Host when trusted, else Host). Host names are
 * compared, not ports: a proxy may add one. No Origin is no browser.
 */
function sameOrigin(request: IncomingMessage, trustProxy: boolean): boolean {
	const origin = request.headers.origin;
	if (!origin) return true;
	const forwarded = request.headers['x-forwarded-host'];
	const asked =
		(trustProxy && (Array.isArray(forwarded) ? forwarded[0] : forwarded)) || request.headers.host;
	try {
		return new URL(origin).hostname === new URL(`http://${asked}`).hostname;
	} catch {
		return false;
	}
}

function clientIp(request: IncomingMessage, trustProxy: boolean): string {
	if (trustProxy) {
		// The proxy appends the address it saw: the last entry is the one it vouches for.
		const forwarded = request.headers['x-forwarded-for'];
		const last = (Array.isArray(forwarded) ? forwarded.join(',') : forwarded)
			?.split(',')
			.at(-1)
			?.trim();
		if (last) return last;
	}
	return request.socket.remoteAddress ?? 'unknown';
}
