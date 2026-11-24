import { describe, expect, it } from 'vitest';
import { areasInOrder } from './areas.ts';
import { layoutDiagram, layoutFingerprint, estimatedSize } from './layout.ts';
import { ENGLISH_NAMES } from './names.ts';
import { AREA_COLORS, pasteable, ProjectDocument, type AreaNode } from './project.ts';
import { deriveMld } from './sql/mld.ts';
import { mcdSvg } from './svg/mcd.ts';

const BOX = { x: 10, y: 20, width: 300, height: 200 };

function setup() {
	const project = new ProjectDocument();
	project.rename('Shop');
	const d = project.addDiagram('mcd', 'Data');
	const area = (id: string) => project.nodes(d).find((n) => n.id === id) as AreaNode;
	const svg = (notation: 'merise' | 'uml' = 'merise') =>
		mcdSvg(project.nodes(d), project.edges(d), { notation, names: ENGLISH_NAMES });
	return { project, d, area, svg };
}

describe('Areas in the Project document', () => {
	it('adds one on an MCD only, and changes its label, color and box', () => {
		const { project, d, area } = setup();
		const id = project.addArea(d, { x: 1.4, y: 2.6, width: 300.2, height: 1 }, ' Billing\nnow ');
		expect(area(id)).toEqual({
			id,
			type: 'area',
			label: 'Billing now',
			x: 1,
			y: 3,
			width: 300,
			height: 24
		});
		for (const color of AREA_COLORS) {
			project.setAreaColor(d, id, color);
			expect(area(id).color ?? 'blue').toBe(color);
		}
		project.setAreaColor(d, id, 'blue');
		project.setAreaColor(d, id, 'black' as never);
		expect(area(id)).not.toHaveProperty('color');
		project.setAreaLabel(d, id, 'x'.repeat(500));
		expect(area(id).label).toHaveLength(200);
		project.setAreaLabel(d, id, `${' '.repeat(300)}Billing`);
		expect(area(id).label).toBe('Billing');
		project.setAreaLabel(d, id, `${'x'.repeat(199)}🚀🚀`);
		expect(area(id).label).toBe(`${'x'.repeat(199)}🚀`);
		project.setAreaLabel(d, id, ' ');
		expect(area(id).label).toBe('');
		project.setAreaBox(d, id, { x: -5, y: 0, width: 5000, height: NaN });
		expect(area(id).width).toBe(300);
		project.setAreaBox(d, id, { x: -5, y: 0, width: 5000, height: 3000 });
		expect(area(id)).toMatchObject({ x: -5, y: 0, width: 5000, height: 3000 });

		const system = project.addDiagram('system');
		expect(() => project.addArea(system, BOX)).toThrow('An Area goes on an MCD');
	});

	it('is kept by a file, a paste and a duplicate, and stays out of System design diagrams', () => {
		const { project, d, area } = setup();
		const id = project.addArea(d, BOX, 'Billing');
		project.setAreaColor(d, id, 'red');
		const file = JSON.parse(JSON.stringify(project.toFile()));
		expect(ProjectDocument.fromFile(file).toFile()).toEqual(project.toFile());
		const clip = { nodes: [{ ...area(id), provider: 'aws' }], edges: [] };
		expect(pasteable(clip, 'mcd').nodes).toEqual([area(id)]);
		expect(pasteable(clip, 'system').nodes).toEqual([]);
		const [copy] = project.nodes(project.duplicateDiagram(d));
		expect(copy).toEqual({ ...area(id), id: copy.id });
		project.deleteElements(d, [id], []);
		expect(project.nodes(d)).toEqual([]);
	});

	it('reads what a peer wrote within bounds, or leaves it out', () => {
		const { project, d, area } = setup();
		const id = project.addArea(d, BOX);
		const stored = (
			project.doc.getMap('diagrams') as never as Map<string, Map<string, Map<string, never>>>
		)
			.get(d)!
			.get('nodes')! as never as Map<string, { set(key: string, value: unknown): void }>;
		stored.get(id)!.set('label', 'a\nb'.repeat(200));
		stored.get(id)!.set('color', 'constructor');
		expect(area(id).label.length).toBeLessThanOrEqual(200);
		expect(area(id).label).not.toContain('\n');
		expect(area(id)).not.toHaveProperty('color');
		stored.get(id)!.set('width', 1);
		stored.get(id)!.set('x', 0.4);
		expect(area(id)).toMatchObject({ x: 0, width: 40, height: 200 });
		for (const attributes of [5, [null], 'x']) {
			stored.get(id)!.set('attributes', attributes);
			expect(area(id).label).not.toBe('');
		}
		stored.get(id)!.set('width', 'wide');
		expect(area(id)).toBeUndefined();
		expect(project.unreadable(d)).toBe(1);
	});
});

