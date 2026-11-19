import { RUNTIMES, type ComponentType, type Runtime } from '@simple-modelisation/model/project.ts';
import { RUNTIME_LOOKS, SKIN_LOOKS, TYPE_LOOKS } from '@simple-modelisation/model/looks.ts';
import { strings } from '../ui/strings';
import { SERVICE_FRAMEWORKS, SKIN_IDS } from '@simple-modelisation/model/skins.ts';
import { FALLBACK_COMPONENT_TYPE } from '@simple-modelisation/model/component-types.ts';

/** A product or framework a Component can wear, or a Runtime; its look comes from the model's looks. */
export type Skin = {
	id: string;
	name: string;
	color: string;
	/** An SVG path on a 24×24 box; products without a Simple Icons logo show their initials. */
	logo?: string;
	/** A line glyph on a 24×24 box, for what no brand stands for (Web browser). */
	glyph?: string;
	/** The panel's section: a Service's Skins are frameworks or products. */
	group?: string;
};

export type ComponentTypeInfo = {
	type: ComponentType;
	label: string;
	color: string;
	/** The generic line glyph. */
	glyph: string;
	skins: Skin[];
};

const TYPES: { type: ComponentType; label: string; color: string }[] = [
	{ type: 'person', label: strings.types.person, color: TYPE_LOOKS.person.color },
	{ type: 'client', label: strings.types.client, color: TYPE_LOOKS.client.color },
	{ type: 'service', label: strings.types.service, color: TYPE_LOOKS.service.color },
	{ type: 'database', label: strings.types.database, color: TYPE_LOOKS.database.color },
	{ type: 'cache', label: strings.types.cache, color: TYPE_LOOKS.cache.color },
	{ type: 'queue', label: strings.types.queue, color: TYPE_LOOKS.queue.color },
	{ type: 'gateway', label: strings.types.gateway, color: TYPE_LOOKS.gateway.color },
	{ type: 'storage', label: strings.types.storage, color: TYPE_LOOKS.storage.color },
	{ type: 'disk', label: strings.types.disk, color: TYPE_LOOKS.disk.color }
];

/** Each Component type with its Skins, in the model's order (packages/model skins.ts). */
export const COMPONENT_TYPES: ComponentTypeInfo[] = TYPES.map((info) => ({
	...info,
	glyph: TYPE_LOOKS[info.type].glyph,
	skins: SKIN_IDS[info.type].map((id) => ({
		id,
		...SKIN_LOOKS[id],
		group: skinGroup(info.type, id)
	}))
}));

function skinGroup(type: ComponentType, id: string): string | undefined {
	if (type !== 'service') return undefined;
	const frameworks: readonly string[] = SERVICE_FRAMEWORKS;
	return frameworks.includes(id)
		? strings.system.skinGroups.frameworks
		: strings.system.skinGroups.products;
}

/** Every Runtime with its look, in the model's order. */
export const RUNTIME_CHOICES: (Skin & { id: Runtime; logo: string })[] = RUNTIMES.map((id) => ({
	id,
	...RUNTIME_LOOKS[id]
}));

/** A Service's Runtime look; an unknown id (a newer file) means none. */
export const findRuntime = (runtime: string | null | undefined) =>
	RUNTIME_CHOICES.find((r) => r.id === runtime);

/** The Runtimes the panel shows first. */
export const RECOMMENDED_RUNTIMES: readonly Runtime[] = [
	'nodejs',
	'bun',
	'python',
	'go',
	'java',
	'rust'
];

export function componentTypeInfo(type: ComponentType): ComponentTypeInfo {
	return (
		COMPONENT_TYPES.find((t) => t.type === type) ??
		COMPONENT_TYPES.find((t) => t.type === FALLBACK_COMPONENT_TYPE)!
	);
}

/** The Skin of a Component; an unknown id (e.g. from an imported file) means the generic look. */
export function findSkin(type: ComponentType, skinId: string | null): Skin | undefined {
	return componentTypeInfo(type).skins.find((s) => s.id === skinId);
}

/**
 * The Skins the panel shows first, the most common, for the types with many;
 * the others are one click away. A type not listed shows all its Skins.
 */
const RECOMMENDED: { [T in ComponentType]?: readonly (typeof SKIN_IDS)[T][number][] } = {
	service: ['nextjs', 'react', 'nestjs', 'express', 'spring-boot', 'django', 'caddy'],
	gateway: ['nginx', 'traefik', 'caddy', 'kong', 'tailscale']
};

export const recommendedSkins = (type: ComponentType): readonly string[] =>
	RECOMMENDED[type] ?? SKIN_IDS[type];

/** What the palette drags to draw a Zone, beside the Component types. */
export const ZONE_ITEM = 'zone';
