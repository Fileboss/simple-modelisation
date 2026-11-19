import type { ComponentType } from './component-types.ts';

/**
 * The Skins each Component type can wear, by id. The app's catalog gives them
 * names, colors and logos; tools that only validate (the MCP server) use this.
 */
export const SKIN_IDS = {
	client: ['react', 'vue', 'android', 'apple'],
	service: [
		'nodejs',
		'spring-boot',
		'go',
		'bun',
		'python',
		'rust',
		'caddy',
		'vaultwarden',
		'kiwix',
		'github'
	],
	database: ['postgresql', 'mysql', 'mongodb'],
	cache: ['redis', 'valkey', 'memcached'],
	queue: ['kafka', 'rabbitmq', 'nats'],
	gateway: ['nginx', 'traefik', 'kong', 'caddy', 'tailscale', 'adguard'],
	storage: ['s3', 'minio', 'gcs', 'ceph'],
	// A Disk kind (HDD, SSD…) is not a product: Disks have no Skins.
	disk: []
} as const satisfies Record<ComponentType, readonly string[]>;

export type SkinId = (typeof SKIN_IDS)[ComponentType][number];

/** Whether a Component type offers a Skin; a type from an older file offers none. */
export const skinFits = (type: string, skin: string): boolean =>
	((SKIN_IDS as Record<string, readonly string[]>)[type] ?? []).includes(skin);
