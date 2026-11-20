import { borderPoint, center, type Box } from '../geometry.ts';
import { estimatedSize, type Size } from '../layout.ts';
import {
	cifConstraints,
	cifLinks,
	generalizations,
	legLine,
	twinPositions,
	umlAttribute,
	umlLayout,
	umlMultiplicity,
	type Notation
} from '../mcd-drawing.ts';
import type {
	Attribute,
	DiagramEdge,
	DiagramNode,
	InheritanceNode,
	LegEdge,
	Point
} from '../project.ts';
import type { SvgNames } from './system.ts';
import { nodeBox } from '../zones.ts';
import { bounds, escape, fit, FONT, noteShape, TEXT } from './shapes.ts';

export type McdSvgOptions = {
	notation: Notation;
	/** The names the image prints: the app passes its UI strings, the server the English ones. */
	names: SvgNames;
	/** Each box's size as the canvas measured it; without one, the model's estimate for the Notation. */
	measured?: (node: DiagramNode) => Size | undefined;
	margin?: number;
};

// Looping's colors, as the canvas draws them (index.css).
const LINE = '#1d1b22';
const ENTITY_HEADER = '#fdd77d';
const ENTITY_BODY = '#ffff99';
const ASSOCIATION = '#22e5f0';
const SHADOW = 4;
// The canvas's text: names 15px bold over 2px padding, Attributes 13px, 1.3 line height.
const HEADER = 24.5;
const LINE_HEIGHT = 16.9;
// Rough widths per character, to narrow a text wider than its box (sizes may be estimates).
const NAME_CHAR = 8.6;
const LINE_CHAR = 7;

/**
 * An MCD as plain SVG shapes (rects, paths, text), framed on its content with
 * a margin, on white, in either Notation, as the canvas draws it. No Legend.
 */
export function mcdSvg(
	nodes: DiagramNode[],
	edges: DiagramEdge[],
	{ notation, names, measured = () => undefined, margin = 32 }: McdSvgOptions
): string {
	const estimate =
		notation === 'uml' ? umlEstimate(edges) : (node: DiagramNode) => estimatedSize(node, 'merise');
	const sizeOf = (node: DiagramNode) => measured(node) ?? estimate(node);
	const { parts, extent, defs } =
		notation === 'uml'
			? umlDrawing(nodes, edges, names, sizeOf)
			: meriseDrawing(nodes, edges, sizeOf);
	const frame = bounds(extent);
	const x = frame.x - margin;
	const y = frame.y - margin;
	const width = Math.ceil(frame.width + margin * 2);
	const height = Math.ceil(frame.height + margin * 2);
	return [
		`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${x} ${y} ${width} ${height}" font-family="${FONT}">`,
		defs.length ? `<defs>${defs.join('')}</defs>` : '',
		`<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="#fff"/>`,
		...parts,
		'</svg>'
	]
		.filter(Boolean)
		.join('\n');
}

/** What a Notation draws: its shapes in drawing order, what they cover, their markers. */
type Drawing = { parts: string[]; extent: Box[]; defs: string[] };

/** What a Leg covers beyond its boxes, which the frame must hold: its line's far points and its label. */
const legBoxes = (through: Point[], label: Point, text: string): Box[] => [
	...through.map((p) => ({ x: p.x - 6, y: p.y - 6, width: 12, height: 12 })),
	{
		x: label.x - (text.length * 7 + 6) / 2,
		y: label.y - 7.5,
		width: text.length * 7 + 6,
		height: 15
	}
];

