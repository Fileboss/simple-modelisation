/** The generic roles of a Component, in the palette's order. Its own module, so skins.ts and project.ts need not import each other. */
export const COMPONENT_TYPE_IDS = [
	'person',
	'client',
	'service',
	'database',
	'cache',
	'queue',
	'gateway',
	'storage',
	'disk'
] as const;
export type ComponentType = (typeof COMPONENT_TYPE_IDS)[number];

/** How a type this version does not know (a newer file or peer) is drawn. */
export const FALLBACK_COMPONENT_TYPE: ComponentType = 'client';

/** Someone, not software: no Hosting, no Provider, drawn as a silhouette. */
export const isPerson = (type: unknown) => type === 'person';
