import { describe, expect, it } from 'vitest';
import { clipBounds, copyElements, readClip } from './clipboard.ts';
import { ProjectDocument } from './project.ts';

function system() {
	const project = new ProjectDocument();
	const d = project.addDiagram('system');
	const zone = project.addZone(d, 0, 0, 400, 300, 'EU');
	const api = project.addComponent(d, 'service', 'API', 40, 60);
	const db = project.addComponent(d, 'database', 'DB', 220, 60);
	const outside = project.addComponent(d, 'client', 'App', 600, 60);
	const internal = project.addConnection(d, api, db)!;
	project.setEdgeLabel(d, internal, 'SQL');
	project.addConnection(d, outside, api);
	project.arrange(d, new Map(), new Map([[internal, [{ x: 200, y: 92 }]]]), new Map());
	return { project, d, zone, api, db, outside, internal };
}

describe('copyElements', () => {
	it('takes a Zone with what it holds, and only the Connections between what it takes', () => {
		const { project, d, zone, api, db, internal } = system();
		const clip = copyElements(project.nodes(d), project.edges(d), [zone], 'system');
		expect(clip.nodes.map((n) => n.id).sort()).toEqual([zone, api, db].sort());
		expect(clip.edges.map((e) => e.id)).toEqual([internal]);
		expect(clipBounds(clip.nodes)).toEqual({ x: 0, y: 0, width: 400, height: 300 });
	});
});

describe('readClip', () => {
	it('reads a clip back, and nothing else', () => {
		const { project, d, api } = system();
		const clip = copyElements(project.nodes(d), project.edges(d), [api], 'system');
		expect(readClip(JSON.stringify(clip))).toEqual(clip);
		expect(readClip('hello')).toBeNull();
		expect(readClip('{"format":"other"}')).toBeNull();
		expect(readClip(JSON.stringify({ ...clip, nodes: 'x' }))).toBeNull();
	});
});

describe('paste', () => {
	it('pastes with new ids, edges following their ends and routes shifted, in one undo step', () => {
		const { project, d, zone, internal } = system();
		const clip = copyElements(project.nodes(d), project.edges(d), [zone], 'system');
		project.stopCapturing();
		const pasted = project.paste(d, clip, 500, 24);
		// Three nodes and their Connection.
		expect(pasted).toHaveLength(4);
		const nodes = project.nodes(d).filter((n) => pasted.includes(n.id));
		expect(nodes.map((n) => [n.name, n.x, n.y]).sort()).toEqual([
			['API', 540, 84],
			['DB', 720, 84],
			['EU', 500, 24]
		]);
		const copy = project.edges(d).find((e) => pasted.includes(e.source));
		expect(copy).toMatchObject({ label: 'SQL', points: [{ x: 700, y: 116 }] });
		expect(copy!.id).not.toBe(internal);
		expect(pasted).toContain(copy!.target);
		expect(pasted).toContain(copy!.id);
		project.undo();
		expect(project.nodes(d)).toHaveLength(4);
	});

	it('leaves out what the target kind does not take, keeping Notes', () => {
		const project = new ProjectDocument();
		const mcd = project.addDiagram('mcd');
		const a = project.addEntity(mcd, 0, 0, 'Order');
		const b = project.addEntity(mcd, 300, 0, 'Item');
		project.addAssociation(mcd, a, b);
		const note = project.addNote(mcd, 0, 200, 'Orders keep 10 years');
		const clip = copyElements(
			project.nodes(mcd),
			project.edges(mcd),
			project.nodes(mcd).map((n) => n.id),
			'mcd'
		);
		const system = project.addDiagram('system');
		const pasted = project.paste(system, clip, 0, 0);
		expect(project.nodes(system).map((n) => n.type)).toEqual(['note']);
		expect(project.edges(system)).toEqual([]);
		expect(pasted).toHaveLength(1);
		expect(note).not.toBe(pasted[0]);
		// Into another MCD, everything goes, Legs included.
		const other = project.addDiagram('mcd');
		project.paste(other, clip, 10, 10);
		expect(project.nodes(other)).toHaveLength(4);
		expect(project.edges(other)).toHaveLength(2);
	});

	it('never pastes an Association without its two Legs, nor anything malformed', () => {
		const project = new ProjectDocument();
		const mcd = project.addDiagram('mcd');
		const a = project.addEntity(mcd, 0, 0, 'Order');
		const b = project.addEntity(mcd, 300, 0, 'Item');
		const link = project.addAssociation(mcd, a, b)!;
		// The Association and one of its Entities: one Leg only.
		const clip = copyElements(project.nodes(mcd), project.edges(mcd), [link, a], 'mcd');
		const target = project.addDiagram('mcd');
		project.paste(
			target,
			{ ...clip, nodes: [...clip.nodes, { id: 'x', type: 'entity', x: 'a' } as never] },
			0,
			0
		);
		expect(project.nodes(target).map((n) => n.name)).toEqual(['Order']);
		expect(project.edges(target)).toEqual([]);
		expect(project.paste(target, clip, NaN, 0)).toEqual([]);
	});

	it('keeps only the fields the app writes, read as reads do', () => {
		const { project, d, api, db } = system();
		const clip = copyElements(project.nodes(d), project.edges(d), [api, db], 'system');
		const crafted = {
			...clip,
			nodes: clip.nodes.map((n) => ({ ...n, junk: 'x'.repeat(1000) })),
			edges: clip.edges.map((e) => ({ ...e, flow: 'bogus', extra: { deep: true } }))
		};
		const target = project.addDiagram('system');
		project.paste(target, crafted, 0, 0);
		expect(project.nodes(target)).toHaveLength(2);
		for (const node of project.nodes(target)) expect(node).not.toHaveProperty('junk');
		const [edge] = project.edges(target);
		expect(edge).not.toHaveProperty('extra');
		expect(edge).not.toHaveProperty('flow');
		// What was stored, not only what reads show.
		const stored = JSON.stringify(project.doc.getMap('diagrams').toJSON());
		expect(stored).not.toContain('bogus');
		expect(stored).not.toContain('junk');
	});

	it('stores a Data type with its own fields only', () => {
		const project = new ProjectDocument();
		const mcd = project.addDiagram('mcd');
		const order = project.addEntity(mcd, 0, 0, 'Order');
		const clip = copyElements(project.nodes(mcd), project.edges(mcd), [order], 'mcd');
		const crafted = {
			...clip,
			nodes: clip.nodes.map((n) => ({
				...n,
				attributes: [{ id: 'a', name: 'ref', identifier: false, type: { kind: 'text', junk: 1 } }]
			}))
		};
		const target = project.addDiagram('mcd');
		project.paste(target, crafted, 0, 0);
		expect(JSON.stringify(project.doc.getMap('diagrams').toJSON())).not.toContain('junk');
	});

	it('imports a file with the fields the app writes only', () => {
		const { project } = system();
		const file = project.toFile();
		const [diagram] = file.diagrams;
		const crafted = {
			...file,
			diagrams: [
				{
					...diagram,
					nodes: diagram.nodes.map((n) => ({ ...n, junk: 1 })),
					edges: diagram.edges.map((e) => ({ ...e, flow: 'bogus', junk: 1 }))
				}
			]
		};
		const imported = ProjectDocument.fromFile(crafted);
		const stored = JSON.stringify(imported.doc.getMap('diagrams').toJSON());
		expect(stored).not.toContain('junk');
		expect(stored).not.toContain('bogus');
		expect(imported.nodes(diagram.id)).toHaveLength(diagram.nodes.length);
	});
});
