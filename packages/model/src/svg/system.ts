import { connectionRoute, routedPath, type Box, type Point } from '../geometry.ts';
import { pillText, placeLabels, roughWidth, type MeasureText } from '../label-placement.ts';
import { estimatedSize, type Size } from '../layout.ts';
import { bounds, escape, fit, FONT, noteShape, own, TEXT } from './shapes.ts';
import { FALLBACK_COMPONENT_TYPE, isPerson } from '../component-types.ts';
import {
	FLOW_COLORS,
	HOSTING_MARKS,
	PROVIDER_MARKS,
	RUNTIME_LOOKS,
	SKIN_LOOKS,
	TYPE_LOOKS,
	type SkinLook
} from '../looks.ts';
import { skinFits } from '../skins.ts';
import type {
	ComponentType,
	DiagramEdge,
	DiagramNode,
	DiskKind,
	Flow,
	Hosting,
	Provider,
	Runtime
} from '../project.ts';
import type { ENGLISH_NAMES } from '../names.ts';
import { effectiveProviders, nodeBox, zoneParents } from '../zones.ts';

/** The names the image prints: the app passes its UI strings, the server the English ones. */
export type SvgNames = typeof ENGLISH_NAMES;

export type SvgOptions = {
	names: SvgNames;
	/** Each box's size: what the canvas measured, else the model's estimate. */
	sizeOf?: (node: DiagramNode) => Size;
	/** A Connection label's text width, as the canvas measures it. */
	measure?: MeasureText;
	margin?: number;
	/** A Legend under the content, bottom right, naming the marks drawn; on by default. */
	legend?: boolean;
};

/** The marks a drawn image shows that its Legend names. */
type Shown = {
	flows: Set<Flow>;
	providers: Set<Provider>;
	hostings: Set<Hosting>;
	runtimes: Set<Runtime>;
};

// The canvas styles (index.css), so the image looks like the screen.
const EDGE = '#475569';
const BORDER = '#e3e1e8';
const ZONE = '#94a3b8';
const BADGE = 18;
// Rough widths of the canvas fonts, per character: Zone titles (12px semibold), names (15px semibold).
const ZONE_CHAR = 7.4;
const NAME_CHAR = 8.6;

/**
 * A System design diagram as plain SVG shapes (rects, paths, text), framed on
 * its content with a margin, on white: Zones, Connections with their arrows
 * and labels, Components with their logo, name, subtitle and badges. Opens in
 * browsers, design tools and slides alike.
 */
