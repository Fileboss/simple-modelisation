import { describe, expect, it } from 'vitest';
import { ENGLISH_NAMES } from '../names.ts';
import { ProjectDocument } from '../project.ts';
import { mcdSvg } from './mcd.ts';

/** Students take Courses taught by Teachers (a CIF), Students are People (an Inheritance). */
const mcd = () => {
	const project = new ProjectDocument();
	const d = project.addDiagram('mcd');
	const student = project.addEntity(d, 0, 0, 'Student');
	const course = project.addEntity(d, 400, 0, 'Course & <co>');
	const teacher = project.addEntity(d, 200, 300, 'Teacher');
	project.addAttribute(d, student, 'email');
	const takes = project.addAssociation(d, student, course, 'takes');
	project.addAttribute(d, takes, 'grade');
	const legs = () => project.edges(d).filter((e) => e.type === 'leg' && e.source === takes);
	const toCourse = legs().find((e) => e.target === course)!;
	project.setCardinality(d, toCourse.id, '1,n');
	const toTeacher = project.addLeg(d, takes, teacher);
	const cif = project.addCif(d, takes);
	project.setCifRole(d, cif, legs().find((e) => e.target === student)!.id, 'determinant');
	project.setCifRole(d, cif, toCourse.id, 'determinant');
	project.setCifRole(d, cif, toTeacher, 'determined');
	const person = project.addEntity(d, 0, -300, 'Person');
	project.setParent(d, student, person);
	const inheritance = project.nodes(d).find((n) => n.type === 'inheritance')!;
	project.setInheritanceConstraint(d, inheritance.id, 'XT');
	project.addNote(d, 600, 300, 'Spring term');
	return { project, d, nodes: project.nodes(d), edges: project.edges(d) };
};

const draw = (nodes: ReturnType<typeof mcd>['nodes'], edges: ReturnType<typeof mcd>['edges']) =>
	mcdSvg(nodes, edges, { notation: 'merise', names: ENGLISH_NAMES });

describe('mcdSvg in Merise', () => {
	it('draws plain shapes on white, framed on the content, with escaped text and no Legend', () => {
		const { nodes, edges } = mcd();
		const svg = draw(nodes, edges);
		expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
		expect(svg).not.toContain('foreignObject');
		expect(svg).toContain('fill="#fff"/>');
		expect(svg).toContain('>Course &amp; &lt;co&gt;</text>');
		expect(svg).not.toContain('Legend');
	});

	it('draws Entities in Looping colors, the Identifier underlined, and Associations with their Attributes', () => {
		const { nodes, edges } = mcd();
		const svg = draw(nodes, edges);
		expect(svg).toContain('fill="#fdd77d"');
		expect(svg).toContain('fill="#ffff99"');
		expect(svg).toContain('fill="#22e5f0"');
		expect(svg).toMatch(/text-decoration="underline"[^>]*>id<\/text>/);
		expect(svg).toMatch(/>email<\/text>/);
		expect(svg).toMatch(/>takes<\/text>/);
		expect(svg).toMatch(/>grade<\/text>/);
	});

	it('writes each Leg’s Cardinality, R in bold for a relative one', () => {
		const project = new ProjectDocument();
		const d = project.addDiagram('mcd');
		const line = project.addEntity(d, 0, 0, 'Line');
		const order = project.addEntity(d, 400, 0, 'Order');
		const has = project.addAssociation(d, line, order, 'has');
		const toLine = project.edges(d).find((e) => e.source === has && e.target === line)!;
		project.setCardinality(d, toLine.id, '1,1');
		project.setRelative(d, toLine.id, true);
		const svg = draw(project.nodes(d), project.edges(d));
		expect(svg).toContain('>1,1<tspan font-weight="700"> R</tspan></text>');
		expect(svg).toMatch(/>0,n<\/text>/);
	});

	it('draws a CIF with dashed lines and an arrow to the determined Entity, and an Inheritance with its constraint', () => {
		const { nodes, edges } = mcd();
		const svg = draw(nodes, edges);
		expect(svg).toContain('>CIF</text>');
		expect(svg.match(/stroke-dasharray="4 3"/g)).toHaveLength(3);
		expect(svg.match(/marker-end="url\(#cif-arrow\)"/g)).toHaveLength(1);
		expect(svg).toContain('<marker id="cif-arrow"');
		expect(svg).toMatch(/>XT<\/text>/);
		expect(svg).toMatch(/>Spring term<\/text>/);
	});

	it('follows a route stored by a Tidy up, and frames it', () => {
		const { project, d } = mcd();
		const leg = project.edges(d).find((e) => e.type === 'leg')!;
		project.arrange(d, new Map(), new Map([[leg.id, [{ x: 150, y: 900 }]]]), new Map());
		const svg = draw(project.nodes(d), project.edges(d));
		expect(svg).toMatch(/L ?150[ ,]/);
		const [, , , height] = svg
			.match(/viewBox="([^"]+)"/)![1]
			.split(' ')
			.map(Number);
		const [, top] = svg
			.match(/viewBox="([^"]+)"/)![1]
			.split(' ')
			.map(Number);
		expect(top + height).toBeGreaterThan(900);
	});
});