function meriseDrawing(
	nodes: DiagramNode[],
	edges: DiagramEdge[],
	sizeOf: (node: DiagramNode) => Size
): Drawing {
	const boxes = new Map(nodes.map((n) => [n.id, nodeBox(n, sizeOf)]));
	// The boxes' shadow reaches past them.
	const extent: Box[] = [...boxes.values()].map((box) => ({
		...box,
		width: box.width + SHADOW,
		height: box.height + SHADOW
	}));
	const lines: string[] = [];
	const shapes: string[] = [];
	const labels: string[] = [];
	const defs: string[] = [];

	// Lines under the boxes, Cardinalities over everything, as on the canvas.
	const twins = twinPositions(edges);
	for (const edge of edges) {
		const source = boxes.get(edge.source);
		const target = boxes.get(edge.target);
		if (!source || !target) continue;
		if (edge.type === 'leg') {
			const leg = edge as LegEdge;
			const { path, label, through } = legLine(
				source,
				target,
				{ ...leg, ...twins.get(edge.id)! },
				false
			);
			lines.push(`<path d="${path}" fill="none" stroke="${LINE}" stroke-width="1.2"/>`);
			labels.push(cardinalityShape(leg, label));
			extent.push(...legBoxes(through, label, `${leg.cardinality} R`));
		} else if (edge.type === 'isa') {
			lines.push(straightLine(source, target));
		}
	}
	for (const node of nodes) {
		if (node.type !== 'inheritance') continue;
		const parent = boxes.get((node as InheritanceNode).parent);
		if (parent) lines.push(straightLine(boxes.get(node.id)!, parent));
	}
	for (const link of cifLinks(nodes, edges)) {
		const from = boxes.get(link.cif);
		const to = boxes.get(link.entity);
		if (!from || !to) continue;
		if (link.determined && defs.length === 0) defs.push(arrowMarker('cif-arrow', 8, false));
		lines.push(
			straightLine(
				from,
				to,
				` stroke-dasharray="4 3"${link.determined ? ' marker-end="url(#cif-arrow)"' : ''}`
			)
		);
	}

	for (const node of nodes) {
		const box = boxes.get(node.id)!;
		if (node.type === 'note') shapes.push(noteShape(node, box));
		else if (node.type === 'entity') shapes.push(entityShape(node, box));
		else if (node.type === 'association') shapes.push(associationShape(node, box));
		else if (node.type === 'cif') shapes.push(cifShape(box));
		else if (node.type === 'inheritance')
			shapes.push(inheritanceShape(node as InheritanceNode, box));
	}
	return { parts: [...lines, ...shapes, ...labels], extent, defs };
}

/** A straight line between two boxes, border to border, with `extra` attributes. */
function straightLine(from: Box, to: Box, extra = ''): string {
	const start = borderPoint(from, center(to));
	const end = borderPoint(to, center(from));
	return `<path d="M ${start.x},${start.y} L ${end.x},${end.y}" fill="none" stroke="${LINE}" stroke-width="1.2"${extra}/>`;
}

/** An arrowhead `size` wide, filled with the line's color or hollow (white, outlined). */
const arrowMarker = (id: string, size: number, hollow: boolean) =>
	`<marker id="${id}" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="${size}" markerHeight="${size}"${hollow ? ' markerUnits="userSpaceOnUse"' : ''} orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="${hollow ? '#fff' : LINE}"${hollow ? ` stroke="${LINE}"` : ''}/></marker>`;

/** Attribute lines from `top`, `left` aligned or centered on `x`; an Identifier underlined. */
function attributeLines(
	attributes: Attribute[],
	x: number,
	top: number,
	room: number,
	anchor: 'start' | 'middle'
): string[] {
	return attributes.map((attribute, i) => {
		const name = attribute.name;
		const identifier = attribute.identifier ? ' font-weight="600" text-decoration="underline"' : '';
		return `<text x="${x}" y="${top + LINE_HEIGHT * (i + 0.5)}" font-size="13" fill="#000" dy="0.35em" text-anchor="${anchor}"${identifier}${fit(name, LINE_CHAR, room)}>${escape(name)}</text>`;
	});
}

/** A name in bold, centered on its line. */
function nameText(name: string, box: Box, middle: number): string {
	return `<text x="${box.x + box.width / 2}" y="${middle}" font-size="15" font-weight="700" fill="#000" text-anchor="middle" dy="0.35em"${fit(name, NAME_CHAR, box.width - 20)}>${escape(name)}</text>`;
}