export function systemSvg(
	nodes: DiagramNode[],
	edges: DiagramEdge[],
	{ names, sizeOf = estimatedSize, measure = roughWidth, margin = 32, legend = true }: SvgOptions
): string {
	const shown: Shown = {
		flows: new Set(),
		providers: new Set(),
		hostings: new Set(),
		runtimes: new Set()
	};
	const boxes = new Map(nodes.map((n) => [n.id, nodeBox(n, sizeOf)]));
	const parents = zoneParents(nodes, estimatedSize);
	const providers = effectiveProviders(nodes, parents);
	const depth = (id: string) => {
		let count = 0;
		for (let at = parents.get(id); at; at = parents.get(at)) count++;
		return count;
	};
	const zones = nodes.filter((n) => n.type === 'zone').sort((a, b) => depth(a.id) - depth(b.id));
	const components = nodes.filter((n) => n.type === 'component');
	const connections = edges.filter((e) => e.type === 'connection');
	// Each Connection's Flow and pill text, once: a Flow a newer file or peer wrote that this
	// version does not know is drawn as none.
	const pills = new Map(
		connections.map((e) => {
			const flow = own(FLOW_COLORS, e.flow) ? (e.flow as Flow) : undefined;
			return [e.id, { flow, text: pillText(String(e.label ?? ''), flow && names.flows[flow]) }];
		})
	);

	// Labels go where the canvas puts them: on their routes, clear of boxes and of each other.
	const notes = nodes.filter((n) => n.type === 'note');
	const solid = new Map(components.map((n) => [n.id, boxes.get(n.id)!]));
	// Notes block labels too, as on the canvas; they are no Connection's end.
	const obstacles = new Map([...solid, ...notes.map((n) => [n.id, boxes.get(n.id)!] as const)]);
	const labels = placeLabels(
		obstacles,
		connections.map((e) => ({
			id: e.id,
			source: e.source,
			target: e.target,
			label: pills.get(e.id)!.text,
			points: e.points as Point[] | undefined
		})),
		measure
	);
	// One arrowhead per color drawn: the neutral one, and each Flow's.
	const colors = new Set<string>();
	// Pills go over every line, as on the canvas: a later line must not cross an earlier pill.
	const pillShapes: string[] = [];

	const parts: string[] = [];
	const extent: Box[] = [...boxes.values()];
	for (const zone of zones) parts.push(zoneShape(zone, boxes.get(zone.id)!, names, shown));
	for (const edge of connections) {
		const source = solid.get(edge.source);
		const target = solid.get(edge.target);
		if (!source || !target) continue;
		const route = connectionRoute(source, target, edge.points as Point[] | undefined);
		// A route may run outside the boxes (around them): the frame holds it too.
		for (const p of route) extent.push({ x: p.x - 6, y: p.y - 6, width: 12, height: 12 });
		const { flow, text } = pills.get(edge.id)!;
		const color = flow ? FLOW_COLORS[flow] : EDGE;
		colors.add(color);
		if (flow) shown.flows.add(flow);
		parts.push(
			`<path d="${routedPath(route)}" fill="none" stroke="${color}" stroke-width="1.5" marker-end="url(#${arrowId(color)})"/>`
		);
		const at = labels.get(edge.id);
		if (at && text) {
			const width = measure(text) + 14;
			extent.push({ x: at.x - width / 2, y: at.y - 9, width, height: 18 });
			// The Flow's name in its color, then the rest of the pill text.
			const name = flow ? names.flows[flow] : '';
			const content = flow
				? `<tspan fill="${color}">${escape(name)}</tspan>${escape(text.slice(name.length))}`
				: escape(text);
			pillShapes.push(
				`<rect x="${at.x - width / 2}" y="${at.y - 9}" width="${width}" height="18" rx="4" fill="#fff" stroke="${BORDER}"/>`,
				`<text x="${at.x}" y="${at.y}" font-size="11.25" fill="${TEXT}" text-anchor="middle" dy="0.35em">${content}</text>`
			);
		}
	}
	// Notes over the lines, the pills over everything, as on the canvas.
	for (const note of notes) parts.push(noteShape(note, boxes.get(note.id)!));
	parts.push(...pillShapes);
	for (const component of components) {
		parts.push(
			componentShape(
				component,
				boxes.get(component.id)!,
				providers.get(component.id)?.provider,
				names,
				shown
			)
		);
	}

	const content = bounds(extent);
	if (legend) {
		const key = legendShape(shown, names, measure, content);
		if (key) {
			parts.push(key.svg);
			extent.push(key.box);
		}
	}
	const frame = bounds(extent);
	const x = frame.x - margin;
	const y = frame.y - margin - BADGE / 2;
	const width = Math.ceil(frame.width + margin * 2);
	const height = Math.ceil(frame.height + margin * 2 + BADGE / 2);
	return [
		`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${x} ${y} ${width} ${height}" font-family="${FONT}">`,
		`<defs>${[...colors]
			.map(
				(color) =>
					`<marker id="${arrowId(color)}" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="${color}"/></marker>`
			)
			.join('')}</defs>`,
		`<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="#fff"/>`,
		...parts,
		'</svg>'
	].join('\n');
}

function zoneShape(zone: DiagramNode, box: Box, names: SvgNames, shown: Shown): string {
	const provider = own(PROVIDER_MARKS, zone.provider) ? (zone.provider as Provider) : undefined;
	if (provider) shown.providers.add(provider);
	const logo = provider ? 20 : 0;
	// As on the canvas: the title stays inside the Zone, cut with an ellipsis.
	const room = Math.max(0, box.width - 16 - 16 - logo);
	const full = String(zone.name ?? '');
	const fits = Math.floor(room / ZONE_CHAR);
	const name = full.length > fits ? `${full.slice(0, Math.max(0, fits - 1))}…` : full;
	const title = Math.min(box.width - 16, Math.max(24, name.length * ZONE_CHAR + 16 + logo));
	return [
		`<rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" rx="12" fill="#94a3b8" fill-opacity="0.07" stroke="${ZONE}" stroke-width="1.5" stroke-dasharray="6 4"/>`,
		`<rect x="${box.x + 8}" y="${box.y + 6}" width="${title}" height="20" rx="6" fill="#94a3b8" fill-opacity="0.18"/>`,
		provider ? providerBadge(provider, box.x + 12, box.y + 8, 16, names) : '',
		`<text x="${box.x + 16 + logo}" y="${box.y + 16}" font-size="12" font-weight="600" fill="#475569" dy="0.35em">${escape(name)}</text>`
	].join('');
}