describe('Areas and the rest', () => {
	it('puts the bigger under the smaller', () => {
		const { project, d } = setup();
		const small = project.addArea(d, { ...BOX, width: 50, height: 50 });
		const big = project.addArea(d, BOX);
		expect(areasInOrder(project.nodes(d)).map((a) => a.id)).toEqual([big, small]);
	});

	it('is left alone by Tidy up, and changes nothing in it, the MLD or an Entity beside it', async () => {
		const { project, d } = setup();
		const [a, b] = ['A', 'B'].map((name) => project.addEntity(d, 0, 0, name));
		project.addAssociation(d, a, b, 'links');
		project.addNote(d, 10, 100, 'beside');
		const read = () => [project.nodes(d), project.edges(d)] as const;
		const tidy = async () => {
			const layout = await layoutDiagram(...read(), estimatedSize, 'mcd');
			return { positions: [...layout.positions], routes: [...layout.routes] };
		};
		const before = { tidy: await tidy(), print: layoutFingerprint(...read()) };
		const mld = deriveMld(...read());
		const id = project.addArea(d, { x: -500, y: -500, width: 2000, height: 2000 }, 'All');
		expect(await tidy()).toEqual(before.tidy);
		expect(layoutFingerprint(...read())).toBe(before.print);
		expect(deriveMld(...read())).toEqual(mld);
		expect(before.tidy.positions.map(([node]) => node)).not.toContain(id);
	});

	it.each(['merise', 'uml'] as const)('is drawn first and framed in %s', (notation) => {
		const { project, d, svg } = setup();
		project.addEntity(d, 100, 100, 'Customer');
		const alone = svg(notation);
		const small = project.addArea(d, { x: 90, y: 90, width: 60, height: 40 }, 'Small');
		project.addArea(d, { x: -400, y: -300, width: 900, height: 800 }, '<b>Bill & co</b>');
		project.setAreaColor(d, small, 'red');
		const image = svg(notation);
		expect(alone).not.toContain('#e6f0fe');
		const at = (text: string) => image.indexOf(text);
		expect(at('#e6f0fe')).toBeGreaterThan(0);
		expect(at('#e6f0fe')).toBeLessThan(at('#fde7e6'));
		expect(at('#fde7e6')).toBeLessThan(at('Customer'));
		expect(image).toContain('&lt;b&gt;Bill &amp; co&lt;/b&gt;');
		expect(image).toContain('viewBox="-432 -332 964 864"');
	});

	it('cuts a label too long for it, as the canvas does', () => {
		const { project, d, svg } = setup();
		project.addArea(d, { ...BOX, width: 100 }, 'Everything about billing');
		expect(svg()).toMatch(/>Everything…<\/text>/);
		expect(svg()).not.toContain('textLength');
	});

	it('draws a Diagram with only an Area, without a label', () => {
		const { project, d, svg } = setup();
		project.addArea(d, BOX);
		expect(svg()).toContain('#e6f0fe');
		expect(svg()).not.toContain('<text');
	});
});