const shadow = (box: Box, rx = 0) =>
	`<rect x="${box.x + SHADOW}" y="${box.y + SHADOW}" width="${box.width}" height="${box.height}" rx="${rx}" fill="#000" fill-opacity="0.25"/>`;

/** An Entity in Looping's style: orange header with its name, yellow body, Identifier underlined. */
function entityShape(entity: DiagramNode, box: Box): string {
	const attributes = (entity.attributes as Attribute[] | undefined) ?? [];
	return [
		shadow(box),
		`<rect x="${box.x + 0.5}" y="${box.y + 0.5}" width="${box.width - 1}" height="${box.height - 1}" fill="${ENTITY_BODY}" stroke="${LINE}"/>`,
		`<rect x="${box.x + 0.5}" y="${box.y + 0.5}" width="${box.width - 1}" height="${HEADER}" fill="${ENTITY_HEADER}" stroke="${LINE}"/>`,
		nameText(String(entity.name ?? ''), box, box.y + 1 + (HEADER - 1) / 2),
		...attributeLines(attributes, box.x + 7, box.y + HEADER + 3, box.width - 14, 'start')
	].join('');
}

/** An Association in Looping's style: a cyan rounded box, its name over its Attributes. */
function associationShape(association: DiagramNode, box: Box): string {
	const attributes = (association.attributes as Attribute[] | undefined) ?? [];
	const rx = Math.min(26, box.height / 2);
	const divider = box.y + 1 + HEADER - 1;
	return [
		shadow(box, rx),
		`<rect x="${box.x + 0.5}" y="${box.y + 0.5}" width="${box.width - 1}" height="${box.height - 1}" rx="${rx}" fill="${ASSOCIATION}" stroke="${LINE}"/>`,
		`<path d="M ${box.x + 0.5},${divider} L ${box.x + box.width - 0.5},${divider}" stroke="${LINE}"/>`,
		nameText(String(association.name ?? ''), box, box.y + 1 + (HEADER - 1) / 2),
		...attributeLines(attributes, box.x + box.width / 2, divider + 3, box.width - 36, 'middle')
	].join('');
}

/** A CIF, as in Looping: a circle marked CIF. */
function cifShape(box: Box): string {
	const c = center(box);
	return [
		`<circle cx="${c.x}" cy="${c.y}" r="${box.width / 2 - 0.75}" fill="#fff" stroke="${LINE}" stroke-width="1.5"/>`,
		`<text x="${c.x}" y="${c.y}" font-size="11" font-weight="700" fill="#000" text-anchor="middle" dy="0.35em">CIF</text>`
	].join('');
}

/** An Inheritance, as in Looping: a triangle, its constraint inside. */
function inheritanceShape(inheritance: InheritanceNode, box: Box): string {
	const sx = box.width / 56;
	const sy = box.height / 40;
	const at = (x: number, y: number) => `${box.x + x * sx},${box.y + y * sy}`;
	return [
		`<path d="M ${at(28, 2)} L ${at(54, 38)} L ${at(2, 38)} Z" fill="#fff" stroke="${LINE}" stroke-width="1.5"/>`,
		inheritance.constraint
			? `<text x="${box.x + box.width / 2}" y="${box.y + 14 + 7}" font-size="11" font-weight="700" fill="#000" text-anchor="middle" dy="0.35em">${escape(inheritance.constraint)}</text>`
			: ''
	].join('');
}

/** A Cardinality as the canvas shows it: on white, centered on its point, R in bold. */
function cardinalityShape(leg: LegEdge, at: Point): string {
	const text = `${leg.cardinality}${leg.relative ? ' R' : ''}`;
	const width = text.length * 6.6 + 6;
	const content = leg.relative
		? `${escape(leg.cardinality)}<tspan font-weight="700"> R</tspan>`
		: escape(text);
	return [
		`<rect x="${at.x - width / 2}" y="${at.y - 7.5}" width="${width}" height="15" rx="3" fill="#fff"/>`,
		`<text x="${at.x}" y="${at.y}" font-size="12" fill="${TEXT}" text-anchor="middle" dy="0.35em">${content}</text>`
	].join('');
}