/** An arrowhead's marker id: "arrow" for the neutral color, else named after its color. */
const arrowId = (color: string) => (color === EDGE ? 'arrow' : `arrow-${color.slice(1)}`);

function componentShape(
	component: DiagramNode,
	box: Box,
	provider: Provider | undefined,
	names: SvgNames,
	shown: Shown
): string {
	const type = component.componentType as ComponentType;
	// As the canvas: an unknown type looks like the first one, a Skin only on a type offering it.
	const known = own(TYPE_LOOKS, type) ? type : FALLBACK_COMPONENT_TYPE;
	const typeLook = TYPE_LOOKS[known];
	const skin =
		typeof component.skin === 'string' && skinFits(known, component.skin)
			? own(SKIN_LOOKS, component.skin)
			: undefined;
	if (isPerson(known)) return personShape(component, box, skin, typeLook, names);
	const runtime = known === 'service' ? own(RUNTIME_LOOKS, component.runtime) : undefined;
	if (skin && runtime) shown.runtimes.add(component.runtime as Runtime);
	// The Skin's logo, else the Runtime's: a Runtime beside a Skin is a badge.
	const look = skin ?? runtime;
	const color = look?.color ?? typeLook.color;
	const name = String(component.name ?? '');
	const diskKind = type === 'disk' ? (component.diskKind as DiskKind | undefined) : undefined;
	const subtitle = look?.name ?? (diskKind ? own(names.diskKinds, diskKind) : names.types[known]);
	const middle = box.y + box.height / 2;
	const icon = box.x + 14;
	const text = icon + 28 + 10;
	const narrowed = fit(name, NAME_CHAR, box.x + box.width - 14 - text);
	const hosting = component.hosting as Hosting | undefined;
	const badged = hosting === 'external' ? undefined : provider;

	const parts = [
		`<rect x="${box.x + 1}" y="${box.y + 1}" width="${box.width - 2}" height="${box.height - 2}" rx="10" fill="#fff" stroke="${color}" stroke-width="2"/>`,
		logoShape(look, typeLook.glyph, color, icon, middle - 14, 28)
	];
	if (subtitle && subtitle !== name) {
		parts.push(
			`<text x="${text}" y="${middle - 8}" font-size="15" font-weight="600" fill="${TEXT}" dy="0.35em"${narrowed}>${escape(name)}</text>`,
			`<text x="${text}" y="${middle + 11}" font-size="11.25" fill="${color}" dy="0.35em">${escape(subtitle)}</text>`
		);
	} else {
		parts.push(
			`<text x="${text}" y="${middle}" font-size="15" font-weight="600" fill="${TEXT}" dy="0.35em"${narrowed}>${escape(name)}</text>`
		);
	}
	// Badges in the top-right corner, read left to right: on what, at whom, then how it runs.
	const badges: string[] = [];
	if (skin && runtime) badges.push(runtimeBadge(runtime, names));
	if (badged) {
		badges.push(providerBadge(badged, 0, 0, BADGE, names));
		shown.providers.add(badged);
	}
	if (hosting && own(HOSTING_MARKS, hosting)) {
		badges.push(hostingBadge(hosting, 0, 0, names));
		shown.hostings.add(hosting);
	}
	badges.forEach((badge, i) => {
		const right = box.x + box.width + 9 - (badges.length - 1 - i) * (BADGE + 6);
		parts.push(`<g transform="translate(${right - BADGE - 2} ${box.y - 11})">${badge}</g>`);
	});
	return parts.join('');
}