describe('mcdSvg framing', () => {
	it('holds the curved Legs and Cardinalities of a reflexive Association at the edge', () => {
		const project = new ProjectDocument();
		const d = project.addDiagram('mcd');
		const person = project.addEntity(d, 0, 0, 'Person');
		project.addAssociation(d, person, person, 'manages');
		for (const notation of ['merise', 'uml'] as const) {
			const svg = mcdSvg(project.nodes(d), project.edges(d), {
				notation,
				names: ENGLISH_NAMES,
				margin: 0
			});
			const [x, y, width, height] = svg
				.match(/viewBox="([^"]+)"/)![1]
				.split(' ')
				.map(Number);
			const labels = [
				...svg.matchAll(/<rect x="([^"]+)" y="([^"]+)" width="([^"]+)" height="15"/g)
			];
			expect(labels).toHaveLength(2);
			for (const [, lx, ly, lw] of labels) {
				expect(Number(lx)).toBeGreaterThanOrEqual(x - 0.01);
				expect(Number(ly)).toBeGreaterThanOrEqual(y - 0.01);
				expect(Number(lx) + Number(lw)).toBeLessThanOrEqual(x + width + 0.01);
				expect(Number(ly) + 15).toBeLessThanOrEqual(y + height + 0.01);
			}
		}
	});
});

describe('mcdSvg in UML', () => {
	const uml = (nodes: ReturnType<typeof mcd>['nodes'], edges: ReturnType<typeof mcd>['edges']) =>
		mcdSvg(nodes, edges, { notation: 'uml', names: ENGLISH_NAMES });

	it('draws classes with typed lines on white, no Looping colors, CIF or triangle', () => {
		const { nodes, edges } = mcd();
		const svg = uml(nodes, edges);
		expect(svg).not.toContain('fill="#fdd77d"');
		expect(svg).not.toContain('>CIF</text>');
		expect(svg).toContain('>id : Auto-increment {id}</text>');
		expect(svg).toContain('>email : Text</text>');
		expect(svg).toMatch(/>Course &amp; &lt;co&gt;<\/text>/);
	});

	it('names a binary Association on its line, its Attributes in an association class, multiplicities at the ends', () => {
		const project = new ProjectDocument();
		const d = project.addDiagram('mcd');
		const customer = project.addEntity(d, 0, 0, 'Customer');
		const order = project.addEntity(d, 400, 0, 'Order');
		const places = project.addAssociation(d, customer, order, 'places');
		project.addAttribute(d, places, 'at');
		const toOrder = project.edges(d).find((e) => e.target === order)!;
		project.setCardinality(d, toOrder.id, '1,1');
		const svg = uml(project.nodes(d), project.edges(d));
		expect(svg).toMatch(/font-style="italic"[^>]*>places<\/text>/);
		expect(svg).toContain('stroke-dasharray="5 4"');
		expect(svg).toContain('>at : Text</text>');
		// Each end shows the other Leg's Cardinality: 1 at Customer, 0..* at Order.
		expect(svg).toMatch(/font-weight="600"[^>]*>1<\/text>/);
		expect(svg).toMatch(/font-weight="600"[^>]*>0\.\.\*<\/text>/);
	});

	it('draws a composition as a filled diamond', () => {
		const project = new ProjectDocument();
		const d = project.addDiagram('mcd');
		const line = project.addEntity(d, 0, 0, 'Line');
		const order = project.addEntity(d, 400, 0, 'Order');
		const has = project.addAssociation(d, line, order, 'has');
		const toLine = project.edges(d).find((e) => e.source === has && e.target === line)!;
		project.setCardinality(d, toLine.id, '1,1');
		project.setRelative(d, toLine.id, true);
		const svg = uml(project.nodes(d), project.edges(d));
		expect(svg).toContain('<marker id="composition"');
		expect(svg.match(/marker-end="url\(#composition\)"/g)).toHaveLength(1);
	});

	it('draws an N-ary Association as a diamond with its CIFs as constraints, and generalisations', () => {
		const { nodes, edges } = mcd();
		const svg = uml(nodes, edges);
		expect(svg).toMatch(/font-style="italic"[^>]*>takes<\/text>/);
		expect(svg).toContain('>{Student, Course &amp; &lt;co&gt; → Teacher}</text>');
		expect(svg).toContain('<marker id="generalization"');
		expect(svg).toContain('>{disjoint, complete}</text>');
		expect(svg).not.toMatch(/>XT<\/text>/);
	});
});