// UML, as the canvas draws it (index.css): classes in black on white, 1.5px borders.
const UML_BORDER = 1.5;
// A class's name 14px bold over 4px padding, its lines 13px at 1.35, padded 4px over and 6px under.
const UML_HEADER = 4 + 14 * 1.35 + 4;
const UML_LINE = 13 * 1.35;
const UML_CHAR = 7.2;
// A binary Association's name: 12px italic, 1px and 6px padding.
const UML_LABEL_CHAR = 6.4;
const UML_LABEL_HEIGHT = 12 * 1.45 + 2;
const DIAMOND = 44;
// How far an association class floats from its line: above it, or beside a vertical one.
const CLASS_GAP = { top: 28, right: 40 };

/**
 * The server's guess of the boxes UML draws: classes from their lines, a
 * binary Association's box is its name, an N-ary one's its diamond.
 */
function umlEstimate(edges: DiagramEdge[]): (node: DiagramNode) => Size {
	const legCounts = new Map<string, number>();
	for (const e of edges)
		if (e.type === 'leg') legCounts.set(e.source, (legCounts.get(e.source) ?? 0) + 1);
	return (node) => {
		if (node.type !== 'association') return estimatedSize(node, 'uml');
		if ((legCounts.get(node.id) ?? 0) > 2) return { width: DIAMOND, height: DIAMOND };
		return {
			width: String(node.name ?? '').length * UML_LABEL_CHAR + 14,
			height: UML_LABEL_HEIGHT
		};
	};
}

function umlDrawing(
	nodes: DiagramNode[],
	edges: DiagramEdge[],
	names: SvgNames,
	sizeOf: (node: DiagramNode) => Size
): Drawing {
	const layout = umlLayout(nodes, edges, sizeOf);
	// A binary Association's name sits between its classes, wherever it is stored.
	const boxes = new Map(
		nodes.map((n) => {
			const at = layout.associations.get(n.id)?.at;
			return [n.id, at ? { ...at, ...sizeOf(n) } : nodeBox(n, sizeOf)];
		})
	);
	// CIFs are written under their diamond, Inheritances become generalisations: neither is a box.
	const drawn = nodes.filter((n) => n.type !== 'cif' && n.type !== 'inheritance');
	const extent: Box[] = drawn.map((n) => boxes.get(n.id)!);
	const lines: string[] = [];
	const shapes: string[] = [];
	const labels: string[] = [];
	const defs = new Set<string>();

	const twins = twinPositions(edges);
	for (const edge of edges) {
		if (edge.type !== 'leg') continue;
		const source = boxes.get(edge.source);
		const target = boxes.get(edge.target);
		if (!source || !target) continue;
		const leg = edge as LegEdge;
		const uml = layout.legs.get(edge.id);
		// A Leg UML cannot place (an Association with one Leg) is drawn as in Merise.
		const { path, label, through } = legLine(
			source,
			target,
			{ ...leg, ...twins.get(edge.id)! },
			!!uml
		);
		if (uml?.composition) defs.add(COMPOSITION);
		lines.push(
			`<path d="${path}" fill="none" stroke="${LINE}" stroke-width="1.2"${uml?.composition ? ' marker-end="url(#composition)"' : ''}/>`
		);
		const text = uml ? umlMultiplicity(uml.peer.cardinality) : `${leg.cardinality} R`;
		labels.push(uml ? multiplicityShape(text, label) : cardinalityShape(leg, label));
		extent.push(...legBoxes(through, label, text));
	}
	for (const generalization of generalizations(nodes, edges)) {
		const child = boxes.get(generalization.child);
		const parent = boxes.get(generalization.parent);
		if (!child || !parent) continue;
		defs.add(arrowMarker('generalization', 14, true));
		lines.push(straightLine(child, parent, ' marker-end="url(#generalization)"'));
		if (generalization.constraint) {
			const end = borderPoint(parent, center(child));
			const at = { x: end.x + 8, y: end.y + 12 };
			labels.push(
				`<text x="${at.x}" y="${at.y + 8}" font-size="12" fill="#000" dy="0.35em">${escape(generalization.constraint)}</text>`
			);
			extent.push({ x: at.x, y: at.y, width: generalization.constraint.length * 6.6, height: 16 });
		}
	}

	const constraints = cifConstraints(nodes, edges);
	for (const node of drawn) {
		const box = boxes.get(node.id)!;
		if (node.type === 'note') shapes.push(noteShape(node, box));
		else if (node.type === 'entity') shapes.push(classShape(node, box, names));
		else if (node.type === 'association') {
			const uml = layout.associations.get(node.id);
			const shape = uml?.nary
				? diamondShape(node, box, constraints.get(node.id) ?? [])
				: associationLabel(node, box);
			shapes.push(shape.svg);
			extent.push(...shape.extent);
			const attributes = (node.attributes as Attribute[] | undefined) ?? [];
			if (attributes.length > 0) {
				const associationClass = associationClassShape(attributes, box, uml?.side ?? 'top', names);
				shapes.push(associationClass.svg);
				extent.push(associationClass.box);
			}
		}
	}
	return { parts: [...lines, ...shapes, ...labels], extent, defs: [...defs] };
}

