/** The generic roles of a Component, in the palette's order. Its own module, so skins.ts and project.ts need not import each other. */
export const COMPONENT_TYPE_IDS = [
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
