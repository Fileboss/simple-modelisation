import { describe, expect, it } from 'vitest';
import { ENGLISH_NAMES } from '../names.ts';
import { ProjectDocument } from '../project.ts';
import { estimatedSize } from '../layout.ts';
import { nodeBox } from '../zones.ts';
import { systemSvg } from './system.ts';

const nodeBoxOf = (node: Parameters<typeof nodeBox>[0]) => nodeBox(node, estimatedSize);

const diagram = () => {
	const project = new ProjectDocument();
	const d = project.addDiagram('system');
	const zone = project.addZone(d, 0, 0, 600, 240, 'VPS <prod>');
	project.setProvider(d, zone, 'ovhcloud');
	const api = project.addComponent(d, 'gateway', 'Caddy', 40, 80);
	project.setSkin(d, api, 'caddy');
	project.setHosting(d, api, 'docker');
	const app = project.addComponent(d, 'service', 'App & co', 320, 80);
	const db = project.addComponent(d, 'database', 'DB', 800, 80);
	project.setEdgeLabel(d, project.addConnection(d, api, app)!, 'HTTP');
	project.addConnection(d, app, db);
	return { nodes: project.nodes(d), edges: project.edges(d) };
};

describe('systemSvg', () => {
	it('draws Zones, Components and Connections as plain shapes, with escaped text', () => {
		const { nodes, edges } = diagram();
		const svg = systemSvg(nodes, edges, { names: ENGLISH_NAMES });
		expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
		expect(svg).not.toContain('foreignObject');
		expect(svg.match(/stroke-dasharray/g)).toHaveLength(1);
		expect(svg.match(/marker-end="url\(#arrow\)"/g)).toHaveLength(2);
		expect(svg).toContain('VPS &lt;prod&gt;');
		expect(svg).toContain('App &amp; co');
		expect(svg).toContain('>HTTP</text>');
		// Caddy's Skin under its name, the generic type for the others; the inherited Provider and the Hosting as badges.
		expect(svg).toContain('>Caddy</text>');
		expect(svg).toContain('>Service</text>');
		expect(svg).toContain('<title>Provider: OVHcloud</title>');
		expect(svg).toContain('<title>Hosting: Docker</title>');
	});

	it('gives the same image for the same Diagram', () => {
		const { nodes, edges } = diagram();
		const names = ENGLISH_NAMES;
		expect(systemSvg(nodes, edges, { names })).toBe(systemSvg(nodes, edges, { names }));
	});

	it('frames an empty Diagram without failing', () => {
		expect(systemSvg([], [], { names: ENGLISH_NAMES })).toContain('</svg>');
	});

	it('keeps the SVG well formed and its shapes inside the frame', () => {
		const project = new ProjectDocument();
		const d = project.addDiagram('system');
		project.addZone(d, 0, 0, 200, 120, 'Production VPS cluster in eu-west-3');
		const a = project.addComponent(d, 'service', 'A\u0001B', 20, 40);
		const b = project.addComponent(d, 'service', 'C', 400, 40);
		const connection = project.addConnection(d, a, b)!;
		// A route around the boxes, far below them.
		project.arrange(
			d,
			new Map(),
			new Map([
				[
					connection,
					[
						{ x: 300, y: 72 },
						{ x: 300, y: 600 },
						{ x: 380, y: 600 },
						{ x: 380, y: 72 }
					]
				]
			])
		);
		const svg = systemSvg(project.nodes(d), project.edges(d), { names: ENGLISH_NAMES });
		// eslint-disable-next-line no-control-regex -- the characters XML forbids
		expect(svg).not.toMatch(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/);
		expect(svg).toContain('>AB</text>');
		expect(svg).toContain('…</text>');
		expect(svg).not.toContain('Production VPS cluster in eu-west-3');
		const viewBox = /viewBox="[-\d.]+ ([-\d.]+) [-\d.]+ ([-\d.]+)"/.exec(svg)!;
		expect(Number(viewBox[1]) + Number(viewBox[2])).toBeGreaterThan(600);
	});

	it("shows a Service's Runtime as its logo, or as a badge beside its Skin", () => {
		const project = new ProjectDocument();
		const d = project.addDiagram('system');
		const indexer = project.addComponent(d, 'service', 'Indexer', 0, 0);
		project.setRuntime(d, indexer, 'rust');
		const web = project.addComponent(d, 'service', 'Web', 300, 0);
		project.setSkin(d, web, 'nextjs');
		project.setRuntime(d, web, 'bun');
		const svg = systemSvg(project.nodes(d), [], { names: ENGLISH_NAMES });
		expect(svg).toContain('>Rust</text>');
		expect(svg).not.toContain('<title>Runtime: Rust</title>');
		expect(svg).toContain('>Next.js</text>');
		expect(svg).toContain('<title>Runtime: Bun</title>');
	});

	it('draws a Skin without a brand as its line glyph', () => {
		const project = new ProjectDocument();
		const d = project.addDiagram('system');
		project.setSkin(d, project.addComponent(d, 'client', 'Visitor', 0, 0), 'browser');
		const svg = systemSvg(project.nodes(d), [], { names: ENGLISH_NAMES });
		expect(svg).toContain('>Web browser</text>');
		expect(svg).toMatch(/<path d="M12 3a9 9[^"]*" fill="none" stroke="#0284c7"/);
	});

	it('colors a Connection by its Flow and names the Flow in its pill', () => {
		const project = new ProjectDocument();
		const d = project.addDiagram('system');
		const app = project.addComponent(d, 'service', 'platform', 0, 0);
		const images = project.addComponent(d, 'service', 'getImage', 400, 0);
		const db = project.addComponent(d, 'database', 'material', 400, 200);
		const rest = project.addConnection(d, app, images)!;
		project.setEdgeLabel(d, rest, 'REST');
		project.setConnectionFlow(d, rest, 'read');
		project.setConnectionFlow(d, project.addConnection(d, app, db)!, 'read-write');
		const svg = systemSvg(project.nodes(d), project.edges(d), { names: ENGLISH_NAMES });
		expect(svg).toContain('stroke="#2563eb" stroke-width="1.5" marker-end="url(#arrow-2563eb)"');
		expect(svg).toContain('<marker id="arrow-2563eb"');
		expect(svg).toContain('<tspan fill="#2563eb">Read</tspan> · REST');
		// A Flow without a label still gets its pill.
		expect(svg).toContain('<tspan fill="#7c3aed">Read/Write</tspan></text>');
		expect(svg).not.toContain('<marker id="arrow"');
	});

	it('draws a Person as a silhouette: a disc in its role color, its name and role, no badges', () => {
		const project = new ProjectDocument();
		const d = project.addDiagram('system');
		const zone = project.addZone(d, 0, 0, 400, 300, 'AWS');
		project.setProvider(d, zone, 'aws');
		project.setSkin(d, project.addComponent(d, 'person', 'Buyer', 40, 60), 'customer');
		const svg = systemSvg(project.nodes(d), [], { names: ENGLISH_NAMES });
		expect(svg).toContain('<circle');
		expect(svg).toContain('fill="#db2777"');
		expect(svg).toContain('>Buyer</text>');
		expect(svg).toContain('>Customer</text>');
		// The Zone's Provider is drawn on the Zone only: a Person takes none.
		expect(svg.match(/<title>Provider: AWS<\/title>/g)).toHaveLength(1);
	});

	it('draws a Note as paper in its color, its text wrapped', () => {
		const project = new ProjectDocument();
		const d = project.addDiagram('system');
		const note = project.addNote(d, 0, 0, 'Syncs every night at 2 a.m. from KDP & getImage');
		project.setNoteColor(d, note, 'green');
		const svg = systemSvg(project.nodes(d), [], { names: ENGLISH_NAMES });
		expect(svg).toContain('fill="#dcfce7"');
		// 22 characters a line at the Note's width.
		expect(svg).toContain('>Syncs every night at 2</text>');
		expect(svg).toContain('>a.m. from KDP &amp;</text>');
		expect(svg).toContain('>getImage</text>');
	});

	it('reads only catalog entries, whatever a peer writes', () => {
		const project = new ProjectDocument();
		const d = project.addDiagram('system');
		project.addComponent(d, 'service', 'Odd', 0, 0);
		const [node] = project.nodes(d);
		const crafted = [
			{ ...node, componentType: 'constructor', skin: '__proto__', hosting: 'toString' }
		];
		const svg = systemSvg(crafted, [], { names: ENGLISH_NAMES });
		expect(svg).toContain('>Odd</text>');
		// An unknown type looks like the first one, as on the canvas.
		expect(svg).toContain('>Client</text>');
		expect(svg).not.toContain('undefined');
		expect(svg).not.toContain('Object');
	});

	describe('Legend', () => {
		/** The Legend's group, or undefined: the last group moved under the content. */
		const legendOf = (svg: string) =>
			/<g transform="translate\([-\d.]+ [-\d.]+\)"><rect x="0.5" y="0.5"[^]*?<\/g>(?=\n<\/svg>|\n<)/.exec(
				svg
			)?.[0];
		const keyTexts = (svg: string) =>
			[...(legendOf(svg) ?? '').matchAll(/>([^<>]+)<\/text>/g)].map((m) => m[1]);

		it('names the Flows, Providers, Hostings and Runtimes drawn, in badge order', () => {
			const project = new ProjectDocument();
			const d = project.addDiagram('system');
			const zone = project.addZone(d, 0, 0, 600, 240, 'eu-west-3');
			project.setProvider(d, zone, 'ovhcloud');
			const web = project.addComponent(d, 'service', 'Web', 40, 80);
			project.setSkin(d, web, 'nextjs');
			project.setRuntime(d, web, 'bun');
			project.setHosting(d, web, 'docker');
			const db = project.addComponent(d, 'database', 'DB', 320, 80);
			project.setHosting(d, db, 'managed');
			project.setConnectionFlow(d, project.addConnection(d, web, db)!, 'read-write');
			const svg = systemSvg(project.nodes(d), project.edges(d), { names: ENGLISH_NAMES });
			expect(keyTexts(svg)).toEqual([
				'Flow',
				'Read/Write',
				'Provider',
				'OVHcloud',
				'Hosting',
				'Docker',
				'Managed (cloud)',
				'Runtime',
				'Bun'
			]);
			// Its badges are not titled again: the Legend prints their names.
			expect(svg.match(/<title>Provider: OVHcloud<\/title>/g)).toHaveLength(3);
		});

		it('leaves out what is not drawn as a mark', () => {
			const project = new ProjectDocument();
			const d = project.addDiagram('system');
			const zone = project.addZone(d, 0, 0, 600, 240, 'Hetzner');
			project.setProvider(d, zone, 'hetzner');
			// An External service shows no Provider, a Runtime without a Skin is the Service's logo.
			const api = project.addComponent(d, 'service', 'Payments', 40, 80);
			project.setHosting(d, api, 'external');
			const indexer = project.addComponent(d, 'service', 'Indexer', 320, 80);
			project.setRuntime(d, indexer, 'rust');
			project.addConnection(d, indexer, api);
			const svg = systemSvg(project.nodes(d), project.edges(d), { names: ENGLISH_NAMES });
			// The Zone's own Provider badge is named, once.
			expect(keyTexts(svg)).toEqual(['Provider', 'Hetzner', 'Hosting', 'External service']);
		});

		it('is left out with nothing to name, or when turned off', () => {
			const { nodes, edges } = diagram();
			expect(legendOf(systemSvg(nodes, edges, { names: ENGLISH_NAMES }))).toBeDefined();
			expect(
				legendOf(systemSvg(nodes, edges, { names: ENGLISH_NAMES, legend: false }))
			).toBeUndefined();
			const project = new ProjectDocument();
			const d = project.addDiagram('system');
			project.addConnection(
				d,
				project.addComponent(d, 'service', 'A', 0, 0),
				project.addComponent(d, 'service', 'B', 300, 0)
			);
			expect(
				legendOf(systemSvg(project.nodes(d), project.edges(d), { names: ENGLISH_NAMES }))
			).toBeUndefined();
		});

		it('sits under the content, bottom right, inside the frame', () => {
			const project = new ProjectDocument();
			const d = project.addDiagram('system');
			// A single box: the Legend's right edge on its right edge, under it.
			const db = project.addComponent(d, 'database', 'DB', 0, 0);
			project.setHosting(d, db, 'kubernetes');
			project.setProvider(d, db, 'google-cloud');
			const svg = systemSvg(project.nodes(d), [], { names: ENGLISH_NAMES });
			const [, vx, vy, vw, vh] = /viewBox="([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)"/
				.exec(svg)!
				.map(Number);
			const [, kx, ky] = /<g transform="translate\(([-\d.]+) ([-\d.]+)\)"><rect x="0.5"/
				.exec(svg)!
				.map(Number);
			const [, kw, kh] = /<rect x="0.5" y="0.5" width="([\d.]+)" height="([\d.]+)"/
				.exec(svg)!
				.map(Number);
			const box = nodeBoxOf(project.nodes(d)[0]);
			expect(ky).toBeGreaterThan(box.y + box.height);
			expect(kx + kw + 1).toBeCloseTo(box.x + box.width, 0);
			expect(kx).toBeGreaterThanOrEqual(vx);
			expect(ky + kh).toBeLessThanOrEqual(vy + vh);
			expect(kx + kw).toBeLessThanOrEqual(vx + vw);
		});

		it('prints the names it is given, escaped', () => {
			const { nodes, edges } = diagram();
			const names = {
				...ENGLISH_NAMES,
				titles: { ...ENGLISH_NAMES.titles, hosting: 'Hébergement <x>' }
			};
			expect(keyTexts(systemSvg(nodes, edges, { names }))).toContain('Hébergement &lt;x&gt;');
		});
	});
});
