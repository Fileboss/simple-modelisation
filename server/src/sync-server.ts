import { Database } from '@hocuspocus/extension-database';
import { Server } from '@hocuspocus/server';
import type { IncomingMessage } from 'node:http';
import type { Socket } from 'node:net';
import * as Y from 'yjs';
import { DocumentStore } from './document-store.ts';
import { createMcpHandler, MCP_PATH } from './mcp.ts';
import { DOCUMENT_TOO_LARGE, REFUSAL, SYNC_PATH, type SyncIntent } from './protocol.ts';
import { serveStatic } from './static-files.ts';

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
	/** Take the client address from X-Forwarded-For: only behind a reverse proxy that sets it. */
	trustProxy?: boolean;
	/** Requests one address may make to the MCP endpoint per minute. */
	maxMcpRequestsPerMinute?: number;
	log?: (message: string) => void;
};

export type SyncServer = { port: number; stop: () => Promise<void> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const HOUR = 60 * 60 * 1000;
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
		trustProxy = false,
		log = console.log
	} = options;
	if (storage === 'none' && mcpOn) throw new Error('The MCP endpoint needs storage: set MCP=off.');
	if (storage === 'sqlite' && !dataDir) throw new Error('SQLite storage needs a data directory.');
	const store = storage === 'sqlite' && dataDir ? new DocumentStore(dataDir) : null;
	const connectionsPerIp = new Map<string, number>();
	const creationsPerIp = new Map<string, number[]>();
	// Documents allowed to open whose loading has not finished, so concurrent openings count.
	const opening = new Map<string, number>();
	const forgetStaleOpenings = () => {
		for (const [name, at] of opening) if (Date.now() - at > 30_000) opening.delete(name);
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
			const isMcp = new URL(request.url ?? '/', 'http://local').pathname === MCP_PATH;
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
			opening.set(documentName, Date.now());
			if (stored) return;

			// Creating a document: the self-declared intent proves nothing, so creations are rate
			// limited. A relay re-creates a document each time someone reopens it, and its memory
			// is bounded by the open documents and the connections per address instead.
			if (!store) return;
			const ip = requestHeaders.get(CLIENT_IP_HEADER) ?? 'unknown';
			const recent = (creationsPerIp.get(ip) ?? []).filter((at) => Date.now() - at < HOUR);
			if (recent.length >= maxNewDocumentsPerIpPerHour) {
				opening.delete(documentName);
				refuse('creation limit', ip, REFUSAL.refused);
			}
			creationsPerIp.set(ip, [...recent, Date.now()]);
		},

		async afterLoadDocument({ documentName, document }) {
			opening.delete(documentName);
			sizes.set(documentName, Y.encodeStateAsUpdate(document).byteLength);
			document.on('update', (update: Uint8Array) => {
				sizes.set(documentName, (sizes.get(documentName) ?? 0) + update.byteLength);
			});
		},

		// A full document stays readable; its connections stop sending changes and are told why.
		async beforeHandleMessage({ documentName, connection }) {
			const size = sizes.get(documentName) ?? 0;
			if (size <= maxDocumentBytes || connection.readOnly) return;
			log(`refused document size: ${documentName} ${size} bytes`);
			connection.readOnly = true;
			connection.sendStateless(DOCUMENT_TOO_LARGE);
		},

		async afterUnloadDocument({ documentName }) {
			sizes.delete(documentName);
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

	await server.listen();
	let stopping: Promise<void> | undefined;
	return {
		port: server.address.port,
		// Stores pending documents, then closes; calling it again waits for the first call.
		stop: () => (stopping ??= server.destroy().then(() => store?.close()))
	};
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
