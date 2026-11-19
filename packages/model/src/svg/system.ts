import { connectionRoute, routedPath, type Box, type Point } from '../geometry.ts';
import { placeLabels, roughWidth, type MeasureText } from '../label-placement.ts';
import { estimatedSize, type Size } from '../layout.ts';
import { COMPONENT_TYPE_IDS } from '../component-types.ts';
import { HOSTING_MARKS, PROVIDER_MARKS, SKIN_LOOKS, TYPE_LOOKS } from '../looks.ts';
import { skinFits } from '../skins.ts';
import type {
	ComponentType,
	DiagramEdge,
	DiagramNode,
	DiskKind,
	Hosting,
	Provider
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
};

// The canvas styles (index.css), so the image looks like the screen.
const FONT = "system-ui, 'Segoe UI', Roboto, sans-serif";
const TEXT = '#1d1b22';
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
	{ names, sizeOf = estimatedSize, measure = roughWidth, margin = 32 }: SvgOptions
): string {
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

	// Labels go where the canvas puts them: on their routes, clear of boxes and of each other.
	const solid = new Map(components.map((n) => [n.id, boxes.get(n.id)!]));
	const labels = placeLabels(
		solid,
		connections.map((e) => ({
			id: e.id,
			source: e.source,
			target: e.target,
			label: String(e.label ?? ''),
			points: e.points as Point[] | undefined
		})),
		measure
	);

	const parts: string[] = [];
	const extent: Box[] = [...boxes.values()];
	for (const zone of zones) parts.push(zoneShape(zone, boxes.get(zone.id)!, names));
	for (const edge of connections) {
		const source = solid.get(edge.source);
		const target = solid.get(edge.target);
		if (!source || !target) continue;
		const route = connectionRoute(source, target, edge.points as Point[] | undefined);
		// A route may run outside the boxes (around them): the frame holds it too.
		for (const p of route) extent.push({ x: p.x - 6, y: p.y - 6, width: 12, height: 12 });
		parts.push(
			`<path d="${routedPath(route)}" fill="none" stroke="${EDGE}" stroke-width="1.5" marker-end="url(#arrow)"/>`
		);
		const at = labels.get(edge.id);
		const text = String(edge.label ?? '');
		if (at && text) {
			const width = measure(text) + 14;
			extent.push({ x: at.x - width / 2, y: at.y - 9, width, height: 18 });
			parts.push(
				`<rect x="${at.x - width / 2}" y="${at.y - 9}" width="${width}" height="18" rx="4" fill="#fff" stroke="${BORDER}"/>`,
				`<text x="${at.x}" y="${at.y}" font-size="11.25" fill="${TEXT}" text-anchor="middle" dy="0.35em">${escape(text)}</text>`
			);
		}
	}
	for (const component of components) {
		parts.push(
			componentShape(
				component,
				boxes.get(component.id)!,
				providers.get(component.id)?.provider,
				names
			)
		);
	}

	const frame = bounds(extent);
	const x = frame.x - margin;
	const y = frame.y - margin - BADGE / 2;
	const width = Math.ceil(frame.width + margin * 2);
	const height = Math.ceil(frame.height + margin * 2 + BADGE / 2);
	return [
		`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${x} ${y} ${width} ${height}" font-family="${FONT}">`,
		`<defs><marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="${EDGE}"/></marker></defs>`,
		`<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="#fff"/>`,
		...parts,
		'</svg>'
	].join('\n');
}