/** A filled diamond at a Leg's class end: that class's Entity is identified relative to the other. */
const COMPOSITION = `<marker id="composition" viewBox="0 0 16 10" refX="16" refY="5" markerWidth="24" markerHeight="15" markerUnits="userSpaceOnUse" orient="auto"><path d="M 0 5 L 8 0 L 16 5 L 8 10 z" fill="${LINE}"/></marker>`;

/** A UML multiplicity, semibold on white, centered on its point. */
function multiplicityShape(text: string, at: Point): string {
	const width = text.length * 7 + 6;
	return [
		`<rect x="${at.x - width / 2}" y="${at.y - 7.5}" width="${width}" height="15" rx="3" fill="#fff"/>`,
		`<text x="${at.x}" y="${at.y}" font-size="12" font-weight="600" fill="${TEXT}" text-anchor="middle" dy="0.35em">${escape(text)}</text>`
	].join('');
}

/** UML lines, `name : Type {id} [0..1]`, from `top`. */
function umlLines(attributes: Attribute[], x: number, top: number, room: number, names: SvgNames) {
	return attributes.map((attribute, i) => {
		const line = umlAttribute(attribute, names.dataTypes);
		return `<text x="${x}" y="${top + UML_LINE * (i + 0.5)}" font-size="13" fill="#000" dy="0.35em"${fit(line, UML_CHAR, room)}>${escape(line)}</text>`;
	});
}

/** An Entity as a UML class: its name in bold over its typed lines. */
function classShape(entity: DiagramNode, box: Box, names: SvgNames): string {
	const attributes = (entity.attributes as Attribute[] | undefined) ?? [];
	const divider = box.y + UML_BORDER + UML_HEADER;
	const inset = UML_BORDER / 2;
	return [
		`<rect x="${box.x + inset}" y="${box.y + inset}" width="${box.width - UML_BORDER}" height="${box.height - UML_BORDER}" fill="#fff" stroke="${LINE}" stroke-width="${UML_BORDER}"/>`,
		`<path d="M ${box.x},${divider} L ${box.x + box.width},${divider}" stroke="${LINE}" stroke-width="${UML_BORDER}"/>`,
		`<text x="${box.x + box.width / 2}" y="${box.y + UML_BORDER + UML_HEADER / 2}" font-size="14" font-weight="700" fill="#000" text-anchor="middle" dy="0.35em"${fit(String(entity.name ?? ''), NAME_CHAR, box.width - 20)}>${escape(String(entity.name ?? ''))}</text>`,
		...umlLines(
			attributes,
			box.x + UML_BORDER + 8,
			divider + UML_BORDER / 2 + 4,
			box.width - 19,
			names
		)
	].join('');
}

