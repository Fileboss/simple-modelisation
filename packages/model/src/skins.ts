import type { ComponentType } from './project.ts';

/**
 * The Skins each Component type can wear, by id. The app's catalog gives them
 * names, colors and logos; tools that only validate (the MCP server) use this.
 */
export const SKIN_IDS = {
	client: ['react', 'vue', 'android'],
	service: ['nodejs', 'spring-boot', 'go'],
	database: ['postgresql', 'mysql', 'mongodb'],
	cache: ['redis', 'valkey', 'memcached'],
	queue: ['kafka', 'rabbitmq', 'nats'],
	gateway: ['nginx', 'traefik', 'kong'],
	storage: ['s3', 'minio', 'gcs', 'ceph']
} as const satisfies Record<ComponentType, readonly string[]>;

export type SkinId = (typeof SKIN_IDS)[ComponentType][number];
