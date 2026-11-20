import { HocuspocusProvider } from '@hocuspocus/provider';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { anyOverlap, estimatedSize } from '@simple-modelisation/model/layout.ts';
import { ProjectDocument } from '@simple-modelisation/model/project.ts';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { freeSpot, parseDataType, SLOT } from './mcp-write.ts';
import { SYNC_PATH } from './protocol.ts';
import { startSyncServer, type SyncServer } from './sync-server.ts';

const cleanups: (() => unknown)[] = [];
afterEach(async () => {
	for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

async function setup(options: { maxDocumentBytes?: number } = {}) {
	const dataDir = mkdtempSync(path.join(tmpdir(), 'mcp-test-'));
	cleanups.push(() => rmSync(dataDir, { recursive: true, force: true }));
	const server = await startSyncServer({ port: 0, dataDir, log: () => undefined, ...options });
	cleanups.push(() => server.stop());
	const id = crypto.randomUUID();
	const browser = await share(server, id);
	const client = new Client({ name: 'test-agent', version: '1.0.0' });
	await client.connect(
		new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${server.port}/mcp`))
	);
	cleanups.push(() => client.close());
	return { server, id, link: `https://example.test/s/${id}`, browser, client };
}

/** A browser that shared a Project with one System design diagram and one MCD. */
async function share(server: SyncServer, id: string) {
	const doc = new Y.Doc();
	const project = new ProjectDocument(doc);
	project.rename('Shop');
	project.addDiagram('system', 'Architecture');
	project.addDiagram('mcd', 'Data');
	await new Promise<void>((resolve) => {
		const provider = new HocuspocusProvider({
			url: `ws://127.0.0.1:${server.port}${SYNC_PATH}`,
			name: id,
			document: doc,
			token: 'share',
			onSynced: () => resolve()
		});
		cleanups.push(() => provider.destroy());
	});
	return project;
}

async function call(client: Client, name: string, args: Record<string, unknown>) {
	const result = (await client.callTool({ name, arguments: args })) as {
		isError?: boolean;
		content: { text: string }[];
	};
	const text = result.content[0].text;
	return result.isError ? { error: text } : JSON.parse(text);
}

describe('MCP endpoint', () => {
	it('lists the tools, none of which lists or creates Projects', async () => {
		const { client } = await setup();
		const { tools } = await client.listTools();
		expect(tools.map((t) => t.name).sort()).toEqual([
			'add_association',
			'add_attribute',
			'add_cif',
			'add_component',
			'add_diagram',
			'add_entity',
			'add_leg',
			'add_note',
			'add_zone',
			'connect_components',
			'delete_elements',
			'export_diagram',
			'get_diagram',
			'get_mcd_sql',
			'get_project',
			'layout_diagram',
			'rename_element',
			'set_cardinality',
			'set_component',
			'set_connection',
			'set_disk_kind',
			'set_hosting',
			'set_inheritance',
			'set_inheritance_options',
			'set_note',
			'set_provider',
			'set_runtime',
			'set_skin',
			'set_zone'
		]);
	});

	it('says what the data of a Connection does, and changes its label and Flow', async () => {
		const { client, id } = await setup();
		const at = { project: id, diagram: 'Architecture' };
		await call(client, 'add_component', { ...at, type: 'service', name: 'platform' });
		await call(client, 'add_component', { ...at, type: 'database', name: 'material' });
		await call(client, 'add_component', { ...at, type: 'database', name: 'KDP' });
		await call(client, 'connect_components', {
			...at,
			from: 'platform',
			to: 'material',
			flow: 'read-write'
		});
		const { id: kdp } = await call(client, 'connect_components', {
			...at,
			from: 'platform',
			to: 'KDP',
			label: 'SQL'
		});
		await call(client, 'set_connection', {
			...at,
			connection: kdp,
			label: 'nightly',
			flow: 'read'
		});
		const read = async () =>
			(await call(client, 'get_diagram', at)).connections.map(
				(c: { to: string; label: string; flow: string | null }) => [c.to, c.label, c.flow]
			);
		expect(await read()).toEqual([
			['material', '', 'read-write'],
			['KDP', 'nightly', 'read']
		]);
		await call(client, 'set_connection', { ...at, connection: kdp, label: '', flow: 'none' });
		expect((await read())[1]).toEqual(['KDP', '', null]);
		const { connections } = await call(client, 'get_diagram', at);
		const unknown = await call(client, 'set_connection', {
			...at,
			connection: 'nope',
			flow: 'read'
		});
		expect(unknown.error).toBe(
			`No connection "nope". Known: ${connections[0].id} (platform → material), ${kdp} (platform → KDP).`
		);
		const empty = await call(client, 'set_connection', { ...at, connection: kdp });
		expect(empty.error).toBe('Give a label or a flow.');
	});

	it('reads a Shared Project from its Share link', async () => {
		const { client, link } = await setup();
		const project = await call(client, 'get_project', { project: link });
		expect(project).toMatchObject({
			name: 'Shop',
			diagrams: [
				{ name: 'Architecture', kind: 'system design' },
				{ name: 'Data', kind: 'mcd' }
			]
		});
	});

	it("draws in a System design diagram, live in the browser's document", async () => {
		const { client, id, browser } = await setup();
		await call(client, 'add_component', {
			project: id,
			diagram: 'Architecture',
			type: 'service',
			name: 'API'
		});
		await call(client, 'add_component', {
			project: id,
			diagram: 'Architecture',
			type: 'database',
			name: 'DB',
			skin: 'postgresql'
		});
		await call(client, 'connect_components', {
			project: id,
			diagram: 'Architecture',
			from: 'API',
			to: 'DB',
			label: 'SQL'
		});
		const diagram = browser.diagrams()[0].id;
		await vi.waitFor(() => expect(browser.edges(diagram)).toHaveLength(1));
		expect(browser.nodes(diagram).map((n) => [n.name, n.skin])).toEqual([
			['API', null],
			['DB', 'postgresql']
		]);
		const [api, db] = browser.nodes(diagram);
		expect(api.x === db.x && api.y === db.y).toBe(false);
	});

	it('arranges a Diagram along its Connections', async () => {
		const { client, id, browser } = await setup();
		// No Client here: a Connection into a Client would rank it first.
		for (const [type, name] of [
			['service', 'Web'],
			['gateway', 'API'],
			['database', 'DB']
		]) {
			await call(client, 'add_component', { project: id, diagram: 'Architecture', type, name });
		}
		await call(client, 'connect_components', {
			project: id,
			diagram: 'Architecture',
			from: 'DB',
			to: 'API'
		});
		await call(client, 'connect_components', {
			project: id,
			diagram: 'Architecture',
			from: 'API',
			to: 'Web'
		});
		expect(
			await call(client, 'layout_diagram', { project: id, diagram: 'Architecture' })
		).toMatchObject({
			arranged: 3
		});
		const diagram = browser.diagrams()[0].id;
		const x = (name: string) => browser.nodes(diagram).find((n) => n.name === name)!.x;
		await vi.waitFor(() => expect(x('DB') < x('API') && x('API') < x('Web')).toBe(true));
		// No two Components overlap at the sizes the server assumed.
		expect(anyOverlap(browser.nodes(diagram).map((n) => ({ ...n, ...estimatedSize(n) })))).toBe(
			false
		);
	});

	it('groups Components in nested Zones, kept through a layout', async () => {
		const { client, id, browser } = await setup();
		const at = { project: id, diagram: 'Architecture' };
		await call(client, 'add_zone', { ...at, name: 'eu-west-1' });
		await call(client, 'add_zone', { ...at, name: 'VPC', zone: 'eu-west-1' });
		for (const [type, name, zone] of [
			['client', 'Browser', undefined],
			['service', 'API', 'VPC'],
			['database', 'DB', 'VPC'],
			['cache', 'Cache', 'eu-west-1']
		]) {
			await call(client, 'add_component', { ...at, type, name, zone });
		}
		await call(client, 'connect_components', { ...at, from: 'Browser', to: 'API' });
		await call(client, 'connect_components', { ...at, from: 'API', to: 'DB' });
		await call(client, 'connect_components', { ...at, from: 'API', to: 'Cache' });

		const zonesOf = async () => {
			const { zones, components } = await call(client, 'get_diagram', at);
			return Object.fromEntries(
				[...zones, ...components].map((e: { name: string; zone: { name: string } | null }) => [
					e.name,
					e.zone?.name ?? null
				])
			);
		};
		const expected = {
			'eu-west-1': null,
			VPC: 'eu-west-1',
			Browser: null,
			API: 'VPC',
			DB: 'VPC',
			Cache: 'eu-west-1'
		};
		expect(await zonesOf()).toEqual(expected);
		await call(client, 'layout_diagram', at);
		expect(await zonesOf()).toEqual(expected);

		// Moving a Zone takes its content along.
		const diagram = browser.diagrams()[0].id;
		await vi.waitFor(() => expect(browser.nodes(diagram)).toHaveLength(6));
		const before = browser.nodes(diagram).find((n) => n.name === 'DB')!;
		const vpc = browser.nodes(diagram).find((n) => n.name === 'VPC')!;
		await call(client, 'set_zone', {
			...at,
			zone: 'VPC',
			name: 'VPC prod',
			x: vpc.x + 100,
			y: vpc.y
		});
		await vi.waitFor(() =>
			expect(browser.nodes(diagram).find((n) => n.name === 'DB')!.x).toBe(before.x + 100)
		);
		expect((await zonesOf()).DB).toBe('VPC prod');

		const refused = await call(client, 'connect_components', {
			...at,
			from: 'API',
			to: 'VPC prod'
		});
		expect(refused.error).toMatch(/No component/);
	});

	it('grows a Zone without changing what any Zone holds', async () => {
		const { client, id } = await setup();
		const at = { project: id, diagram: 'Architecture' };
		await call(client, 'add_zone', { ...at, name: 'Region' });
		await call(client, 'add_zone', { ...at, name: 'Subnet', zone: 'Region' });
		await call(client, 'add_component', { ...at, type: 'cache', name: 'Cache', zone: 'Region' });
		await call(client, 'add_component', { ...at, type: 'client', name: 'Browser' });
		// Each one grows the Subnet, pushing the Cache beside it and the Browser beyond.
		for (const name of ['A', 'B', 'C', 'D', 'E', 'F']) {
			await call(client, 'add_component', { ...at, type: 'service', name, zone: 'Subnet' });
		}
		const { zones, components } = await call(client, 'get_diagram', at);
		const zoneOf = Object.fromEntries(
			[...zones, ...components].map((e: { name: string; zone: { name: string } | null }) => [
				e.name,
				e.zone?.name ?? null
			])
		);
		expect(zoneOf).toMatchObject({
			Subnet: 'Region',
			Cache: 'Region',
			Browser: null,
			A: 'Subnet',
			F: 'Subnet'
		});
	});

	it('says whose infrastructure Components run on', async () => {
		const { client, id } = await setup();
		const at = { project: id, diagram: 'Architecture' };
		await call(client, 'add_component', {
			...at,
			type: 'database',
			name: 'DB',
			hosting: 'managed',
			provider: 'scaleway'
		});
		await call(client, 'add_component', { ...at, type: 'service', name: 'API' });
		await call(client, 'set_provider', { ...at, component: 'API', provider: 'hetzner' });
		const read = async () =>
			(await call(client, 'get_diagram', at)).components.map(
				(c: { name: string; hosting: string | null; provider: string | null }) => [
					c.name,
					c.hosting,
					c.provider
				]
			);
		expect(await read()).toEqual([
			['DB', 'managed', 'scaleway'],
			['API', null, 'hetzner']
		]);
		await call(client, 'set_provider', { ...at, component: 'API', provider: 'none' });
		expect((await read())[1]).toEqual(['API', null, null]);
	});

	it('gives Components the new Skins, only on the types that offer them', async () => {
		const { client, id } = await setup();
		const at = { project: id, diagram: 'Architecture' };
		await call(client, 'add_component', { ...at, type: 'gateway', name: 'Proxy', skin: 'caddy' });
		await call(client, 'add_component', { ...at, type: 'service', name: 'Finance' });
		await call(client, 'set_skin', { ...at, component: 'Finance', skin: 'nextjs' });
		const refused = await call(client, 'set_skin', {
			...at,
			component: 'Finance',
			skin: 'tailscale'
		});
		expect(refused.error).toMatch(/No "tailscale" Skin/);
		const { components } = await call(client, 'get_diagram', at);
		expect(components.map((c: { name: string; skin: string }) => [c.name, c.skin])).toEqual([
			['Proxy', 'caddy'],
			['Finance', 'nextjs']
		]);
		// Runtimes are no longer Skins.
		const runtime = await call(client, 'set_skin', { ...at, component: 'Finance', skin: 'bun' });
		expect(runtime.error).toMatch(
			/No "bun" Skin for this Component\. "bun" is a service's runtime/
		);
	});

	it('writes Notes on both kinds of Diagram, beside an element or in a free spot', async () => {
		const { client, id } = await setup();
		const at = { project: id, diagram: 'Architecture' };
		await call(client, 'add_component', { ...at, type: 'service', name: 'platform' });
		const { id: note } = await call(client, 'add_note', {
			...at,
			text: 'Syncs every night at 2 a.m.',
			near: 'platform'
		});
		await call(client, 'set_note', { ...at, note, color: 'pink' });
		const system = await call(client, 'get_diagram', at);
		expect(system.notes).toEqual([
			{ id: note, text: 'Syncs every night at 2 a.m.', color: 'pink', zone: null }
		]);
		const unknown = await call(client, 'set_note', { ...at, note: 'nope', text: 'x' });
		expect(unknown.error).toBe(`No note "nope". Known: ${note}.`);
		const empty = await call(client, 'set_note', { ...at, note });
		expect(empty.error).toBe('Give a text or a color.');

		await call(client, 'add_diagram', { project: id, kind: 'mcd', name: 'Rules' });
		const added = await call(client, 'add_note', {
			project: id,
			diagram: 'Rules',
			text: 'GDPR: personal data'
		});
		expect(added.error).toBeUndefined();
		const mcd = await call(client, 'get_diagram', { project: id, diagram: 'Rules' });
		expect(mcd.notes).toEqual([
			expect.objectContaining({ text: 'GDPR: personal data', color: 'yellow' })
		]);
		const sql = await call(client, 'get_mcd_sql', { project: id, diagram: 'Rules' });
		expect(sql.warnings).toEqual([]);
	});

	it('draws Persons with a role, without hosting or provider', async () => {
		const { client, id } = await setup();
		const at = { project: id, diagram: 'Architecture' };
		await call(client, 'add_component', { ...at, type: 'person', name: 'Buyer', skin: 'customer' });
		const hosted = await call(client, 'add_component', {
			...at,
			type: 'person',
			name: 'Ops',
			hosting: 'docker'
		});
		expect(hosted.error).toBe('A person has no hosting.');
		const provided = await call(client, 'add_component', {
			...at,
			type: 'person',
			name: 'Ops',
			provider: 'aws'
		});
		expect(provided.error).toBe('A person has no provider.');
		const setHosting = await call(client, 'set_hosting', {
			...at,
			component: 'Buyer',
			hosting: 'vm'
		});
		expect(setHosting.error).toBe('A person has no hosting.');
		const setProvider = await call(client, 'set_provider', {
			...at,
			component: 'Buyer',
			provider: 'aws'
		});
		expect(setProvider.error).toBe('A person has no provider.');
		// Clearing is harmless and accepted.
		const cleared = await call(client, 'set_hosting', {
			...at,
			component: 'Buyer',
			hosting: 'none'
		});
		expect(cleared.error).toBeUndefined();
		const wrongRole = await call(client, 'add_component', {
			...at,
			type: 'service',
			name: 'API',
			skin: 'admin'
		});
		expect(wrongRole.error).toMatch(/No "admin" Skin for a service/);
		const { components } = await call(client, 'get_diagram', at);
		expect(components).toEqual([
			expect.objectContaining({ name: 'Buyer', type: 'person', skin: 'customer', hosting: null })
		]);
	});

	it('says what runs a service, only on services', async () => {
		const { client, id } = await setup();
		const at = { project: id, diagram: 'Architecture' };
		await call(client, 'add_component', {
			...at,
			type: 'service',
			name: 'Web',
			skin: 'nextjs',
			runtime: 'bun'
		});
		await call(client, 'add_component', { ...at, type: 'service', name: 'Indexer' });
		await call(client, 'set_runtime', { ...at, service: 'Indexer', runtime: 'rust' });
		const onDatabase = await call(client, 'add_component', {
			...at,
			type: 'database',
			name: 'DB',
			runtime: 'nodejs'
		});
		expect(onDatabase.error).toBe('Only a service has a runtime.');
		await call(client, 'add_component', { ...at, type: 'database', name: 'DB' });
		const notAService = await call(client, 'set_runtime', { ...at, service: 'DB', runtime: 'go' });
		expect(notAService.error).toBe('Only a service has a runtime.');
		const read = async () =>
			(await call(client, 'get_diagram', at)).components.map(
				(c: { name: string; runtime?: string | null }) => [c.name, c.runtime]
			);
		expect(await read()).toEqual([
			['Web', 'bun'],
			['Indexer', 'rust'],
			['DB', undefined]
		]);
		await call(client, 'set_runtime', { ...at, service: 'Web', runtime: 'none' });
		expect((await read())[0]).toEqual(['Web', null]);
	});

	it('draws Disks with their kind', async () => {
		const { client, id } = await setup();
		const at = { project: id, diagram: 'Architecture' };
		await call(client, 'add_component', {
			...at,
			type: 'disk',
			name: 'SSD 2 To',
			disk_kind: 'ssd'
		});
		await call(client, 'add_component', { ...at, type: 'disk', name: 'USB 12 To' });
		await call(client, 'set_disk_kind', { ...at, disk: 'USB 12 To', kind: 'usb' });
		const misplaced = await call(client, 'add_component', {
			...at,
			type: 'service',
			name: 'API',
			disk_kind: 'ssd'
		});
		expect(misplaced.error).toMatch(/Only a disk/);
		const skinned = await call(client, 'set_skin', { ...at, component: 'SSD 2 To', skin: 's3' });
		expect(skinned.error).toBe('This Component takes no Skin.');
		await call(client, 'add_component', { ...at, type: 'service', name: 'API' });
		const notADisk = await call(client, 'set_disk_kind', { ...at, disk: 'API', kind: 'ssd' });
		expect(notADisk.error).toBe('Only a disk has a kind.');
		const { components } = await call(client, 'get_diagram', at);
		expect(
			components.map((c: { name: string; type: string; disk_kind?: string }) => [
				c.name,
				c.type,
				c.disk_kind
			])
		).toEqual([
			['SSD 2 To', 'disk', 'ssd'],
			['USB 12 To', 'disk', 'usb'],
			['API', 'service', undefined]
		]);
	});

	it("gives Components their Zone's Provider unless they have their own", async () => {
		const { client, id } = await setup();
		const at = { project: id, diagram: 'Architecture' };
		await call(client, 'add_zone', { ...at, name: 'VPS', provider: 'ovhcloud' });
		await call(client, 'add_component', { ...at, type: 'gateway', name: 'Caddy', zone: 'VPS' });
		await call(client, 'add_component', { ...at, type: 'service', name: 'App', zone: 'VPS' });
		await call(client, 'set_provider', { ...at, component: 'App', provider: 'scaleway' });
		const read = async () => {
			const { zones, components } = await call(client, 'get_diagram', at);
			return {
				zone: zones[0].provider,
				components: components.map(
					(c: {
						name: string;
						provider: string | null;
						provider_from: { name: string } | null;
					}) => [c.name, c.provider, c.provider_from?.name ?? null]
				)
			};
		};
		expect(await read()).toEqual({
			zone: 'ovhcloud',
			components: [
				['Caddy', 'ovhcloud', 'VPS'],
				['App', 'scaleway', null]
			]
		});
		await call(client, 'set_zone', { ...at, zone: 'VPS', provider: 'none' });
		expect((await read()).components[0]).toEqual(['Caddy', null, null]);
	});

	it('changes a Component in place: type, name, position, Zone', async () => {
		const { client, id, browser } = await setup();
		const at = { project: id, diagram: 'Architecture' };
		await call(client, 'add_zone', { ...at, name: 'Server' });
		await call(client, 'add_component', { ...at, type: 'service', name: 'API' });
		const { id: data } = await call(client, 'add_component', {
			...at,
			type: 'storage',
			name: 'Data',
			skin: 'minio',
			hosting: 'bare-metal',
			provider: 'hetzner'
		});
		await call(client, 'connect_components', { ...at, from: 'API', to: 'Data', label: 'files' });

		await call(client, 'set_component', { ...at, component: 'Data', type: 'disk', name: 'SSD' });
		await call(client, 'set_disk_kind', { ...at, disk: 'SSD', kind: 'ssd' });
		const read = async () => {
			const diagram = await call(client, 'get_diagram', at);
			const ssd = diagram.components.find((c: { id: string }) => c.id === data);
			return { ssd, connections: diagram.connections };
		};
		expect((await read()).ssd).toMatchObject({
			name: 'SSD',
			type: 'disk',
			skin: null,
			hosting: 'bare-metal',
			provider: 'hetzner',
			disk_kind: 'ssd',
			zone: null
		});
		expect((await read()).connections).toMatchObject([{ from: 'API', to: 'SSD', label: 'files' }]);

		await call(client, 'set_component', { ...at, component: data, zone: 'Server' });
		expect((await read()).ssd.zone).toMatchObject({ name: 'Server' });
		// A much longer name widens the box: its Zone grows rather than lose it.
		await call(client, 'set_component', {
			...at,
			component: data,
			name: 'SSD 2 To /mnt/data (photos, vidéos, Kiwix, cartes Europe)'
		});
		expect((await read()).ssd.zone).toMatchObject({ name: 'Server' });
		await call(client, 'set_component', { ...at, component: data, zone: 'none' });
		expect((await read()).ssd.zone).toBeNull();

		const both = await call(client, 'set_component', {
			...at,
			component: data,
			x: 0,
			zone: 'Missing'
		});
		expect(both.error).toBe('Give a position or a zone, not both.');
		await call(client, 'set_component', { ...at, component: data, x: 2000, y: 40 });
		await call(client, 'set_component', { ...at, component: data, y: 90 });
		const diagram = browser.diagrams()[0].id;
		await vi.waitFor(() =>
			expect(browser.nodes(diagram).find((n) => n.id === data)).toMatchObject({ x: 2000, y: 90 })
		);
	});

	it('refuses a blank name, which no read would show', async () => {
		const { client, id } = await setup();
		const at = { project: id, diagram: 'Architecture' };
		const blank = await call(client, 'add_component', { ...at, type: 'service', name: '   ' });
		expect(blank.error).toBeTruthy();
		await call(client, 'add_component', { ...at, type: 'service', name: '  API  ' });
		const project = await call(client, 'get_diagram', at);
		expect(JSON.stringify(project)).toContain('"API"');
	});

	it('exports System design diagrams as plain SVG, MCDs left out with a note', async () => {
		const { client, id } = await setup();
		const at = { project: id, diagram: 'Architecture' };
		await call(client, 'add_component', { ...at, type: 'service', name: 'API' });
		await call(client, 'add_component', {
			...at,
			type: 'database',
			name: 'DB',
			skin: 'postgresql'
		});
		await call(client, 'connect_components', { ...at, from: 'API', to: 'DB', label: 'SQL' });

		const one = await client.callTool({ name: 'export_diagram', arguments: at });
		const [note, image] = one.content as [
			{ text: string },
			{ resource: { mimeType: string; text: string } }
		];
		expect(note.text).toBe('Architecture drawn as SVG.');
		expect(image.resource.mimeType).toBe('image/svg+xml');
		expect(image.resource.text).toMatch(/^<svg xmlns/);
		expect(image.resource.text).toContain('>SQL</text>');
		expect(image.resource.text).not.toContain('foreignObject');

		const all = await client.callTool({ name: 'export_diagram', arguments: { project: id } });
		expect((all.content as { text?: string }[])[0].text).toBe(
			'Architecture drawn as SVG. Not drawn yet (MCDs): Data.'
		);
		const mcd = await call(client, 'export_diagram', { project: id, diagram: 'Data' });
		expect(mcd.error).toMatch(/is not a System design diagram/);
	});

	it('draws a Legend in exported images unless told not to', async () => {
		const { client, id } = await setup();
		const at = { project: id, diagram: 'Architecture' };
		await call(client, 'add_component', {
			...at,
			type: 'database',
			name: 'DB',
			hosting: 'managed'
		});
		const svgOf = async (args: Record<string, unknown>) => {
			const result = await client.callTool({ name: 'export_diagram', arguments: args });
			return (result.content as { resource?: { text: string } }[])[1].resource!.text;
		};
		expect(await svgOf(at)).toContain('>Managed (cloud)</text>');
		expect(await svgOf({ ...at, legend: false })).not.toContain('>Managed (cloud)</text>');
	});

	it('says where Components run', async () => {
		const { client, id } = await setup();
		await call(client, 'add_component', {
			project: id,
			diagram: 'Architecture',
			type: 'database',
			name: 'DB',
			hosting: 'managed'
		});
		await call(client, 'add_component', {
			project: id,
			diagram: 'Architecture',
			type: 'service',
			name: 'API'
		});
		await call(client, 'set_hosting', {
			project: id,
			diagram: 'Architecture',
			component: 'API',
			hosting: 'kubernetes'
		});
		const { components } = await call(client, 'get_diagram', {
			project: id,
			diagram: 'Architecture'
		});
		expect(components.map((c: { name: string; hosting: string }) => [c.name, c.hosting])).toEqual([
			['DB', 'managed'],
			['API', 'kubernetes']
		]);
		await call(client, 'set_hosting', {
			project: id,
			diagram: 'Architecture',
			component: 'API',
			hosting: 'none'
		});
		const after = await call(client, 'get_diagram', { project: id, diagram: 'Architecture' });
		expect(after.components[1].hosting).toBeNull();
	});

	it('models an MCD and returns its SQL', async () => {
		const { client, id } = await setup();
		await call(client, 'add_entity', {
			project: id,
			diagram: 'Data',
			name: 'Customer',
			attributes: [{ name: 'email', type: 'text(120)' }]
		});
		await call(client, 'add_entity', { project: id, diagram: 'Data', name: 'Order' });
		await call(client, 'add_association', {
			project: id,
			diagram: 'Data',
			name: 'places',
			from: { entity: 'Order', cardinality: '1,1' },
			to: { entity: 'Customer', cardinality: '0,n' }
		});
		const { mld } = await call(client, 'get_mcd_sql', { project: id, diagram: 'Data' });
		expect(mld).toBe(
			'customer = (id SERIAL, email VARCHAR(120));\norder = (id SERIAL, #customer_id);'
		);
	});

	it('models N-ary Associations with legs and add_leg', async () => {
		const { client, id } = await setup();
		const at = { project: id, diagram: 'Data' };
		for (const name of ['Teacher', 'Room', 'Slot', 'Subject']) {
			await call(client, 'add_entity', { ...at, name });
		}
		await call(client, 'add_association', {
			...at,
			name: 'teaches',
			legs: [
				{ entity: 'Teacher', cardinality: '0,n' },
				{ entity: 'Room', cardinality: '1,n' },
				{ entity: 'Slot', cardinality: '0,n' }
			]
		});
		const { id: leg } = await call(client, 'add_leg', {
			...at,
			association: 'teaches',
			entity: 'Subject',
			cardinality: '1,n'
		});
		const { associations } = await call(client, 'get_diagram', at);
		expect(associations[0].legs).toMatchObject([
			{ entity: 'Teacher', cardinality: '0,n' },
			{ entity: 'Room', cardinality: '1,n' },
			{ entity: 'Slot', cardinality: '0,n' },
			{ id: leg, entity: 'Subject', cardinality: '1,n' }
		]);
		const { mld } = await call(client, 'get_mcd_sql', at);
		expect(mld).toContain('teaches = (#teacher_id, #room_id, #slot_id, #subject_id);');

		expect(
			(
				await call(client, 'add_association', {
					...at,
					name: 'x',
					legs: [{ entity: 'Room', cardinality: '0,n' }]
				})
			).error
		).toMatch(/legs/);
		const both = await call(client, 'add_association', {
			...at,
			name: 'x',
			legs: [
				{ entity: 'Room', cardinality: '0,n' },
				{ entity: 'Slot', cardinality: '0,n' }
			],
			from: { entity: 'Room', cardinality: '0,n' }
		});
		expect(both.error).toBe('Give legs, or from and to, not both.');
		expect((await call(client, 'add_association', { ...at, name: 'x' })).error).toBe(
			'Give legs (two or more), or from and to.'
		);
		expect(
			(await call(client, 'add_leg', { ...at, association: 'Room', entity: 'Slot' })).error
		).toMatch(/No association "Room"/);
	});

	it('puts a CIF on an N-ary Association, by Entity names or Leg ids', async () => {
		const { client, id } = await setup();
		const at = { project: id, diagram: 'Data' };
		for (const name of ['Teacher', 'Class', 'Subject']) {
			await call(client, 'add_entity', { ...at, name });
		}
		await call(client, 'add_association', {
			...at,
			name: 'teaches',
			legs: ['Teacher', 'Class', 'Subject'].map((entity) => ({ entity, cardinality: '0,n' }))
		});
		const { id: cif } = await call(client, 'add_cif', {
			...at,
			association: 'teaches',
			determinants: ['Class', 'Subject'],
			determined: 'Teacher'
		});
		const { cifs, associations } = await call(client, 'get_diagram', at);
		const legOf = (entity: string) =>
			associations[0].legs.find((l: { entity: string }) => l.entity === entity).id;
		expect(cifs).toEqual([
			{
				id: cif,
				association: 'teaches',
				determinants: [
					{ leg: legOf('Class'), entity: 'Class' },
					{ leg: legOf('Subject'), entity: 'Subject' }
				],
				determined: { leg: legOf('Teacher'), entity: 'Teacher' }
			}
		]);
		const { mld } = await call(client, 'get_mcd_sql', at);
		expect(mld).toContain('teaches = (#teacher_id, #class_id, #subject_id);');
		const { sql } = await call(client, 'get_mcd_sql', at);
		expect(sql).toContain('PRIMARY KEY (class_id, subject_id)');

		await call(client, 'delete_elements', { ...at, elements: [cif] });
		const byLegs = await call(client, 'add_cif', {
			...at,
			association: 'teaches',
			determinants: [legOf('Teacher')],
			determined: legOf('Subject')
		});
		expect(byLegs.id).toBeTruthy();
		expect(
			(
				await call(client, 'add_cif', {
					...at,
					association: 'teaches',
					determinants: ['Teacher'],
					determined: 'Teacher'
				})
			).error
		).toBe('The determined Leg cannot also be a determinant.');
		expect(
			(
				await call(client, 'add_cif', {
					...at,
					association: 'teaches',
					determinants: ['Room'],
					determined: 'Class'
				})
			).error
		).toBe('"Room" is not linked by this Association.');
	});

	it('makes Inheritances and sets their constraint and translation', async () => {
		const { client, id } = await setup();
		const at = { project: id, diagram: 'Data' };
		for (const name of ['Person', 'Student', 'Teacher']) {
			await call(client, 'add_entity', { ...at, name });
		}
		await call(client, 'set_inheritance', { ...at, entity: 'Student', parent: 'Person' });
		await call(client, 'set_inheritance', { ...at, entity: 'Teacher', parent: 'Person' });
		await call(client, 'set_inheritance_options', {
			...at,
			parent: 'Person',
			constraint: 'XT',
			translation: 'up'
		});
		const { inheritances } = await call(client, 'get_diagram', at);
		expect(inheritances).toEqual([
			{
				id: expect.any(String),
				parent: 'Person',
				children: ['Student', 'Teacher'],
				constraint: 'XT',
				translation: 'up'
			}
		]);
		await call(client, 'set_inheritance', { ...at, entity: 'Teacher', parent: null });
		expect((await call(client, 'get_diagram', at)).inheritances[0].children).toEqual(['Student']);
		expect(
			(await call(client, 'set_inheritance', { ...at, entity: 'Person', parent: 'Student' })).error
		).toBe('An Entity cannot inherit from itself or a descendant.');
		expect(
			(await call(client, 'set_inheritance_options', { ...at, parent: 'Teacher', constraint: 'X' }))
				.error
		).toBe('"Teacher" has no child Entities.');
		expect((await call(client, 'set_inheritance_options', { ...at, parent: 'Person' })).error).toBe(
			'Give a constraint, a translation or both.'
		);
	});

	it('marks a relative identifier with set_cardinality', async () => {
		const { client, id } = await setup();
		const at = { project: id, diagram: 'Data' };
		await call(client, 'add_entity', { ...at, name: 'Order' });
		await call(client, 'add_entity', {
			...at,
			name: 'Line',
			attributes: [{ name: 'number', type: 'integer', identifier: true }]
		});
		await call(client, 'add_association', {
			...at,
			name: 'of',
			from: { entity: 'Line', cardinality: '0,n' },
			to: { entity: 'Order', cardinality: '0,n' }
		});
		const wrong = await call(client, 'set_cardinality', {
			...at,
			association: 'of',
			entity: 'Line',
			cardinality: '0,1',
			relative: true
		});
		expect(wrong.error).toBe(
			'A relative identifier goes on a 1,1 Leg of a binary Association between two Entities.'
		);
		await call(client, 'set_cardinality', {
			...at,
			association: 'of',
			entity: 'Line',
			cardinality: '1,1',
			relative: true
		});
		const { associations } = await call(client, 'get_diagram', at);
		expect(associations[0].legs).toMatchObject([
			{ entity: 'Line', cardinality: '1,1', relative: true },
			{ entity: 'Order', cardinality: '0,n', relative: false }
		]);
		const { mld } = await call(client, 'get_mcd_sql', at);
		expect(mld).toContain('line = (#order_id, number INTEGER);');
	});

	it('leaves out a node stored under another key than its id, which no write can reach', async () => {
		const { client, id, browser } = await setup();
		const diagram = browser.diagrams()[0].id;
		const nodes = (browser.doc.getMap('diagrams').get(diagram) as Y.Map<unknown>).get(
			'nodes'
		) as Y.Map<unknown>;
		const ghost = new Y.Map<unknown>();
		const fields = {
			id: 'real-id',
			type: 'component',
			x: 0,
			y: 0,
			name: 'Ghost',
			componentType: 'service',
			skin: null
		};
		for (const [key, value] of Object.entries(fields)) ghost.set(key, value);
		// In the same update as a node the server can read: once that one shows, so has the ghost.
		browser.doc.transact(() => {
			nodes.set('other-key', ghost);
			browser.addComponent(diagram, 'service', 'Visible', 300, 0);
		});
		const at = { project: id, diagram: 'Architecture' };
		await vi.waitFor(async () => {
			const { components } = await call(client, 'get_diagram', at);
			expect(components.map((c: { name: string }) => c.name)).toEqual(['Visible']);
		});
		const answer = await call(client, 'rename_element', { ...at, element: 'Ghost', name: 'Seen' });
		expect(answer.error).toMatch(/No element "Ghost"/);
	});

	it('explains ambiguous names, unknown names and wrong links', async () => {
		const { client, id } = await setup();
		await call(client, 'add_entity', { project: id, diagram: 'Data', name: 'Tag' });
		await call(client, 'add_entity', { project: id, diagram: 'Data', name: 'Tag' });
		const ambiguous = await call(client, 'rename_element', {
			project: id,
			diagram: 'Data',
			element: 'Tag',
			name: 'Label'
		});
		expect(ambiguous.error).toMatch(/Several elements are named "Tag": .+, .+\. Use an id\./);
		expect((await call(client, 'get_diagram', { project: id, diagram: 'Nope' })).error).toMatch(
			/No diagram "Nope"\. Known: Architecture \(.+\), Data \(.+\)\./
		);
		expect((await call(client, 'get_project', { project: crypto.randomUUID() })).error).toBe(
			'No Shared Project has this link.'
		);
		expect((await call(client, 'get_project', { project: 'shop' })).error).toBe(
			'Not a Share link or Project id.'
		);
	});
});

describe('MCP guards', () => {
	it('stops an agent from growing a Project past the size limit', async () => {
		const { client, id } = await setup({ maxDocumentBytes: 3000 });
		let answer: { error?: string } = {};
		for (let i = 0; i < 40 && !answer.error; i++) {
			answer = await call(client, 'add_entity', {
				project: id,
				diagram: 'Data',
				name: `Entity ${i} ${'x'.repeat(150)}`
			});
		}
		expect(answer.error).toBe('This Shared Project is full: it takes no more changes.');
	});

	it('refuses an Identifier on an Association and an Entity the Association does not link', async () => {
		const { client, id } = await setup();
		for (const name of ['Customer', 'Order', 'Product']) {
			await call(client, 'add_entity', { project: id, diagram: 'Data', name });
		}
		await call(client, 'add_association', {
			project: id,
			diagram: 'Data',
			name: 'places',
			from: { entity: 'Order', cardinality: '1,1' },
			to: { entity: 'Customer', cardinality: '0,n' }
		});
		const identifier = await call(client, 'add_attribute', {
			project: id,
			diagram: 'Data',
			element: 'places',
			attribute: { name: 'at', identifier: true }
		});
		expect(identifier.error).toBe('Only an Entity has an Identifier.');
		const unrelated = await call(client, 'set_cardinality', {
			project: id,
			diagram: 'Data',
			association: 'places',
			entity: 'Product',
			cardinality: '0,1'
		});
		expect(unrelated.error).toBe('"Product" is not linked by this Association.');
	});
});

describe('MCP helpers', () => {
	it('reads Data types written as text', () => {
		expect(parseDataType('decimal(12,3)')).toEqual({ kind: 'decimal', precision: 12, scale: 3 });
		expect(parseDataType('Text(80)')).toEqual({ kind: 'varchar', length: 80 });
		expect(parseDataType('auto-increment')).toEqual({ kind: 'serial' });
		expect(parseDataType('varchar')).toEqual({ kind: 'varchar', length: 255 });
		expect(parseDataType('numeric(8)')).toEqual({ kind: 'decimal', precision: 8, scale: 0 });
		expect(() => parseDataType('money')).toThrow('Unknown Data type "money".');
	});

	it('places new elements beside the others, never on top', () => {
		const at = (x: number, y: number) => ({ id: `${x},${y}`, type: 'entity', x, y });
		expect(freeSpot([])).toEqual({ x: 0, y: 0 });
		expect(freeSpot([at(0, 0)])).toEqual({ x: SLOT.width, y: 0 });
		// A full row wraps below, back on the left.
		expect(freeSpot([at(1200, 0), at(0, 0)])).toEqual({ x: 0, y: SLOT.height });
	});

	it('fills the Diagram row by row when many elements are added', () => {
		const placed: { id: string; type: string; x: number; y: number }[] = [];
		for (let i = 0; i < 10; i++)
			placed.push({ id: String(i), type: 'component', ...freeSpot(placed) });
		const rows = new Map<number, number>();
		for (const p of placed) rows.set(p.y, (rows.get(p.y) ?? 0) + 1);
		// 4 per row (0, 360, 720, 1080), the last row holding the rest.
		expect([...rows.values()]).toEqual([4, 4, 2]);
		expect(placed[4]).toEqual({ id: '4', type: 'component', x: 0, y: SLOT.height });
		expect(placed[5]).toEqual({ id: '5', type: 'component', x: SLOT.width, y: SLOT.height });
	});
});