/** A Person as the canvas draws it: a disc in its role's color, its name and role under it, no badges. */
function personShape(
	person: DiagramNode,
	box: Box,
	role: SkinLook | undefined,
	typeLook: (typeof TYPE_LOOKS)[ComponentType],
	names: SvgNames
): string {
	const color = role?.color ?? typeLook.color;
	const name = String(person.name ?? '');
	const kind = role?.name ?? names.types.person;
	const centre = box.x + box.width / 2;
	const disc = box.y + 6 + 22;
	const narrowed = fit(name, NAME_CHAR, box.width - 12);
	const parts = [
		`<circle cx="${centre}" cy="${disc}" r="22" fill="${color}"/>`,
		`<svg x="${centre - 13}" y="${disc - 13}" width="26" height="26" viewBox="0 0 24 24"><path d="${role?.glyph ?? typeLook.glyph}" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
		`<text x="${centre}" y="${disc + 22 + 16}" font-size="15" font-weight="600" fill="${TEXT}" text-anchor="middle" dy="0.35em"${narrowed}>${escape(name)}</text>`
	];
	if (kind !== name) {
		parts.push(
			`<text x="${centre}" y="${disc + 22 + 34}" font-size="11.25" fill="${color}" text-anchor="middle" dy="0.35em">${escape(kind)}</text>`
		);
	}
	return parts.join('');
}

/** A Skin's or a Runtime's logo or line glyph, its initials without either, or the type's generic glyph. */
function logoShape(
	skin: SkinLook | undefined,
	glyph: string,
	color: string,
	x: number,
	y: number,
	size: number
): string {
	if (skin?.logo) {
		return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 24 24"><path d="${skin.logo}" fill="${color}"/></svg>`;
	}
	if (skin && !skin.glyph) {
		const initials = skin.name
			.split(/\s+/)
			.map((word) => word[0])
			.join('')
			.slice(0, 2);
		return `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="6" fill="${color}"/><text x="${x + size / 2}" y="${y + size / 2}" font-size="${size * 0.42}" font-weight="700" fill="#fff" text-anchor="middle" dy="0.35em">${escape(initials)}</text>`;
	}
	return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 24 24"><path d="${skin?.glyph ?? glyph}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

/**
 * A round badge with a white ring, its mark in white (or its ink) on its color;
 * titled with what it stands for, except in the Legend, which prints it.
 */
function badge(color: string, inner: string, title: string, x: number, y: number, size: number) {
	const r = size / 2;
	return `<g>${title ? `<title>${escape(title)}</title>` : ''}<circle cx="${x + r + 2}" cy="${y + r + 2}" r="${r + 2}" fill="#fff"/><circle cx="${x + r + 2}" cy="${y + r + 2}" r="${r}" fill="${color}"/><svg x="${x + 2 + size * 0.19}" y="${y + 2 + size * 0.19}" width="${size * 0.62}" height="${size * 0.62}" viewBox="0 0 24 24">${inner}</svg></g>`;
}

function runtimeBadge(
	runtime: (typeof RUNTIME_LOOKS)[Runtime],
	names: SvgNames,
	titled = true
): string {
	return badge(
		runtime.color,
		`<path d="${runtime.logo}" fill="#fff"/>`,
		titled ? `${names.titles.runtime}: ${runtime.name}` : '',
		0,
		0,
		BADGE
	);
}

function hostingBadge(
	hosting: Hosting,
	x: number,
	y: number,
	names: SvgNames,
	titled = true
): string {
	const { color, icon } = HOSTING_MARKS[hosting];
	const inner =
		icon.kind === 'logo'
			? `<path d="${icon.path}" fill="#fff"/>`
			: `<path d="${icon.path}" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`;
	const title = titled ? `${names.titles.hosting}: ${names.hostings[hosting]}` : '';
	return badge(color, inner, title, x, y, BADGE);
}

function providerBadge(
	provider: Provider,
	x: number,
	y: number,
	size: number,
	names: SvgNames,
	titled = true
): string {
	const { color, mark } = PROVIDER_MARKS[provider];
	const inner =
		mark.kind === 'logo'
			? `<path d="${mark.path}" fill="#fff"/>`
			: mark.kind === 'line'
				? `<path d="${mark.path}" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`
				: `<text x="12" y="12" text-anchor="middle" dy="0.35em" textLength="${mark.text.length > 2 ? 24 : 20}" lengthAdjust="spacingAndGlyphs" font-size="${mark.text.length > 2 ? 15 : 17}" font-weight="800" fill="${mark.ink}">${escape(mark.text)}</text>`;
	const title = titled ? `${names.titles.provider}: ${names.providers[provider]}` : '';
	return badge(color, inner, title, x, y, size);
}

// The Legend's layout: its padding, a heading's and an entry row's height, the gaps.
const KEY_PAD = 12;
const KEY_HEAD = 18;
const KEY_ROW = 26;
const KEY_GAP = 14;
const KEY_ARROW = 24;
// Its entries wrap past the content's width, but no narrower than this.
const KEY_MIN_WIDTH = 280;

type KeyEntry = { mark: (x: number, middle: number) => string; markWidth: number; label: string };

/**
 * The Legend: a framed box a gap under the content, its right edge on the
 * content's, naming the marks drawn, a section per kind in badge order and the
 * entries in each catalog's order; a Flow's arrowhead is already defined by
 * the Connections drawn in it. Null with nothing to name.
 */
function legendShape(
	shown: Shown,
	names: SvgNames,
	measure: MeasureText,
	content: Box
): { svg: string; box: Box } | null {
	const ring = BADGE + 4;
	const sections: { title: string; entries: KeyEntry[] }[] = [
		{
			title: names.titles.flow,
			entries: (Object.keys(FLOW_COLORS) as Flow[])
				.filter((flow) => shown.flows.has(flow))
				.map((flow): KeyEntry => ({
					// The arrow drawn on Connections, short.
					mark: (x, middle) =>
						`<path d="M${x} ${middle} L${x + KEY_ARROW} ${middle}" fill="none" stroke="${FLOW_COLORS[flow]}" stroke-width="1.5" marker-end="url(#${arrowId(FLOW_COLORS[flow])})"/>`,
					markWidth: KEY_ARROW,
					label: names.flows[flow]
				}))
		},
		{
			title: names.titles.provider,
			entries: (Object.keys(PROVIDER_MARKS) as Provider[])
				.filter((provider) => shown.providers.has(provider))
				.map((provider): KeyEntry => ({
					mark: (x, middle) => providerBadge(provider, x, middle - ring / 2, BADGE, names, false),
					markWidth: ring,
					label: names.providers[provider]
				}))
		},
		{
			title: names.titles.hosting,
			entries: (Object.keys(HOSTING_MARKS) as Hosting[])
				.filter((hosting) => shown.hostings.has(hosting))
				.map((hosting): KeyEntry => ({
					mark: (x, middle) => hostingBadge(hosting, x, middle - ring / 2, names, false),
					markWidth: ring,
					label: names.hostings[hosting]
				}))
		},
		{
			title: names.titles.runtime,
			entries: (Object.keys(RUNTIME_LOOKS) as Runtime[])
				.filter((runtime) => shown.runtimes.has(runtime))
				.map((runtime): KeyEntry => ({
					mark: (x, middle) =>
						`<g transform="translate(${x} ${middle - ring / 2})">${runtimeBadge(RUNTIME_LOOKS[runtime], names, false)}</g>`,
					markWidth: ring,
					label: RUNTIME_LOOKS[runtime].name
				}))
		}
	].filter((section) => section.entries.length > 0);
	if (sections.length === 0) return null;

	// Laid out from the box's top-left corner, then moved under the content.
	const room = Math.max(KEY_MIN_WIDTH, content.width) - KEY_PAD * 2;
	const parts: string[] = [];
	let y = KEY_PAD;
	let widest = 0;
	for (const section of sections) {
		// Headings are semibold: a little wider than the entries' text.
		widest = Math.max(widest, measure(section.title) * 1.1);
		parts.push(
			`<text x="${KEY_PAD}" y="${y + KEY_HEAD / 2}" font-size="11.25" font-weight="600" fill="#475569" dy="0.35em">${escape(section.title)}</text>`
		);
		y += KEY_HEAD;
		let x = 0;
		for (const entry of section.entries) {
			const width = entry.markWidth + 6 + measure(entry.label);
			if (x > 0 && x + width > room) {
				x = 0;
				y += KEY_ROW;
			}
			const middle = y + KEY_ROW / 2;
			parts.push(
				entry.mark(KEY_PAD + x, middle),
				`<text x="${KEY_PAD + x + entry.markWidth + 6}" y="${middle}" font-size="11.25" fill="${TEXT}" dy="0.35em">${escape(entry.label)}</text>`
			);
			x += width;
			widest = Math.max(widest, x);
			x += KEY_GAP;
		}
		y += KEY_ROW + 4;
	}
	const width = Math.ceil(widest + KEY_PAD * 2);
	const height = Math.ceil(y - 4 + KEY_PAD);
	const box = {
		x: content.x + content.width - width,
		y: content.y + content.height + 24,
		width,
		height
	};
	return {
		svg: `<g transform="translate(${box.x} ${box.y})"><rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="8" fill="#fff" stroke="${BORDER}"/>${parts.join('')}</g>`,
		box
	};
}
