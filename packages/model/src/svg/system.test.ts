import { describe, expect, it } from 'vitest';
import { ENGLISH_NAMES } from '../names.ts';
import { ProjectDocument } from '../project.ts';
import { systemSvg } from './system.ts';

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
});
