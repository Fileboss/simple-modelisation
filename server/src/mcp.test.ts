import { HocuspocusProvider } from '@hocuspocus/provider';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { anyOverlap, estimatedSize } from '@simple-modelisation/model/layout.ts';
import { ProjectDocument } from '@simple-modelisation/model/project.ts';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
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
	it('tells clients the release it runs', async () => {
		const { client } = await setup();
		const root = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
		expect(client.getServerVersion()?.version).toBe(root.version);
	});

	it('lists the tools, none of which lists or creates Projects', async () => {
		const { client } = await setup();
		const { tools } = await client.listTools();
		expect(tools.map((t) => t.name).sort()).toEqual([
			'add_area',
			'add_association',
			'add_attribute',
			'add_cif',
			'add_component',
			'add_diagram',
			'add_entity',
			'add_leg',
			'add_note',
			'add_zone',
			'batch',
			'connect_components',
			'delete_diagram',
			'delete_elements',
			'duplicate_diagram',
			'export_diagram',
			'export_project',
			'get_diagram',
			'get_mcd_sql',
			'get_project',
			'layout_diagram',
			'move_elements',
			'remove_attribute',
			'rename_element',
			'set_area',
			'set_attribute',
			'set_cardinality',
			'set_component',
			'set_connection',
			'set_entity',
			'set_inheritance',
			'set_inheritance_options',
			'set_note',
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
		expect(empty.error).toBe(
			'Give a label, a flow, a label_position, from, to, from_anchor or to_anchor.'
		);
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
		await call(client, 'set_component', { ...at, component: 'API', provider: 'hetzner' });
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
		await call(client, 'set_component', { ...at, component: 'API', provider: 'none' });
		expect((await read())[1]).toEqual(['API', null, null]);
	});

	it('gives Components the new Skins, only on the types that offer them', async () => {
		const { client, id } = await setup();
		const at = { project: id, diagram: 'Architecture' };
		await call(client, 'add_component', { ...at, type: 'gateway', name: 'Proxy', skin: 'caddy' });
		await call(client, 'add_component', { ...at, type: 'service', name: 'Finance' });
		await call(client, 'set_component', { ...at, component: 'Finance', skin: 'nextjs' });
		const refused = await call(client, 'set_component', {
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
		const runtime = await call(client, 'set_component', {
			...at,
			component: 'Finance',
			skin: 'bun'
		});
		expect(runtime.error).toMatch(/No "bun" Skin for a service\. "bun" is a service's runtime/);
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
			expect.objectContaining({
				id: note,
				text: 'Syncs every night at 2 a.m.',
				color: 'pink',
				width: 180,
				zone: null
			})
		]);
		const unknown = await call(client, 'set_note', { ...at, note: 'nope', text: 'x' });
		expect(unknown.error).toBe(`No note "nope". Known: ${note}.`);
		const empty = await call(client, 'set_note', { ...at, note });
		expect(empty.error).toBe('Give a text, a color or a width.');
		await call(client, 'set_note', { ...at, note, width: 320 });
		expect((await call(client, 'get_diagram', at)).notes[0].width).toBe(320);
		const wide = await client.callTool({
			name: 'set_note',
			arguments: { ...at, note, width: 5000 }
		});
		expect(wide.isError).toBe(true);

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
		const setHosting = await call(client, 'set_component', {
			...at,
			component: 'Buyer',
			hosting: 'vm'
		});
		expect(setHosting.error).toBe('A person has no hosting.');
		const setProvider = await call(client, 'set_component', {
			...at,
			component: 'Buyer',
			provider: 'aws'
		});
		expect(setProvider.error).toBe('A person has no provider.');
		// Clearing is harmless and accepted.
		const cleared = await call(client, 'set_component', {
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
		await call(client, 'set_component', { ...at, component: 'Indexer', runtime: 'rust' });
		const onDatabase = await call(client, 'add_component', {
			...at,
			type: 'database',
			name: 'DB',
			runtime: 'nodejs'
		});
		expect(onDatabase.error).toBe('Only a service has a runtime.');
		await call(client, 'add_component', { ...at, type: 'database', name: 'DB' });
		const notAService = await call(client, 'set_component', {
			...at,
			component: 'DB',
			runtime: 'go'
		});
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
		await call(client, 'set_component', { ...at, component: 'Web', runtime: 'none' });
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
		await call(client, 'set_component', { ...at, component: 'USB 12 To', disk_kind: 'usb' });
		const misplaced = await call(client, 'add_component', {
			...at,
			type: 'service',
			name: 'API',
			disk_kind: 'ssd'
		});
		expect(misplaced.error).toMatch(/Only a disk/);
		const skinned = await call(client, 'set_component', {
			...at,
			component: 'SSD 2 To',
			skin: 's3'
		});
		expect(skinned.error).toBe('A disk takes no Skin.');
		await call(client, 'add_component', { ...at, type: 'service', name: 'API' });
		const notADisk = await call(client, 'set_component', {
			...at,
			component: 'API',
			disk_kind: 'ssd'
		});
		expect(notADisk.error).toBe('Only a disk has a disk_kind.');
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
		await call(client, 'set_component', { ...at, component: 'App', provider: 'scaleway' });
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
		await call(client, 'set_component', { ...at, component: 'SSD', disk_kind: 'ssd' });
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
			'Architecture drawn as SVG. Empty, not drawn: Data.'
		);
	});

	it('draws MCDs, alone or with every Diagram of the Project', async () => {
		const { client, id } = await setup();
		const at = { project: id, diagram: 'Data' };
		await call(client, 'add_entity', { ...at, name: 'Customer' });
		await call(client, 'add_entity', { ...at, name: 'Order' });
		await call(client, 'add_association', {
			...at,
			name: 'places',
			from: { entity: 'Customer', cardinality: '0,n' },
			to: { entity: 'Order', cardinality: '1,1' }
		});

		const one = await client.callTool({ name: 'export_diagram', arguments: at });
		const [note, image] = one.content as [
			{ text: string },
			{ resource: { mimeType: string; text: string } }
		];
		expect(note.text).toBe('Data drawn as SVG.');
		expect(image.resource.mimeType).toBe('image/svg+xml');
		expect(image.resource.text).toMatch(/^<svg xmlns/);
		expect(image.resource.text).toContain('>Customer</text>');
		expect(image.resource.text).toContain('>places</text>');
		expect(image.resource.text).toContain('>0,n</text>');
		expect(image.resource.text).toContain('fill="#fdd77d"');

		const all = await client.callTool({ name: 'export_diagram', arguments: { project: id } });
		expect((all.content as { text?: string }[])[0].text).toBe(
			'Data drawn as SVG. Empty, not drawn: Architecture.'
		);
	});

	it('draws MCDs in the Notation asked for, ignoring it on System design diagrams', async () => {
		const { client, id } = await setup();
		await call(client, 'add_entity', {
			project: id,
			diagram: 'Data',
			name: 'Customer',
			attributes: [{ name: 'email', type: 'text(120)' }]
		});
		await call(client, 'add_component', {
			project: id,
			diagram: 'Architecture',
			type: 'service',
			name: 'API'
		});
		const images = async (args: Record<string, unknown>) => {
			const result = await client.callTool({ name: 'export_diagram', arguments: args });
			return (result.content as { resource?: { text: string } }[])
				.slice(1)
				.map((c) => c.resource!.text);
		};
		const [merise] = await images({ project: id, diagram: 'Data' });
		expect(merise).toContain('fill="#fdd77d"');
		const [uml] = await images({ project: id, diagram: 'Data', notation: 'uml' });
		expect(uml).not.toContain('fill="#fdd77d"');
		expect(uml).toContain('>email : Text(120)</text>');
		const both = await images({ project: id, notation: 'uml' });
		expect(both).toHaveLength(2);
		expect(both.some((svg) => svg.includes('>API</text>'))).toBe(true);
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
		await call(client, 'set_component', {
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
		await call(client, 'set_component', {
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
			expect.objectContaining({
				id: cif,
				association: 'teaches',
				determinants: [
					{ leg: legOf('Class'), entity: 'Class' },
					{ leg: legOf('Subject'), entity: 'Subject' }
				],
				determined: { leg: legOf('Teacher'), entity: 'Teacher' }
			})
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
			expect.objectContaining({
				id: expect.any(String),
				parent: 'Person',
				children: ['Student', 'Teacher'],
				constraint: 'XT',
				translation: 'up'
			})
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
		for (const text of ['json', 'JSONB']) expect(parseDataType(text)).toEqual({ kind: 'json' });
		for (const text of ['blob', 'bytea', 'Binary'])
			expect(parseDataType(text)).toEqual({ kind: 'blob' });
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

describe('MCP move_elements', () => {
	it('gives each element its place and size, and moves elements by position or offset in one step', async () => {
		const { client, id } = await setup();
		const at = { project: id, diagram: 'Architecture' };
		await call(client, 'add_component', { ...at, type: 'service', name: 'API', x: 0, y: 0 });
		await call(client, 'add_component', { ...at, type: 'database', name: 'DB', x: 400, y: 0 });
		const before = await call(client, 'get_diagram', at);
		const api = before.components.find((c: { name: string }) => c.name === 'API');
		expect(api).toMatchObject({
			x: 0,
			y: 0,
			width: expect.any(Number),
			height: expect.any(Number)
		});

		const moved = await call(client, 'move_elements', {
			...at,
			moves: [
				{ element: 'API', x: 40, y: 300 },
				{ element: 'DB', dx: -100, dy: 20 }
			]
		});
		expect(moved.moved).toHaveLength(2);
		const after = await call(client, 'get_diagram', at);
		const place = (name: string) => {
			const c = after.components.find((c: { name: string }) => c.name === name);
			return { x: c.x, y: c.y };
		};
		expect(place('API')).toEqual({ x: 40, y: 300 });
		const db = before.components.find((c: { name: string }) => c.name === 'DB');
		expect(place('DB')).toEqual({ x: db.x - 100, y: db.y + 20 });
	});

	it('takes a Zone’s content along, and refuses unknown elements and mixed moves', async () => {
		const { client, id } = await setup();
		const at = { project: id, diagram: 'Architecture' };
		await call(client, 'add_zone', { ...at, name: 'VPC', x: 0, y: 0, width: 400, height: 300 });
		await call(client, 'add_component', { ...at, type: 'service', name: 'API', zone: 'VPC' });
		const before = (await call(client, 'get_diagram', at)).components[0];
		await call(client, 'move_elements', { ...at, moves: [{ element: 'VPC', dx: 500, dy: 0 }] });
		const after = await call(client, 'get_diagram', at);
		expect(after.zones[0]).toMatchObject({ x: 500, y: 0 });
		expect(after.components[0]).toMatchObject({
			x: before.x + 500,
			y: before.y,
			zone: { name: 'VPC' }
		});

		const unknown = await call(client, 'move_elements', {
			...at,
			moves: [{ element: 'Nope', x: 0, y: 0 }]
		});
		expect(unknown.error).toMatch(/No element "Nope"/);
		const mixed = await client.callTool({
			name: 'move_elements',
			arguments: { ...at, moves: [{ element: 'API', x: 0, dx: 5 }] }
		});
		expect(mixed.isError).toBe(true);
	});

	it('moves what a nested Zone holds with it, whatever the order of the moves', async () => {
		for (const reversed of [false, true]) {
			const { client, id } = await setup();
			const at = { project: id, diagram: 'Architecture' };
			await call(client, 'add_zone', { ...at, name: 'Cloud', x: 0, y: 0, width: 800, height: 600 });
			await call(client, 'add_zone', { ...at, name: 'VPC', x: 40, y: 60, width: 400, height: 300 });
			await call(client, 'add_component', { ...at, type: 'service', name: 'API', zone: 'VPC' });
			const before = await call(client, 'get_diagram', at);
			const api = before.components[0];
			const vpc = before.zones.find((z: { name: string }) => z.name === 'VPC');
			const moves = [
				{ element: 'VPC', x: 2000, y: 60 },
				{ element: 'Cloud', dx: 100, dy: 0 }
			];
			await call(client, 'move_elements', { ...at, moves: reversed ? moves.reverse() : moves });
			const after = (await call(client, 'get_diagram', at)).components[0];
			// API follows VPC, the innermost Zone moved, not Cloud's offset.
			expect(after).toMatchObject({ x: api.x + 2000 - vpc.x, y: api.y + 60 - vpc.y });
		}
	});

	it('moves MCD elements and Notes too', async () => {
		const { client, id } = await setup();
		const at = { project: id, diagram: 'Data' };
		await call(client, 'add_entity', { ...at, name: 'Customer' });
		const { id: note } = await call(client, 'add_note', { ...at, text: 'GDPR', near: 'Customer' });
		await call(client, 'move_elements', {
			...at,
			moves: [
				{ element: 'Customer', x: 100, y: 100 },
				{ element: note, x: 300, y: 100 }
			]
		});
		const data = await call(client, 'get_diagram', at);
		expect(data.entities[0]).toMatchObject({ x: 100, y: 100 });
		expect(data.notes[0]).toMatchObject({ x: 300, y: 100 });
	});
});

describe('MCP layout_diagram direction', () => {
	it('lays an MCD out vertically when asked, and refuses it on a System design diagram', async () => {
		const { client, id } = await setup();
		const at = { project: id, diagram: 'Data' };
		await call(client, 'add_entity', { ...at, name: 'Customer' });
		await call(client, 'add_entity', { ...at, name: 'Order' });
		await call(client, 'add_association', {
			...at,
			name: 'places',
			from: { entity: 'Customer', cardinality: '0,n' },
			to: { entity: 'Order', cardinality: '1,1' }
		});
		const laid = await call(client, 'layout_diagram', { ...at, direction: 'vertical' });
		expect(laid.next).toMatch(/move_elements/);
		const { entities, associations } = await call(client, 'get_diagram', at);
		const ys = entities.map((e: { y: number }) => e.y).sort((a: number, b: number) => a - b);
		expect(ys[0] < associations[0].y && associations[0].y < ys[1]).toBe(true);

		const refused = await call(client, 'layout_diagram', {
			project: id,
			diagram: 'Architecture',
			direction: 'vertical'
		});
		expect(refused.error).toBe('Only an MCD can be laid out vertically.');
	});
});

/** The Attributes of an element of a Participant's Diagram, by name. */
function attributesOf(browser: ProjectDocument, diagram: string, element: string) {
	const diagramId = browser.diagrams().find((d) => d.name === diagram)!.id;
	const node = browser.nodes(diagramId).find((n) => n.name === element);
	return (node?.attributes ?? []) as {
		id: string;
		name: string;
		identifier: boolean;
		optional: boolean;
		type: { kind: string };
	}[];
}

describe('MCP set_attribute and remove_attribute', () => {
	it('changes each field of an Attribute, by id or by name', async () => {
		const { client, id, browser } = await setup();
		const at = { project: id, diagram: 'Data' };
		await call(client, 'add_entity', {
			...at,
			name: 'Customer',
			attributes: [
				{ name: 'id', type: 'integer', identifier: true },
				{ name: 'email' },
				{ name: 'phone' }
			]
		});
		await vi.waitFor(() => expect(attributesOf(browser, 'Data', 'Customer')).toHaveLength(3));
		const email = attributesOf(browser, 'Data', 'Customer')[1];

		const set = await call(client, 'set_attribute', {
			...at,
			element: 'Customer',
			attribute: email.id,
			name: 'mail',
			type: 'text(120)',
			optional: true,
			position: 99
		});
		expect(set).toEqual({ id: email.id });
		await vi.waitFor(() =>
			expect(attributesOf(browser, 'Data', 'Customer').at(-1)).toMatchObject({
				name: 'mail',
				type: { kind: 'varchar' },
				optional: true,
				identifier: false
			})
		);

		// By name: the Identifier clears NULL, and position 1 comes first.
		await call(client, 'set_attribute', {
			...at,
			element: 'Customer',
			attribute: 'mail',
			identifier: true,
			position: 1
		});
		await vi.waitFor(() =>
			expect(attributesOf(browser, 'Data', 'Customer')[0]).toMatchObject({
				name: 'mail',
				identifier: true,
				optional: false
			})
		);
		await call(client, 'set_attribute', {
			...at,
			element: 'Customer',
			attribute: 'mail',
			identifier: false,
			position: -5
		});
		await vi.waitFor(() =>
			expect(attributesOf(browser, 'Data', 'Customer')[0]).toMatchObject({
				name: 'mail',
				identifier: false
			})
		);
		expect(attributesOf(browser, 'Data', 'Customer').map((a) => a.name)).toEqual([
			'mail',
			'id',
			'phone'
		]);

		const removed = await call(client, 'remove_attribute', {
			...at,
			element: 'Customer',
			attribute: 'phone'
		});
		expect(removed.deleted).toBeTypeOf('string');
		await vi.waitFor(() =>
			expect(attributesOf(browser, 'Data', 'Customer').map((a) => a.name)).toEqual(['mail', 'id'])
		);
	});

	it('refuses an Identifier on an Association, an unknown element, Attribute or Data type', async () => {
		const { client, id } = await setup();
		const at = { project: id, diagram: 'Data' };
		await call(client, 'add_entity', { ...at, name: 'Customer' });
		await call(client, 'add_entity', { ...at, name: 'Order' });
		await call(client, 'add_association', {
			...at,
			name: 'places',
			from: { entity: 'Order', cardinality: '1,1' },
			to: { entity: 'Customer', cardinality: '0,n' }
		});
		await call(client, 'add_attribute', { ...at, element: 'places', attribute: { name: 'at' } });

		const identifier = await call(client, 'set_attribute', {
			...at,
			element: 'places',
			attribute: 'at',
			identifier: true
		});
		expect(identifier.error).toBe('Only an Entity has an Identifier.');
		const element = await call(client, 'set_attribute', {
			...at,
			element: 'Invoice',
			attribute: 'id',
			name: 'x'
		});
		expect(element.error).toMatch(/^No element "Invoice"\. Known: /);
		const attribute = await call(client, 'remove_attribute', {
			...at,
			element: 'Customer',
			attribute: 'email'
		});
		expect(attribute.error).toMatch(/^No attribute "email"\. Known: id \(/);
		const type = await call(client, 'set_attribute', {
			...at,
			element: 'Customer',
			attribute: 'id',
			type: 'money'
		});
		expect(type.error).toBe('Unknown Data type "money".');
		const nullIdentifier = await call(client, 'set_attribute', {
			...at,
			element: 'Customer',
			attribute: 'id',
			optional: true
		});
		expect(nullIdentifier.error).toBe('An Identifier never accepts NULL.');
		await call(client, 'add_attribute', { ...at, element: 'Customer', attribute: { name: 'n' } });
		const nullSerial = await call(client, 'set_attribute', {
			...at,
			element: 'Customer',
			attribute: 'n',
			type: 'serial',
			optional: true
		});
		expect(nullSerial.error).toBe('An auto-increment (serial) Attribute never accepts NULL.');
		const architecture = await call(client, 'set_attribute', {
			project: id,
			diagram: 'Architecture',
			element: 'Customer',
			attribute: 'id',
			name: 'x'
		});
		expect(architecture.error).toBe('"Architecture" is not an MCD.');
	});
});

describe('MCP delete_diagram and export_project', () => {
	it('deletes a Diagram, and refuses an unknown one', async () => {
		const { client, id, browser } = await setup();
		const deleted = await call(client, 'delete_diagram', { project: id, diagram: 'Architecture' });
		expect(deleted.deleted).toBeTypeOf('string');
		await vi.waitFor(() => expect(browser.diagrams().map((d) => d.name)).toEqual(['Data']));
		const unknown = await call(client, 'delete_diagram', { project: id, diagram: 'Architecture' });
		expect(unknown.error).toMatch(/^No diagram "Architecture"\./);
	});

	it("gives the Project as the app's JSON file, which imports back", async () => {
		const { client, id, browser } = await setup();
		await call(client, 'add_entity', { project: id, diagram: 'Data', name: 'Customer' });
		await vi.waitFor(() => expect(browser.nodes(browser.diagrams()[1].id)).toHaveLength(1));
		const file = await call(client, 'export_project', { project: id });
		expect(file).toEqual(browser.toFile());
		const imported = ProjectDocument.fromFile(file);
		expect(imported.name()).toBe('Shop');
		expect(imported.diagrams().map((d) => d.name)).toEqual(['Architecture', 'Data']);
	});
});

describe('MCP batch', () => {
	it('builds an MCD in one call, later operations using ids from earlier ones', async () => {
		const { client, id, browser } = await setup();
		let updates = 0;
		browser.subscribe(() => updates++);
		const result = await call(client, 'batch', {
			project: id,
			operations: [
				{ tool: 'add_diagram', args: { kind: 'mcd', name: 'Shop data' } },
				{ tool: 'add_entity', args: { diagram: { $ref: 1 }, name: 'Customer' } },
				{ tool: 'add_entity', args: { diagram: { $ref: 1 }, name: 'Order' } },
				{
					tool: 'add_association',
					args: {
						diagram: { $ref: 1 },
						name: 'places',
						from: { entity: { $ref: 3 }, cardinality: '1,1' },
						to: { entity: { $ref: 2 }, cardinality: '0,n' }
					}
				},
				{
					tool: 'set_attribute',
					args: { diagram: { $ref: 1 }, element: { $ref: 2 }, attribute: 'id', name: 'number' }
				}
			]
		});
		expect(result.results).toHaveLength(5);
		expect(result.results[0].id).toBeTypeOf('string');
		await vi.waitFor(() =>
			expect(attributesOf(browser, 'Shop data', 'Customer')[0]?.name).toBe('number')
		);
		const diagram = browser.diagrams().find((d) => d.name === 'Shop data')!;
		expect(browser.nodes(diagram.id)).toHaveLength(3);
		expect(browser.edges(diagram.id)).toHaveLength(2);
		// One change for the whole batch.
		expect(updates).toBe(1);
	});

	it('applies nothing when an operation fails, naming it', async () => {
		const { client, id, browser } = await setup();
		const before = JSON.stringify(browser.toFile());
		const failed = await call(client, 'batch', {
			project: id,
			operations: [
				{ tool: 'add_entity', args: { diagram: 'Data', name: 'Customer' } },
				{ tool: 'add_entity', args: { diagram: 'Nowhere', name: 'Order' } }
			]
		});
		expect(failed.error).toMatch(/^Operation 2 \(add_entity\): No diagram "Nowhere"\./);
		const invalid = await call(client, 'batch', {
			project: id,
			operations: [{ tool: 'add_entity', args: { diagram: 'Data' } }]
		});
		expect(invalid.error).toMatch(/^Operation 1 \(add_entity\): .*name/s);
		// A later write still lands, so the server was not waiting on the failed ones.
		await call(client, 'rename_element', { project: id, diagram: 'Data', name: 'Data 2' });
		await vi.waitFor(() => expect(browser.diagrams()[1].name).toBe('Data 2'));
		const after = JSON.parse(before);
		after.diagrams[1].name = 'Data 2';
		expect(browser.toFile()).toEqual(after);
	});

	it('refuses a $N that names no earlier operation or no id, a batch inside a batch and read tools', async () => {
		const { client, id } = await setup();
		const forward = await call(client, 'batch', {
			project: id,
			operations: [
				{ tool: 'add_entity', args: { diagram: 'Data', name: { $ref: 2 } } },
				{ tool: 'add_entity', args: { diagram: 'Data', name: 'Order' } }
			]
		});
		expect(forward.error).toBe(
			'Operation 1 (add_entity): { "$ref": 2 } names no earlier operation: use 1 to 0.'
		);
		const noId = await call(client, 'batch', {
			project: id,
			operations: [
				{ tool: 'add_entity', args: { diagram: 'Data', name: 'Customer' } },
				{ tool: 'delete_elements', args: { diagram: 'Data', elements: [{ $ref: 1 }] } },
				{ tool: 'add_entity', args: { diagram: 'Data', name: { $ref: 2 } } }
			]
		});
		expect(noId.error).toBe('Operation 3 (add_entity): Operation 2 returned no id to refer to.');
		for (const tool of ['batch', 'get_diagram', 'export_project']) {
			const refused = await call(client, 'batch', {
				project: id,
				operations: [{ tool, args: {} }]
			});
			expect(refused.error).toMatch(/Invalid|invalid/);
		}
	});

	it('keeps text that looks like a reference, and refuses a batch that would make the Project too big', async () => {
		const { client, id, browser } = await setup({ maxDocumentBytes: 20_000 });
		await call(client, 'batch', {
			project: id,
			operations: [{ tool: 'add_note', args: { diagram: 'Data', text: '$1' } }]
		});
		const data = browser.diagrams()[1].id;
		await vi.waitFor(() => expect(browser.nodes(data)[0]?.text).toBe('$1'));

		const big = await call(client, 'batch', {
			project: id,
			operations: Array.from({ length: 50 }, (_, i) => ({
				tool: 'add_note',
				args: { diagram: 'Data', text: `${i} ${'x'.repeat(1000)}` }
			}))
		});
		expect(big.error).toMatch(/Project too big: none was applied\.$/);
		await call(client, 'rename_element', { project: id, diagram: 'Data', name: 'Data 2' });
		await vi.waitFor(() => expect(browser.diagrams()[1].name).toBe('Data 2'));
		expect(browser.nodes(data)).toHaveLength(1);
	});
});

describe('MCP constraints', () => {
	it('sets, reads back and clears UNIQUE, CHECK, Comments and foreign key names', async () => {
		const { client, id } = await setup();
		const at = { project: id, diagram: 'Data' };
		await call(client, 'add_entity', {
			...at,
			name: 'Product',
			attributes: [
				{ name: 'id', type: 'serial', identifier: true },
				{ name: 'sku', unique: true, comment: 'The code' },
				{ name: 'price', type: 'decimal(10,2)', check: 'price >= 0' }
			]
		});
		await call(client, 'add_entity', { ...at, name: 'Book' });
		await call(client, 'add_association', {
			...at,
			name: 'shelved',
			from: { entity: 'Product', cardinality: '1,1' },
			to: { entity: 'Book', cardinality: '0,n' }
		});
		await call(client, 'set_entity', {
			...at,
			element: 'Product',
			comment: 'What we sell',
			unique_groups: [['sku', 'price']]
		});
		await call(client, 'set_entity', { ...at, element: 'shelved', comment: 'Where' });
		await call(client, 'set_cardinality', {
			...at,
			association: 'shelved',
			entity: 'Product',
			foreign_key: 'fk_shelf'
		});
		const { sql } = await call(client, 'get_mcd_sql', at);
		expect(sql).toContain('price NUMERIC(10,2) NOT NULL CHECK (price >= 0)');
		expect(sql).toContain('UNIQUE (sku),\n   UNIQUE (sku, price)');
		expect(sql).toContain('CONSTRAINT fk_shelf FOREIGN KEY (book_id)');
		expect(sql).toContain("COMMENT ON TABLE product IS 'What we sell';");
		expect(sql).toContain("COMMENT ON COLUMN product.sku IS 'The code';");
		expect(sql).toContain("COMMENT ON CONSTRAINT fk_shelf ON product IS 'Where';");

		const read = await call(client, 'get_diagram', at);
		expect(read.entities[0]).toMatchObject({
			comment: 'What we sell',
			unique_groups: [[{ name: 'sku' }, { name: 'price' }]]
		});
		expect(read.entities[0].attributes[1]).toMatchObject({ unique: true, comment: 'The code' });
		expect(read.associations[0]).toMatchObject({ comment: 'Where' });
		expect(read.associations[0].legs[0]).toMatchObject({
			cardinality: '1,1',
			foreign_key: 'fk_shelf'
		});

		await call(client, 'batch', {
			project: id,
			operations: [
				{
					tool: 'set_attribute',
					args: {
						diagram: 'Data',
						element: 'Product',
						attribute: 'sku',
						unique: false,
						comment: null
					}
				},
				{
					tool: 'set_attribute',
					args: { diagram: 'Data', element: 'Product', attribute: 'price', check: null }
				},
				{
					tool: 'set_entity',
					args: { diagram: 'Data', element: 'Product', comment: null, unique_groups: [] }
				},
				{ tool: 'set_entity', args: { diagram: 'Data', element: 'shelved', comment: null } },
				{
					tool: 'set_cardinality',
					args: { diagram: 'Data', association: 'shelved', entity: 'Product', foreign_key: null }
				}
			]
		});
		const cleared = (await call(client, 'get_mcd_sql', at)).sql;
		expect(cleared).not.toMatch(/UNIQUE|CHECK|COMMENT|fk_shelf/);
		expect(cleared).toContain('CONSTRAINT fk_product_book_id');

		await call(client, 'set_inheritance', {
			...at,
			entity: 'Book',
			parent: 'Product',
			foreign_key: 'fk_is_product'
		});
		expect((await call(client, 'get_diagram', at)).inheritances[0].foreign_keys).toMatchObject([
			{ child: { name: 'Book' }, name: 'fk_is_product' }
		]);
	});

	it('refuses bad values and writes nothing of the call', async () => {
		const { client, id } = await setup();
		const at = { project: id, diagram: 'Data' };
		const bad = 'a > 0); DROP TABLE x; --';
		const entity = await call(client, 'add_entity', {
			...at,
			name: 'Bad',
			attributes: [{ name: 'a', check: bad }]
		});
		expect(entity.error).toBe('A Check needs its parentheses balanced.');
		await call(client, 'add_entity', { ...at, name: 'Product', attributes: [{ name: 'a' }] });
		await call(client, 'add_entity', { ...at, name: 'Other' });
		const set = await call(client, 'set_attribute', {
			...at,
			element: 'Product',
			attribute: 'a',
			name: 'b',
			check: bad
		});
		expect(set.error).toBe('A Check needs its parentheses balanced.');
		const group = await call(client, 'set_entity', {
			...at,
			element: 'Product',
			comment: 'x',
			unique_groups: [['a', 'a']]
		});
		expect(group.error).toBe('A Unique group is of two Attributes or more.');
		const long = await call(client, 'set_attribute', {
			...at,
			element: 'Product',
			attribute: 'a',
			check: `x${' '.repeat(500_000)}x`
		}).catch((error: Error) => ({ error: error.message }));
		expect(long.error).toMatch(/500|too_big|Too big/);
		const key = await call(client, 'set_inheritance', {
			...at,
			entity: 'Other',
			parent: 'Product',
			foreign_key: 'a b'
		});
		expect(key.error).toMatch(/^A foreign key name is/);
		const read = await call(client, 'get_diagram', at);
		expect(read.entities.map((e: { name: string }) => e.name)).toEqual(['Product', 'Other']);
		expect(read.entities[0].comment).toBeNull();
		expect(read.entities[0].attributes.map((a: { name: string }) => a.name)).toContain('a');
		expect(read.inheritances).toEqual([]);
	});
});

describe('MCP duplicate_diagram', () => {
	it('copies a Diagram, alone and in a batch, as one change', async () => {
		const { client, id, browser } = await setup();
		const at = { project: id, diagram: 'Data' };
		await call(client, 'add_entity', { ...at, name: 'Customer' });
		await vi.waitFor(() => expect(browser.nodes(browser.diagrams()[1].id)).toHaveLength(1));
		let updates = 0;
		browser.subscribe(() => updates++);
		const copy = await call(client, 'duplicate_diagram', at);
		expect(copy.name).toBe('Data copy');
		await vi.waitFor(() => expect(browser.nodes(copy.id)).toHaveLength(1));
		expect(updates).toBe(1);
		const batch = await call(client, 'batch', {
			project: id,
			operations: [
				{ tool: 'duplicate_diagram', args: { diagram: 'Data', name: 'Variant' } },
				{ tool: 'add_entity', args: { diagram: { $ref: 1 }, name: 'Order' } }
			]
		});
		const variant = await call(client, 'get_diagram', {
			project: id,
			diagram: batch.results[0].id
		});
		expect(variant.entities.map((e: { name: string }) => e.name)).toEqual(['Customer', 'Order']);
		expect((await call(client, 'get_diagram', at)).entities).toHaveLength(1);
		const unknown = await call(client, 'duplicate_diagram', { project: id, diagram: 'Nope' });
		expect(unknown.error).toMatch(/^No diagram "Nope"/);
	});

	it('refuses a copy past the size limit, and stops a batch of them early', async () => {
		const { client, id, browser } = await setup({ maxDocumentBytes: 20_000 });
		const at = { project: id, diagram: 'Data' };
		for (let i = 0; i < 6; i++) {
			await call(client, 'add_note', { ...at, text: `${i} ${'x'.repeat(1900)}` });
		}
		const first = (await call(client, 'get_diagram', at)).notes[0].id;
		const tooBig = 'These changes would make the Shared Project too big: none was applied.';
		expect((await call(client, 'duplicate_diagram', at)).error).toBe(tooBig);
		const batch = await call(client, 'batch', {
			project: id,
			operations: Array.from({ length: 200 }, () => ({
				tool: 'duplicate_diagram',
				args: { diagram: 'Data' }
			}))
		});
		expect(batch.error).toBe(`Operation 2 (duplicate_diagram): ${tooBig}`);
		// Much written, little kept: edits replacing one another are not a big Project.
		const kept = await call(client, 'batch', {
			project: id,
			operations: Array.from({ length: 30 }, (_, i) => ({
				tool: 'set_note',
				args: { diagram: 'Data', note: first, text: `${i} ${'y'.repeat(1900)}` }
			}))
		});
		expect(kept.error).toBeUndefined();
		expect(kept.results).toHaveLength(30);
		expect(browser.diagrams()).toHaveLength(2);
	});
});

describe('MCP set_component', () => {
	const at = (id: string) => ({ project: id, diagram: 'Architecture' });
	const read = async (client: Client, id: string, name: string) =>
		(await call(client, 'get_diagram', at(id))).components.find(
			(c: { name: string }) => c.name === name
		);

	it('changes the type and all that goes with it in one call, then clears it', async () => {
		const { client, id } = await setup();
		await call(client, 'add_component', { ...at(id), type: 'database', name: 'Store' });
		await call(client, 'set_component', {
			...at(id),
			component: 'Store',
			type: 'service',
			name: 'Api',
			skin: 'nextjs',
			runtime: 'bun',
			hosting: 'docker',
			provider: 'hetzner'
		});
		expect(await read(client, id, 'Api')).toMatchObject({
			type: 'service',
			skin: 'nextjs',
			runtime: 'bun',
			hosting: 'docker',
			provider: 'hetzner'
		});
		// Left out, they stay.
		await call(client, 'set_component', { ...at(id), component: 'Api', hosting: 'vm' });
		expect(await read(client, id, 'Api')).toMatchObject({ skin: 'nextjs', runtime: 'bun' });
		await call(client, 'set_component', {
			...at(id),
			component: 'Api',
			skin: 'generic',
			runtime: 'none',
			hosting: 'none',
			provider: 'none'
		});
		expect(await read(client, id, 'Api')).toMatchObject({
			skin: null,
			runtime: null,
			hosting: null,
			provider: null
		});
	});

	it('checks against the type the call gives, and writes nothing when refused', async () => {
		const { client, id } = await setup();
		await call(client, 'add_component', { ...at(id), type: 'service', name: 'Api' });
		const refused = async (args: object) =>
			(await call(client, 'set_component', { ...at(id), component: 'Api', name: 'X', ...args }))
				.error;
		expect(await refused({ type: 'person', hosting: 'vm' })).toBe('A person has no hosting.');
		expect(await refused({ type: 'person', provider: 'aws' })).toBe('A person has no provider.');
		expect(await refused({ type: 'database', runtime: 'go' })).toBe(
			'Only a service has a runtime.'
		);
		expect(await refused({ disk_kind: 'ssd' })).toBe('Only a disk has a disk_kind.');
		expect(await refused({ type: 'database', skin: 'nextjs' })).toMatch(/^No "nextjs" Skin for a/);
		expect(await refused({ type: 'disk', zone: 'Nowhere', disk_kind: 'ssd' })).toMatch(/Nowhere/);
		expect(await read(client, id, 'Api')).toMatchObject({ type: 'service', skin: null });
		// Clearing what a type never has is harmless.
		const cleared = await call(client, 'set_component', {
			...at(id),
			component: 'Api',
			type: 'person',
			hosting: 'none',
			provider: 'none',
			runtime: 'none',
			disk_kind: 'none'
		});
		expect(cleared.error).toBeUndefined();
	});

	it.each([
		['a longer name', { name: 'A very long name '.repeat(10).trim() }],
		['a longer name, asked to stay', { name: 'A very long name '.repeat(10).trim(), zone: 'VPC' }]
	])('grows its Zone to keep it: %s', async (_case, change) => {
		const { client, id } = await setup();
		await call(client, 'add_zone', { ...at(id), name: 'VPC' });
		await call(client, 'add_component', { ...at(id), type: 'service', name: 'Api', zone: 'VPC' });
		await call(client, 'set_component', { ...at(id), component: 'Api', ...change });
		const { zones, components } = await call(client, 'get_diagram', at(id));
		expect(components[0].zone.name).toBe('VPC');
		expect(components[0].x + components[0].width).toBeLessThanOrEqual(zones[0].x + zones[0].width);
	});

	// Long enough for a look to widen its box.
	const API_NAME = 'Payments and refunds';
	/** A Zone with a Component placed right against its bottom right corner. */
	async function atTheEdge(client: Client, id: string, look: object) {
		await call(client, 'add_zone', { ...at(id), name: 'VPC' });
		await call(client, 'add_component', { ...at(id), type: 'service', name: API_NAME, ...look });
		const { zones, components } = await call(client, 'get_diagram', at(id));
		const [zone, api] = [zones[0], components[0]];
		await call(client, 'set_component', {
			...at(id),
			component: API_NAME,
			x: zone.x + zone.width - api.width,
			y: zone.y + zone.height - api.height
		});
		return zone as { width: number; height: number };
	}
	const zoneNow = async (client: Client, id: string) =>
		(await call(client, 'get_diagram', at(id))).zones[0];

	it('grows its Zone for a look that makes it bigger, not for one that does not', async () => {
		const { client, id } = await setup();
		const zone = await atTheEdge(client, id, {});
		await call(client, 'set_component', { ...at(id), component: API_NAME, hosting: 'docker' });
		expect(await zoneNow(client, id)).toMatchObject({ width: zone.width, height: zone.height });
		const before = await read(client, id, API_NAME);
		await call(client, 'set_component', { ...at(id), component: API_NAME, skin: 'nextjs' });
		const after = await read(client, id, API_NAME);
		const grew = after.width > before.width || after.height > before.height;
		const now = await zoneNow(client, id);
		expect(grew).toBe(true);
		expect(now.width > zone.width || now.height > zone.height).toBe(true);
		expect(after.zone.name).toBe('VPC');
	});

	it('leaves its Zone as it is when it shrinks', async () => {
		const { client, id } = await setup();
		const zone = await atTheEdge(client, id, { skin: 'nextjs' });
		await call(client, 'set_component', { ...at(id), component: API_NAME, skin: 'generic' });
		expect(await zoneNow(client, id)).toMatchObject({ width: zone.width, height: zone.height });
	});

	it('ends outside every Zone when asked, even once small enough to fit in one', async () => {
		const { client, id } = await setup();
		await call(client, 'add_zone', { ...at(id), name: 'VPC' });
		const long = 'Payments and refunds';
		// Too wide for where it is, so outside, until its name is short.
		const place = async () => {
			await call(client, 'set_component', { ...at(id), component: 'Api', name: long });
			const { width } = await read(client, id, long);
			const zone = await zoneNow(client, id);
			await call(client, 'set_component', {
				...at(id),
				component: long,
				x: zone.x + zone.width - width + 10,
				y: zone.y + 60
			});
			expect((await read(client, id, long)).zone).toBeNull();
		};
		await call(client, 'add_component', { ...at(id), type: 'service', name: 'Api', zone: 'VPC' });
		await place();
		await call(client, 'set_component', { ...at(id), component: long, name: 'Api' });
		expect((await read(client, id, 'Api')).zone.name).toBe('VPC');
		await place();
		await call(client, 'set_component', { ...at(id), component: long, name: 'Api', zone: 'none' });
		expect((await read(client, id, 'Api')).zone).toBeNull();
	});

	it('refuses a call that changes nothing, a misnamed field included', async () => {
		const { client, id } = await setup();
		await call(client, 'add_component', { ...at(id), type: 'disk', name: 'SSD' });
		for (const args of [{}, { kind: 'ssd' }]) {
			const refused = await call(client, 'set_component', { ...at(id), component: 'SSD', ...args });
			expect(refused.error).toMatch(/^Give what to change: type, name/);
		}
	});

	it('hints at the runtime on a service only', async () => {
		const { client, id } = await setup();
		await call(client, 'add_component', { ...at(id), type: 'database', name: 'DB' });
		const refused = await call(client, 'set_component', {
			...at(id),
			component: 'DB',
			skin: 'bun'
		});
		expect(refused.error).toMatch(/^No "bun" Skin for a database\. Skins: generic, postgresql/);
	});
});

describe('MCP Areas', () => {
	const at = (id: string) => ({ project: id, diagram: 'Data' });
	const area = async (client: Client, id: string) =>
		(await call(client, 'get_diagram', at(id))).areas[0];

	it('draws one around elements, changes it, moves and deletes it', async () => {
		const { client, id } = await setup();
		await call(client, 'add_entity', { ...at(id), name: 'Customer' });
		await call(client, 'add_entity', { ...at(id), name: 'Order' });
		const added = await call(client, 'add_area', {
			...at(id),
			label: 'Sales',
			color: 'orange',
			around: ['Customer', 'Order']
		});
		const { entities, areas } = await call(client, 'get_diagram', at(id));
		expect(areas).toMatchObject([{ id: added.id, label: 'Sales', color: 'orange' }]);
		for (const e of entities) {
			expect(e.x).toBeGreaterThan(areas[0].x);
			expect(e.x + e.width).toBeLessThan(areas[0].x + areas[0].width);
			expect(e.y).toBeGreaterThan(areas[0].y);
			expect(e.y + e.height).toBeLessThan(areas[0].y + areas[0].height);
		}
		await call(client, 'set_area', { ...at(id), area: 'Sales', label: '', color: 'teal', x: 7 });
		expect(await area(client, id)).toEqual({ ...areas[0], label: '', color: 'teal', x: 7 });
		await call(client, 'move_elements', {
			...at(id),
			moves: [{ element: added.id, x: 1, y: 2 }]
		});
		const before = await area(client, id);
		expect(before).toMatchObject({ x: 1, y: 2 });
		await call(client, 'layout_diagram', at(id));
		expect(await area(client, id)).toEqual(before);
		await call(client, 'delete_elements', { ...at(id), elements: [added.id] });
		expect(await area(client, id)).toBeUndefined();
	});

	it('does not move where new elements go', async () => {
		const { client, id } = await setup();
		await call(client, 'add_entity', { ...at(id), name: 'Customer' });
		await call(client, 'add_area', { ...at(id), x: -900, y: -900, width: 4000, height: 4000 });
		await call(client, 'add_entity', { ...at(id), name: 'Order' });
		const { entities } = await call(client, 'get_diagram', at(id));
		expect(entities[1]).toMatchObject({ x: SLOT.width, y: 0 });
		const note = await call(client, 'add_note', { ...at(id), text: 'x', near: 'Order' });
		expect(note.error).toBeUndefined();
	});

	it('refuses what makes no sense', async () => {
		const { client, id } = await setup();
		const refused = async (tool: string, args: object) =>
			(await call(client, tool, { ...at(id), ...args })).error;
		const box = { x: 0, y: 0, width: 100, height: 100 };
		expect(await refused('add_area', { x: 0, y: 0, width: 100 })).toBe(
			'Give around, or x, y, width and height.'
		);
		expect(await refused('add_area', { around: ['Nope'] })).toMatch(/^No element "Nope"/);
		expect(await refused('add_area', { around: ['Nope'], x: 1 })).toMatch(/not both/);
		expect(await refused('add_area', { ...box, diagram: 'Architecture' })).toBe(
			'"Architecture" is not an MCD.'
		);
		const { id: areaId } = await call(client, 'add_area', { ...at(id), ...box, label: 'A' });
		expect(await refused('set_area', { area: 'A' })).toMatch(/^Give a label/);
		expect(await refused('set_area', { area: 'B', x: 1 })).toMatch(/^No area "B"\. Known: A/);
		await call(client, 'add_area', { ...at(id), ...box });
		expect(await refused('set_area', { area: '', x: 1 })).toMatch(/Known: .*area \(/);
		expect(await refused('rename_element', { element: areaId, name: 'B' })).toMatch(/^No element/);
		expect(await refused('add_attribute', { element: areaId, attribute: { name: 'x' } })).toMatch(
			/^No element/
		);
		const { areas } = await call(client, 'get_diagram', at(id));
		expect(areas.find((a: { id: string }) => a.id === areaId)).toMatchObject({
			...box,
			label: 'A'
		});
	});
});

describe('MCP label_position', () => {
	it('puts a label along its Connection, reads it back and gives it back to the automatic placing', async () => {
		const { client, id } = await setup();
		const at = { project: id, diagram: 'Architecture' };
		for (const name of ['A', 'B']) {
			await call(client, 'add_component', { ...at, type: 'service', name });
		}
		const { id: connection } = await call(client, 'connect_components', {
			...at,
			from: 'A',
			to: 'B',
			label: 'GET',
			label_position: 0.2
		});
		const position = async () =>
			(await call(client, 'get_diagram', at)).connections[0].label_position;
		expect(await position()).toBe(0.2);
		await call(client, 'set_connection', { ...at, connection, label_position: 0.75 });
		expect(await position()).toBe(0.75);
		await call(client, 'set_connection', { ...at, connection, label: 'POST' });
		expect(await position()).toBe(0.75);
		await call(client, 'set_connection', { ...at, connection, label_position: null });
		expect(await position()).toBeNull();
		for (const bad of [-0.1, 1.5, 'middle']) {
			const result = (await client
				.callTool({
					name: 'set_connection',
					arguments: { ...at, connection, label_position: bad }
				})
				.catch(() => ({ isError: true }))) as { isError?: boolean };
			expect(result.isError).toBe(true);
		}
		expect(await position()).toBeNull();
	});
});

describe('MCP Anchors', () => {
	it('attaches the ends of a Connection, moves and swaps them, and refuses what makes no sense', async () => {
		const { client, id } = await setup();
		const at = { project: id, diagram: 'Architecture' };
		for (const name of ['A', 'B', 'C']) {
			await call(client, 'add_component', { ...at, type: 'service', name });
		}
		await call(client, 'add_zone', { ...at, name: 'VPC' });
		const { id: connection } = await call(client, 'connect_components', {
			...at,
			from: 'A',
			to: 'B',
			label: 'GET',
			from_anchor: 'top-left'
		});
		const read = async () => (await call(client, 'get_diagram', at)).connections[0];
		const set = (args: object) => call(client, 'set_connection', { ...at, connection, ...args });
		expect(await read()).toMatchObject({ from_anchor: 'top-left', to_anchor: null });
		await set({ to_anchor: 'bottom' });
		expect(await read()).toMatchObject({ from_anchor: 'top-left', to_anchor: 'bottom' });
		// To another Component: automatic there, unless said.
		await set({ to: 'C' });
		expect(await read()).toMatchObject({ from: 'A', to: 'C', label: 'GET', to_anchor: null });
		await set({ to: 'B', to_anchor: 'right-top' });
		expect(await read()).toMatchObject({ to: 'B', to_anchor: 'right-top' });
		await set({ from_anchor: null });
		expect(await read()).toMatchObject({ from_anchor: null, to_anchor: 'right-top' });
		await set({ from: 'B', to: 'A', from_anchor: 'left' });
		expect(await read()).toMatchObject({
			from: 'B',
			to: 'A',
			from_anchor: 'left',
			to_anchor: null
		});

		// The end it is already attached to keeps its Anchor.
		await set({ from: 'B', to: 'C' });
		expect(await read()).toMatchObject({
			from: 'B',
			to: 'C',
			from_anchor: 'left',
			to_anchor: null
		});
		await set({ to: 'A' });

		const before = await read();
		expect((await set({ to: 'B', label: 'X' })).error).toBe(
			'A Component cannot connect to itself.'
		);
		expect((await set({ to: 'VPC', label: 'X' })).error).toMatch(/^No component "VPC"/);
		expect((await set({ to: 'Nope', label: 'X' })).error).toMatch(/^No component "Nope"/);
		const bad = (await client
			.callTool({ name: 'set_connection', arguments: { ...at, connection, to_anchor: 'middle' } })
			.catch(() => ({ isError: true }))) as { isError?: boolean };
		expect(bad.isError).toBe(true);
		expect(await read()).toEqual(before);
	});
});

describe('MCP and a Connection from a Component to itself', () => {
	it('changes what it can, and takes it elsewhere', async () => {
		const { client, id, browser } = await setup();
		const at = { project: id, diagram: 'Architecture' };
		for (const name of ['A', 'B']) {
			await call(client, 'add_component', { ...at, type: 'service', name });
		}
		const { id: connection } = await call(client, 'connect_components', {
			...at,
			from: 'A',
			to: 'B'
		});
		const d = browser.diagrams()[0].id;
		await vi.waitFor(() => expect(browser.edges(d)).toHaveLength(1));
		// As two peers moving both ends at once would leave it.
		const stored = browser.doc.getMap('diagrams') as never as Map<
			string,
			Map<string, Map<string, { set(key: string, value: unknown): void }>>
		>;
		stored.get(d)!.get('edges')!.get(connection)!.set('target', browser.edges(d)[0].source);
		const read = async () => (await call(client, 'get_diagram', at)).connections[0];
		await vi.waitFor(async () => expect(await read()).toMatchObject({ from: 'A', to: 'A' }));
		const set = (args: object) => call(client, 'set_connection', { ...at, connection, ...args });
		expect((await set({ label: 'again', from_anchor: 'top' })).error).toBeUndefined();
		expect(await read()).toMatchObject({ label: 'again', from_anchor: 'top' });
		expect((await set({ from: 'B', to: 'B' })).error).toBe('A Component cannot connect to itself.');
		await set({ to: 'B' });
		expect(await read()).toMatchObject({ from: 'A', to: 'B', from_anchor: 'top' });
	});
});
