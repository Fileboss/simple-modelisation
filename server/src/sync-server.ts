import { Database } from '@hocuspocus/extension-database';
import { Server } from '@hocuspocus/server';
import type { IncomingMessage } from 'node:http';
import type { Socket } from 'node:net';
import * as Y from 'yjs';
import { DocumentStore } from './document-store.ts';
import { DOCUMENT_TOO_LARGE, SYNC_PATH, type SyncIntent } from './protocol.ts';
import { serveStatic } from './static-files.ts';

export type SyncServerOptions = {
	port: number;
	/** Where the SQLite file lives. */
	dataDir: string;
	/** The built app to serve; without it, only the sync endpoint answers. */
	staticDir?: string;
	maxDocumentBytes?: number;
	maxConnectionsPerIp?: number;
	/** Documents one address may create (share) per hour. */
	maxNewDocumentsPerIpPerHour?: number;
	/** Take the client address from X-Forwarded-For: only behind a reverse proxy that sets it. */
	trustProxy?: boolean;
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
		dataDir,
		staticDir,
		maxDocumentBytes = 5 * 1024 * 1024,
		maxConnectionsPerIp = 50,
		maxNewDocumentsPerIpPerHour = 30,
		trustProxy = false,
		log = console.log
	} = options;
	const store = new DocumentStore(dataDir);
	const connectionsPerIp = new Map<string, number>();
	const creationsPerIp = new Map<string, number[]>();
	// Size of each open document: its stored size plus the updates applied since.
	const sizes = new Map<string, number>();

	const refuse = (reason: string, detail: string): never => {
		log(`refused ${reason}: ${detail}`);
		throw new Error(reason);
	};

	const server = new Server({
		port: options.port,
		quiet: true,
		stopOnSignals: false,
		extensions: [
			new Database({
				fetch: async ({ documentName }) => store.fetch(documentName),
				store: async ({ documentName, state }) => {
					store.store(documentName, state);
					sizes.set(documentName, state.byteLength);
				}
			})
		],

		async onRequest({ request, response }) {
			if (!staticDir) return;
			try {
				await serveStatic(staticDir, request, response);
			} catch (error) {
				// Hocuspocus rethrows hook errors from its HTTP handler, which would stop the process.
				log(`static error: ${request.url} ${String(error)}`);
				if (!response.headersSent) response.writeHead(400).end();
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
			if (!UUID.test(documentName)) refuse('document name', documentName);
			if (instance.documents.has(documentName) || store.has(documentName)) return;
			if ((token as SyncIntent) !== 'share') refuse('unknown document', documentName);

			// Creating a document: the self-declared intent proves nothing, so creations are rate limited.
			const ip = requestHeaders.get(CLIENT_IP_HEADER) ?? 'unknown';
			const recent = (creationsPerIp.get(ip) ?? []).filter((at) => Date.now() - at < HOUR);
			if (recent.length >= maxNewDocumentsPerIpPerHour) refuse('creation limit', ip);
			creationsPerIp.set(ip, [...recent, Date.now()]);
		},

		async afterLoadDocument({ documentName, document }) {
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

	await server.listen();
	let stopping: Promise<void> | undefined;
	return {
		port: server.address.port,
		// Stores pending documents, then closes; calling it again waits for the first call.
		stop: () => (stopping ??= server.destroy().then(() => store.close()))
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