function zoneShape(zone: DiagramNode, box: Box, names: SvgNames): string {
	const provider = zone.provider as Provider | undefined;
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

function componentShape(
	component: DiagramNode,
	box: Box,
	provider: Provider | undefined,
	names: SvgNames
): string {
	const type = component.componentType as ComponentType;
	// As the canvas: an unknown type looks like the first one, a Skin only on a type offering it.
	const known = own(TYPE_LOOKS, type) ? type : COMPONENT_TYPE_IDS[0];
	const typeLook = TYPE_LOOKS[known];
	const skin =
		typeof component.skin === 'string' && skinFits(known, component.skin)
			? own(SKIN_LOOKS, component.skin)
			: undefined;
	const color = skin?.color ?? typeLook.color;
	const name = String(component.name ?? '');
	const diskKind = type === 'disk' ? (component.diskKind as DiskKind | undefined) : undefined;
	const subtitle = skin?.name ?? (diskKind ? own(names.diskKinds, diskKind) : names.types[known]);
	const middle = box.y + box.height / 2;
	const icon = box.x + 14;
	const text = icon + 28 + 10;
	// Sizes may be estimates (the server, the zip): a name wider than its room is narrowed to fit.
	const room = box.x + box.width - 14 - text;
	const fit =
		name.length * NAME_CHAR > room ? ` textLength="${room}" lengthAdjust="spacingAndGlyphs"` : '';
	const hosting = component.hosting as Hosting | undefined;
	const shown = hosting === 'external' ? undefined : provider;

	const parts = [
		`<rect x="${box.x + 1}" y="${box.y + 1}" width="${box.width - 2}" height="${box.height - 2}" rx="10" fill="#fff" stroke="${color}" stroke-width="2"/>`,
		logoShape(skin, typeLook.glyph, color, icon, middle - 14, 28)
	];
	if (subtitle && subtitle !== name) {
		parts.push(
			`<text x="${text}" y="${middle - 8}" font-size="15" font-weight="600" fill="${TEXT}" dy="0.35em"${fit}>${escape(name)}</text>`,
			`<text x="${text}" y="${middle + 11}" font-size="11.25" fill="${color}" dy="0.35em">${escape(subtitle)}</text>`
		);
	} else {
		parts.push(
			`<text x="${text}" y="${middle}" font-size="15" font-weight="600" fill="${TEXT}" dy="0.35em"${fit}>${escape(name)}</text>`
		);
	}
	// Badges in the top-right corner, read left to right: at whom, then how it runs.
	const badges: string[] = [];
	if (shown) badges.push(providerBadge(shown, 0, 0, BADGE, names));
	if (hosting && own(HOSTING_MARKS, hosting)) badges.push(hostingBadge(hosting, 0, 0, names));
	badges.forEach((badge, i) => {
		const right = box.x + box.width + 9 - (badges.length - 1 - i) * (BADGE + 6);
		parts.push(`<g transform="translate(${right - BADGE - 2} ${box.y - 11})">${badge}</g>`);
	});
	return parts.join('');
}

/** A Skin's logo, its initials without one, or the type's generic glyph. */
function logoShape(
	skin: (typeof SKIN_LOOKS)[keyof typeof SKIN_LOOKS] | undefined,
	glyph: string,
	color: string,
	x: number,
	y: number,
	size: number
): string {
	if (skin?.logo) {
		return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 24 24"><path d="${skin.logo}" fill="${color}"/></svg>`;
	}
	if (skin) {
		const initials = skin.name
			.split(/\s+/)
			.map((word) => word[0])
			.join('')
			.slice(0, 2);
		return `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="6" fill="${color}"/><text x="${x + size / 2}" y="${y + size / 2}" font-size="${size * 0.42}" font-weight="700" fill="#fff" text-anchor="middle" dy="0.35em">${escape(initials)}</text>`;
	}
	return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 24 24"><path d="${glyph}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

/** A round badge with a white ring, its mark in white (or its ink) on its color. */
function badge(color: string, inner: string, title: string, x: number, y: number, size: number) {
	const r = size / 2;
	return `<g><title>${escape(title)}</title><circle cx="${x + r + 2}" cy="${y + r + 2}" r="${r + 2}" fill="#fff"/><circle cx="${x + r + 2}" cy="${y + r + 2}" r="${r}" fill="${color}"/><svg x="${x + 2 + size * 0.19}" y="${y + 2 + size * 0.19}" width="${size * 0.62}" height="${size * 0.62}" viewBox="0 0 24 24">${inner}</svg></g>`;
}

function hostingBadge(hosting: Hosting, x: number, y: number, names: SvgNames): string {
	const { color, icon } = HOSTING_MARKS[hosting];
	const inner =
		icon.kind === 'logo'
			? `<path d="${icon.path}" fill="#fff"/>`
			: `<path d="${icon.path}" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`;
	return badge(color, inner, `${names.titles.hosting}: ${names.hostings[hosting]}`, x, y, BADGE);
}

function providerBadge(
	provider: Provider,
	x: number,
	y: number,
	size: number,
	names: SvgNames
): string {
	const { color, mark } = PROVIDER_MARKS[provider];
	const inner =
		mark.kind === 'logo'
			? `<path d="${mark.path}" fill="#fff"/>`
			: mark.kind === 'line'
				? `<path d="${mark.path}" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`
				: `<text x="12" y="12" text-anchor="middle" dy="0.35em" textLength="${mark.text.length > 2 ? 24 : 20}" lengthAdjust="spacingAndGlyphs" font-size="${mark.text.length > 2 ? 15 : 17}" font-weight="800" fill="${mark.ink}">${escape(mark.text)}</text>`;
	return badge(color, inner, `${names.titles.provider}: ${names.providers[provider]}`, x, y, size);
}

/**
 * A catalog entry by a key from the document: its own entries only. Peers can
 * write any value, and `constructor` or `__proto__` must not read what every
 * object inherits.
 */
function own<T>(catalog: Record<string, T>, key: unknown): T | undefined {
	return typeof key === 'string' && Object.hasOwn(catalog, key) ? catalog[key] : undefined;
}

function bounds(boxes: Box[]): Box {
	if (boxes.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
	const left = Math.min(...boxes.map((b) => b.x));
	const top = Math.min(...boxes.map((b) => b.y));
	const right = Math.max(...boxes.map((b) => b.x + b.width));
	const bottom = Math.max(...boxes.map((b) => b.y + b.height));
	return { x: left, y: top, width: right - left, height: bottom - top };
}

/** Text as SVG content: names and labels are user text. */
function escape(text: string): string {
	return (
		text
			// XML 1.0 forbids control characters other than tab, line feed and carriage return.
			// eslint-disable-next-line no-control-regex
			.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
	);
}
