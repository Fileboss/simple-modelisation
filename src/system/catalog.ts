import type { ComponentType } from '@simple-modelisation/model/project.ts';
import { SKIN_LOOKS, TYPE_LOOKS } from '@simple-modelisation/model/looks.ts';
import { strings } from '../ui/strings';
import { SKIN_IDS } from '@simple-modelisation/model/skins.ts';

/** A market product a Component can wear; its look comes from the model's looks. */
export type Skin = {
	id: string;
	name: string;
	color: string;
	/** An SVG path on a 24×24 box; products without a Simple Icons logo show their initials. */
	logo?: string;
};

export type ComponentTypeInfo = {
	type: ComponentType;
	label: string;
	color: string;
	skins: Skin[];
};

const TYPES: { type: ComponentType; label: string; color: string }[] = [
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
	skins: SKIN_IDS[info.type].map((id) => ({ id, ...SKIN_LOOKS[id] }))
}));

export function componentTypeInfo(type: ComponentType): ComponentTypeInfo {
	return COMPONENT_TYPES.find((t) => t.type === type) ?? COMPONENT_TYPES[0];
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
	service: ['nodejs', 'go', 'python', 'spring-boot', 'bun'],
	gateway: ['nginx', 'traefik', 'caddy', 'kong', 'tailscale']
};

export const recommendedSkins = (type: ComponentType): readonly string[] =>
	RECOMMENDED[type] ?? SKIN_IDS[type];

/** What the palette drags to draw a Zone, beside the Component types. */
export const ZONE_ITEM = 'zone';