/** A binary Association's name in italic, on white over its line. */
function associationLabel(association: DiagramNode, box: Box): { svg: string; extent: Box[] } {
	const name = String(association.name ?? '');
	return {
		svg: [
			`<rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" rx="4" fill="#fff"/>`,
			`<text x="${box.x + box.width / 2}" y="${box.y + box.height / 2}" font-size="12" font-style="italic" fill="#000" text-anchor="middle" dy="0.35em">${escape(name)}</text>`
		].join(''),
		extent: []
	};
}

/** An N-ary Association: a diamond, its name under it, then its CIFs as constraints. */
function diamondShape(
	association: DiagramNode,
	box: Box,
	constraints: { text: string }[]
): { svg: string; extent: Box[] } {
	const sx = box.width / DIAMOND;
	const sy = box.height / DIAMOND;
	const at = (x: number, y: number) => `${box.x + x * sx},${box.y + y * sy}`;
	const middle = box.x + box.width / 2;
	const bottom = box.y + box.height;
	const name = String(association.name ?? '');
	const texts = [
		{ text: name, y: bottom + 4 + 8.5, italic: true },
		...constraints.map((c, i) => ({ text: c.text, y: bottom + 22 + 8.5 + i * 17, italic: false }))
	];
	return {
		svg: [
			`<path d="M ${at(22, 2)} L ${at(42, 22)} L ${at(22, 42)} L ${at(2, 22)} Z" fill="#fff" stroke="${LINE}" stroke-width="1.5"/>`,
			...texts.map(
				(t) =>
					`<text x="${middle}" y="${t.y}" font-size="12"${t.italic ? ' font-style="italic"' : ''} fill="#000" text-anchor="middle" dy="0.35em">${escape(t.text)}</text>`
			)
		].join(''),
		extent: texts.map((t) => {
			const width = t.text.length * 6.6;
			return { x: middle - width / 2, y: t.y - 8.5, width, height: 17 };
		})
	};
}

/** An association class beside its Association's name or diamond, joined to it by a dashed line. */
function associationClassShape(
	attributes: Attribute[],
	anchor: Box,
	side: 'top' | 'right',
	names: SvgNames
): { svg: string; box: Box } {
	const lines = attributes.map((a) => umlAttribute(a, names.dataTypes));
	const width = Math.max(
		120,
		Math.max(...lines.map((l) => l.length)) * UML_CHAR + 16 + UML_BORDER * 2
	);
	const height = Math.max(18, 4 + lines.length * UML_LINE + 6) + UML_BORDER * 2;
	const middle = center(anchor);
	const box =
		side === 'top'
			? { x: middle.x - width / 2, y: anchor.y - CLASS_GAP.top - height, width, height }
			: { x: anchor.x + anchor.width + CLASS_GAP.right, y: middle.y - height / 2, width, height };
	const link =
		side === 'top'
			? `M ${middle.x},${anchor.y} L ${middle.x},${box.y + height}`
			: `M ${anchor.x + anchor.width},${middle.y} L ${box.x},${middle.y}`;
	const inset = UML_BORDER / 2;
	return {
		svg: [
			`<path d="${link}" fill="none" stroke="${LINE}" stroke-width="1.5" stroke-dasharray="5 4"/>`,
			`<rect x="${box.x + inset}" y="${box.y + inset}" width="${width - UML_BORDER}" height="${height - UML_BORDER}" fill="#fff" stroke="${LINE}" stroke-width="${UML_BORDER}"/>`,
			...umlLines(attributes, box.x + UML_BORDER + 8, box.y + UML_BORDER + 4, width - 19, names)
		].join(''),
		box
	};
}
