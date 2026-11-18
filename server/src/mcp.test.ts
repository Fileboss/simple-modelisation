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
			'add_component',
			'add_diagram',
			'add_entity',
			'add_zone',
			'connect_components',
			'delete_elements',
			'get_diagram',
			'get_mcd_sql',
			'get_project',
			'layout_diagram',
			'rename_element',
			'set_cardinality',
			'set_hosting',
			'set_provider',
			'set_skin',
			'set_zone'
		]);
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
		await call(client, 'set_skin', { ...at, component: 'Finance', skin: 'bun' });
		const refused = await call(client, 'set_skin', {
			...at,
			component: 'Finance',
			skin: 'tailscale'
		});
		expect(refused.error).toMatch(/No "tailscale" Skin/);
		const { components } = await call(client, 'get_diagram', at);
		expect(components.map((c: { name: string; skin: string }) => [c.name, c.skin])).toEqual([
			['Proxy', 'caddy'],
			['Finance', 'bun']
		]);
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
