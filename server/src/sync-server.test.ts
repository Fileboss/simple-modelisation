import { HocuspocusProvider } from '@hocuspocus/provider';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { DOCUMENT_TOO_LARGE, REFUSAL, SYNC_PATH, type SyncIntent } from './protocol.ts';
import { startSyncServer, type SyncServer, type SyncServerOptions } from './sync-server.ts';

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
	options: { doc?: Y.Doc; onStateless?: (payload: string) => void } = {}
) {
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
			onStateless: ({ payload }) => options.onStateless?.(payload),
			onSynced: () => resolve({ doc, outcome: 'synced', provider }),
			onAuthenticationFailed: ({ reason }) => resolve({ doc, outcome: 'refused', provider, reason })
		});
		cleanups.push(() => provider.destroy());
	});
}

const text = (doc: Y.Doc) => doc.getText('t').toString();

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

		owner.doc.getText('t').insert(0, 'x'.repeat(5000));
		await vi.waitFor(() => expect(guest.doc.getText('t').length).toBe(5000));
		owner.doc.getText('t').insert(0, 'more');
		await vi.waitFor(() => expect(messages).toContain(DOCUMENT_TOO_LARGE));
		expect(logs.join()).toContain('document size');
		expect(text(guest.doc).startsWith('more')).toBe(false);
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
