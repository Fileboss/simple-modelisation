import { HocuspocusProvider } from '@hocuspocus/provider';
import { randomBytes } from 'node:crypto';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { DOCUMENT_TOO_LARGE, REFUSAL, SYNC_PATH, type SyncIntent } from './protocol.ts';
import {
	HEALTH_PATH,
	startSyncServer,
	type SyncServer,
	type SyncServerOptions
} from './sync-server.ts';

const cleanups: (() => unknown)[] = [];
afterEach(async () => {
	for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

async function start(options: Partial<SyncServerOptions> = {}) {
	const dataDir = options.dataDir ?? mkdtempSync(path.join(tmpdir(), 'sync-test-'));
	const logs: string[] = [];
	// A relay gets a data directory too: it must write nothing there.
	const server = await startSyncServer({ port: 0, ...options, dataDir, log: (m) => logs.push(m) });
	cleanups.push(() => server.stop());
	if (!options.dataDir) cleanups.unshift(() => rmSync(dataDir, { recursive: true, force: true }));
	return { server, dataDir, logs };
}

/** A client opening `name`; resolves once synced, or with `refused` when authentication fails. */
function connect(
	server: SyncServer,
	name: string,
	intent: SyncIntent,
	options: {
		doc?: Y.Doc;
		onStateless?: (payload: string) => void;
		/** The address a trusted proxy would report for this client. */
		from?: string;
	} = {}
) {
	const { from } = options;
	const doc = options.doc ?? new Y.Doc();
	return new Promise<{
		doc: Y.Doc;
		outcome: 'synced' | 'refused';
		provider: HocuspocusProvider;
		reason?: string;
	}>((resolve) => {
		const provider: HocuspocusProvider = new HocuspocusProvider({
			url: `ws://127.0.0.1:${server.port}${SYNC_PATH}`,
			name,
			document: doc,
			token: intent,
			// Node's WebSocket takes headers: the client then comes "through a proxy". The option
			// goes on to the provider's socket, which its own type does not say.
			...(from
				? {
						WebSocketPolyfill: class extends WebSocket {
							constructor(url: string) {
								super(url, { headers: { 'X-Forwarded-For': from } } as unknown as string[]);
							}
						}
					}
				: {}),
			onStateless: ({ payload }) => options.onStateless?.(payload),
			onSynced: () => resolve({ doc, outcome: 'synced', provider }),
			onAuthenticationFailed: ({ reason }) => resolve({ doc, outcome: 'refused', provider, reason })
		});
		cleanups.push(() => provider.destroy());
	});
}

const text = (doc: Y.Doc) => doc.getText('t').toString();

/** A raw WebSocket upgrade with the headers given: resolves with 101 or the refusal's status. */
function rawUpgrade(server: SyncServer, headers: Record<string, string>) {
	return new Promise<number>((resolve) => {
		const upgrade = request({
			port: server.port,
			host: '127.0.0.1',
			path: SYNC_PATH,
			headers: {
				Connection: 'Upgrade',
				Upgrade: 'websocket',
				'Sec-WebSocket-Version': '13',
				'Sec-WebSocket-Key': randomBytes(16).toString('base64'),
				...headers
			}
		});
		upgrade.on('upgrade', (_response, socket) => {
			socket.destroy();
			resolve(101);
		});
		upgrade.on('response', (response) => resolve(response.statusCode ?? 0));
		upgrade.on('error', () => resolve(0));
		upgrade.end();
		cleanups.push(() => upgrade.destroy());
	});
}

describe('sync server', () => {
	it('syncs edits between the clients of a shared document', async () => {
		const { server } = await start();
		const id = crypto.randomUUID();
		const owner = await connect(server, id, 'share');
		owner.doc.getText('t').insert(0, 'hello');

		const guest = await connect(server, id, 'join');
		expect(guest.outcome).toBe('synced');
		await vi.waitFor(() => expect(text(guest.doc)).toBe('hello'));

		guest.doc.getText('t').insert(5, ' world');
		await vi.waitFor(() => expect(text(owner.doc)).toBe('hello world'));
	});

	it('refuses a document name that is not a UUID', async () => {
		const { server, logs } = await start();
		const client = await connect(server, 'not-a-uuid', 'share');
		expect(client.outcome).toBe('refused');
		expect(logs.join()).toContain('document name');
	});

	it('refuses to join an unknown document, which only sharing creates', async () => {
		const { server } = await start();
		const id = crypto.randomUUID();
		expect((await connect(server, id, 'join')).outcome).toBe('refused');
		expect((await connect(server, id, 'join')).outcome).toBe('refused');

		await connect(server, id, 'share');
		expect((await connect(server, id, 'join')).outcome).toBe('synced');
	});

	it('stops taking changes on a full document and tells its clients, without disconnecting them', async () => {
		const { server, logs } = await start({ maxDocumentBytes: 2000 });
		const id = crypto.randomUUID();
		const messages: string[] = [];
		const owner = await connect(server, id, 'share', { onStateless: (m) => messages.push(m) });
		const guest = await connect(server, id, 'join');

		owner.doc.getText('t').insert(0, 'x'.repeat(1500));
		await vi.waitFor(() => expect(guest.doc.getText('t').length).toBe(1500));
		owner.doc.getText('t').insert(0, 'y'.repeat(1000));
		await vi.waitFor(() => expect(messages).toContain(DOCUMENT_TOO_LARGE));
		expect(logs.join()).toContain('document size');
		expect(text(guest.doc).startsWith('y')).toBe(false);
	});

	it('refuses a single change that would take a document past its limit', async () => {
		const { server } = await start({ maxDocumentBytes: 2000 });
		const id = crypto.randomUUID();
		const messages: string[] = [];
		const owner = await connect(server, id, 'share', { onStateless: (m) => messages.push(m) });
		const guest = await connect(server, id, 'join');

		owner.doc.getText('t').insert(0, 'x'.repeat(5000));
		await vi.waitFor(() => expect(messages).toContain(DOCUMENT_TOO_LARGE));
		// Never applied: nobody else gets it.
		await new Promise((resolve) => setTimeout(resolve, 200));
		expect(text(guest.doc)).toBe('');
	});

	it('takes back a client that resends what the server already has', async () => {
		const { server } = await start({ maxDocumentBytes: 2000 });
		const id = crypto.randomUUID();
		const owner = await connect(server, id, 'share');
		owner.doc.getText('t').insert(0, 'x'.repeat(1200));
		// A Participant with their own copy: their first sync carries all of it again.
		const copy = new Y.Doc();
		Y.applyUpdate(copy, Y.encodeStateAsUpdate(owner.doc));
		await vi.waitFor(() => expect(text(owner.doc).length).toBe(1200));
		const messages: string[] = [];
		const back = await connect(server, id, 'join', {
			doc: copy,
			onStateless: (m) => messages.push(m)
		});
		back.doc.getText('t').insert(0, 'hi');
		await vi.waitFor(() => expect(text(owner.doc).startsWith('hi')).toBe(true));
		expect(messages).not.toContain(DOCUMENT_TOO_LARGE);
	});

	it('closes a connection that sends an oversized Presence', async () => {
		const { server, logs } = await start({ maxPresenceBytes: 1000 });
		const owner = await connect(server, crypto.randomUUID(), 'share');
		const closed = new Promise<string>((resolve) =>
			owner.provider.on('close', ({ event }: { event: { reason: string } }) =>
				resolve(event.reason)
			)
		);
		owner.provider.setAwarenessField('user', { name: 'x'.repeat(2000) });
		expect(await closed).toBe('presence-size');
		expect(logs.join()).toContain('presence size');
	});

	it('limits how many documents one address creates', async () => {
		const { server, logs } = await start({ maxNewDocumentsPerIpPerHour: 2 });
		const outcomes = [];
		for (let i = 0; i < 3; i++) {
			outcomes.push((await connect(server, crypto.randomUUID(), 'share')).outcome);
		}
		expect(outcomes).toEqual(['synced', 'synced', 'refused']);
		expect(logs.join()).toContain('creation limit');
	});

	it('limits the connections of one address, whatever X-Forwarded-For claims', async () => {
		const { server, logs } = await start({ maxConnectionsPerIp: 1 });
		await connect(server, crypto.randomUUID(), 'share');
		// A raw upgrade request, since Node's WebSocket and fetch cannot set these headers.
		const upgrade = request({
			port: server.port,
			host: '127.0.0.1',
			path: SYNC_PATH,
			headers: {
				Connection: 'Upgrade',
				Upgrade: 'websocket',
				'Sec-WebSocket-Version': '13',
				'Sec-WebSocket-Key': randomBytes(16).toString('base64'),
				'X-Forwarded-For': '203.0.113.7'
			}
		});
		upgrade.on('error', () => undefined);
		upgrade.end();
		cleanups.push(() => upgrade.destroy());
		await vi.waitFor(() => expect(logs.join()).toContain('connection limit'));
	});

	it('survives a malformed URL and serves the app for client routes', async () => {
		const staticDir = mkdtempSync(path.join(tmpdir(), 'sync-static-'));
		writeFileSync(path.join(staticDir, 'index.html'), '<title>app</title>');
		cleanups.push(() => rmSync(staticDir, { recursive: true, force: true }));
		const { server } = await start({ staticDir });
		const base = `http://127.0.0.1:${server.port}`;

		expect((await fetch(`${base}/%E0%A4%A`)).status).toBe(400);
		const route = await fetch(`${base}/p/${crypto.randomUUID()}`);
		expect(await route.text()).toContain('<title>app</title>');
	});

	it('relays the Presence of a client to the others and drops it when it leaves', async () => {
		const { server } = await start();
		const id = crypto.randomUUID();
		const owner = await connect(server, id, 'share');
		const guest = await connect(server, id, 'join');

		owner.provider.setAwarenessField('presence', { name: 'Ada', color: '#2563eb' });
		const ownerId = owner.provider.awareness!.clientID;
		await vi.waitFor(() =>
			expect(guest.provider.awareness!.getStates().get(ownerId)?.presence).toEqual({
				name: 'Ada',
				color: '#2563eb'
			})
		);

		owner.provider.destroy();
		await vi.waitFor(() => expect(guest.provider.awareness!.getStates().has(ownerId)).toBe(false));
	});

	it('keeps documents across a restart', async () => {
		const first = await start();
		const id = crypto.randomUUID();
		const owner = await connect(first.server, id, 'share');
		owner.doc.getText('t').insert(0, 'kept');
		await vi.waitFor(() => expect(owner.provider.unsyncedChanges).toBe(0));
		owner.provider.destroy();
		await first.server.stop();

		const second = await start({ dataDir: first.dataDir });
		const guest = await connect(second.server, id, 'join');
		expect(guest.outcome).toBe('synced');
		await vi.waitFor(() => expect(text(guest.doc)).toBe('kept'));
	});
});

describe('relay mode (no storage)', () => {
	it('relays a Shared Project while someone has it open, then forgets it', async () => {
		const { server, dataDir } = await start({ storage: 'none' });
		const id = crypto.randomUUID();
		const owner = await connect(server, id, 'share');
		owner.doc.getText('t').insert(0, 'hello');
		const guest = await connect(server, id, 'join');
		await vi.waitFor(() => expect(text(guest.doc)).toBe('hello'));

		// Everyone leaves: the server keeps nothing, and joining says why.
		owner.provider.destroy();
		guest.provider.destroy();
		// Until the server notices they left, a probe still gets in: it leaves at once.
		await vi.waitFor(
			async () => {
				const late = await connect(server, id, 'join');
				late.provider.destroy();
				expect(late).toMatchObject({ outcome: 'refused', reason: REFUSAL.notOpen });
			},
			{ timeout: 5000, interval: 100 }
		);
		expect(readdirSync(dataDir)).toEqual([]);

		// The owner comes back with their copy: the Project is shared again, content intact.
		const back = await connect(server, id, 'share', { doc: owner.doc });
		expect(back.outcome).toBe('synced');
		const again = await connect(server, id, 'join');
		await vi.waitFor(() => expect(text(again.doc)).toBe('hello'));
	});

	it('caps the documents in memory, refusing a new share with the full reason', async () => {
		const { server } = await start({ storage: 'none', maxDocuments: 1 });
		expect((await connect(server, crypto.randomUUID(), 'share')).outcome).toBe('synced');
		const second = await connect(server, crypto.randomUUID(), 'share');
		expect(second).toMatchObject({ outcome: 'refused', reason: REFUSAL.full });
	});

	it('keeps the cap when many shares arrive at once', async () => {
		const { server } = await start({ storage: 'none', maxDocuments: 2 });
		const outcomes = await Promise.all(
			Array.from({ length: 6 }, () => connect(server, crypto.randomUUID(), 'share'))
		);
		expect(outcomes.filter((o) => o.outcome === 'synced')).toHaveLength(2);
		expect(outcomes.filter((o) => o.reason === REFUSAL.full)).toHaveLength(4);
	});

	it('judges a full document by its real size, not by every update it took', async () => {
		const { server } = await start({ storage: 'none', maxDocumentBytes: 2000 });
		const id = crypto.randomUUID();
		const messages: string[] = [];
		const owner = await connect(server, id, 'share', { onStateless: (m) => messages.push(m) });
		const guest = await connect(server, id, 'join');
		// Each value replaces the last: the updates add up past the limit, the document does not.
		for (let i = 0; i < 8; i++) {
			owner.doc.getMap('m').set('note', `${i}`.repeat(500));
			await vi.waitFor(() => expect(guest.doc.getMap('m').get('note')).toBe(`${i}`.repeat(500)));
		}
		expect(messages).not.toContain(DOCUMENT_TOO_LARGE);
	});

	it('bounds the documents one address loads, joining an open one being free', async () => {
		const { server, logs } = await start({ storage: 'none', maxDocumentsPerIp: 2 });
		const first = crypto.randomUUID();
		const a = await connect(server, first, 'share');
		expect((await connect(server, crypto.randomUUID(), 'share')).outcome).toBe('synced');
		const joined = await connect(server, first, 'join');
		expect(joined.outcome).toBe('synced');
		const third = crypto.randomUUID();
		expect(await connect(server, third, 'share')).toMatchObject({
			outcome: 'refused',
			reason: REFUSAL.full
		});
		expect(logs.join()).toContain('address document limit');

		// Once a document is forgotten, its slot is free again.
		a.provider.destroy();
		joined.provider.destroy();
		await vi.waitFor(
			async () => {
				const again = await connect(server, third, 'share');
				again.provider.destroy();
				expect(again.outcome).toBe('synced');
			},
			{ timeout: 5000, interval: 100 }
		);
	});

	it('counts a document for the addresses that have it open now', async () => {
		const { server, logs } = await start({
			storage: 'none',
			maxDocumentsPerIp: 1,
			trustProxy: true
		});
		const shared = crypto.randomUUID();
		const opener = await connect(server, shared, 'share', { from: '10.0.0.1' });
		const colleague = await connect(server, shared, 'join', { from: '10.0.0.2' });
		expect(colleague.outcome).toBe('synced');
		// Both have it open: neither may load another.
		for (const from of ['10.0.0.1', '10.0.0.2']) {
			const other = await connect(server, crypto.randomUUID(), 'share', { from });
			expect(other).toMatchObject({ outcome: 'refused', reason: REFUSAL.full });
		}
		expect(logs.join()).toContain('address document limit');
		// The opener leaves; the colleague keeps it open: it no longer counts for the opener.
		opener.provider.destroy();
		await vi.waitFor(
			async () => {
				const next = await connect(server, crypto.randomUUID(), 'share', { from: '10.0.0.1' });
				next.provider.destroy();
				expect(next.outcome).toBe('synced');
			},
			{ timeout: 5000, interval: 100 }
		);
	});

	it('has no MCP endpoint, and refuses to start with one', async () => {
		const { server } = await start({ storage: 'none' });
		const status = await new Promise<number>((resolve) => {
			request({ port: server.port, path: '/mcp', method: 'POST' }, (response) =>
				resolve(response.statusCode ?? 0)
			).end();
		});
		expect(status).toBe(404);
		await expect(startSyncServer({ port: 0, storage: 'none', mcp: true })).rejects.toThrow(
			/MCP endpoint needs storage/
		);
	});
});

describe('hardening', () => {
	it("accepts WebSocket upgrades from the app's own pages only", async () => {
		const { server, logs } = await start();
		const own = `http://127.0.0.1:${server.port}`;
		expect(await rawUpgrade(server, { Origin: 'https://evil.example' })).toBe(403);
		expect(logs.join()).toContain('origin');
		expect(await rawUpgrade(server, { Origin: 'not a url' })).toBe(403);
		expect(await rawUpgrade(server, { Origin: own })).toBe(101);
		// A proxy adding a port or changing the case still names the same host.
		expect(await rawUpgrade(server, { Origin: own, Host: `127.0.0.1:443` })).toBe(101);
		// Not a browser: no Origin.
		expect(await rawUpgrade(server, {})).toBe(101);
	});

	it('closes a connection that sends a message larger than a document', async () => {
		const { server } = await start({ maxDocumentBytes: 1000 });
		const socket = new WebSocket(`ws://127.0.0.1:${server.port}${SYNC_PATH}`);
		const closed = new Promise<number>((resolve) =>
			socket.addEventListener('close', (e) => resolve(e.code))
		);
		await new Promise((resolve) => socket.addEventListener('open', resolve));
		socket.send(new Uint8Array(200 * 1024));
		// 1009: message too big.
		expect(await closed).toBe(1009);
	});

	it('cuts off a socket that floods messages, dropping what it queued', async () => {
		const { server, logs } = await start({ maxMessagesPerWindow: 20 });
		const id = crypto.randomUUID();
		const owner = await connect(server, id, 'share');
		// Hocuspocus closes the document connection with our reason (its code goes out as 1000).
		const closed = new Promise<string>((resolve) =>
			owner.provider.on('close', ({ event }: { event: { reason: string } }) =>
				resolve(event.reason)
			)
		);
		for (let i = 0; i < 200; i++) owner.doc.getText('t').insert(0, 'x');
		expect(await closed).toBe('message-rate');
		expect(logs.join()).toContain('message rate');
	});

	it('serves the app with a strict CSP and security headers', async () => {
		const staticDir = mkdtempSync(path.join(tmpdir(), 'sync-static-'));
		writeFileSync(path.join(staticDir, 'index.html'), '<title>app</title>');
		cleanups.push(() => rmSync(staticDir, { recursive: true, force: true }));
		const { server } = await start({ staticDir });
		const response = await fetch(`http://127.0.0.1:${server.port}/`);
		expect(response.headers.get('content-security-policy')).toContain("script-src 'self'");
		expect(response.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
		expect(response.headers.get('referrer-policy')).toBe('no-referrer');
		expect(response.headers.get('x-content-type-options')).toBe('nosniff');
		// Errors too.
		const error = await fetch(`http://127.0.0.1:${server.port}/%E0%A4%A`);
		expect(error.status).toBe(400);
		expect(error.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
	});

	it('caches only the hashed bundles, wherever the app is served from', async () => {
		// A served directory whose own path holds an "assets" segment.
		const parent = mkdtempSync(path.join(tmpdir(), 'sync-static-'));
		cleanups.push(() => rmSync(parent, { recursive: true, force: true }));
		const staticDir = path.join(parent, 'assets', 'app');
		mkdirSync(path.join(staticDir, 'assets'), { recursive: true });
		writeFileSync(path.join(staticDir, 'index.html'), '<title>app</title>');
		writeFileSync(path.join(staticDir, 'assets', 'index-abc.js'), '');
		const { server } = await start({ staticDir });
		const page = await fetch(`http://127.0.0.1:${server.port}/`);
		expect(page.headers.get('cache-control')).toBe('no-cache');
		const bundle = await fetch(`http://127.0.0.1:${server.port}/assets/index-abc.js`);
		expect(bundle.headers.get('cache-control')).toContain('immutable');
	});

	it('answers /health without storage or app, with the security headers', async () => {
		const { server } = await start({ storage: 'none' });
		const health = `http://127.0.0.1:${server.port}${HEALTH_PATH}`;
		const response = await fetch(health);
		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toBe('text/plain');
		expect(response.headers.get('x-content-type-options')).toBe('nosniff');
		expect(await response.text()).toBe('ok');
		const head = await fetch(health, { method: 'HEAD' });
		expect(head.status).toBe(200);
		expect(await head.text()).toBe('');
		const post = await fetch(health, { method: 'POST' });
		expect(post.status).toBe(405);
		expect(post.headers.get('allow')).toBe('GET, HEAD');
	});

	it('trusts X-Forwarded-Host for the Origin check only behind a trusted proxy', async () => {
		const origin = { Origin: 'https://diagrams.example', 'X-Forwarded-Host': 'diagrams.example' };
		const direct = await start();
		expect(await rawUpgrade(direct.server, origin)).toBe(403);
		const proxied = await start({ trustProxy: true });
		expect(await rawUpgrade(proxied.server, origin)).toBe(101);
	});
});
