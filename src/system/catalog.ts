import {
	siAndroid,
	siApachekafka,
	siCeph,
	siGo,
	siGooglecloudstorage,
	siKong,
	siMinio,
	siMongodb,
	siMysql,
	siNatsdotio,
	siNginx,
	siNodedotjs,
	siPostgresql,
	siRabbitmq,
	siReact,
	siRedis,
	siSpringboot,
	siTraefikproxy,
	siVuedotjs,
	type SimpleIcon
} from 'simple-icons';
import type { ComponentType } from '../document/project';

/** A market product a Component can wear. Logos come from Simple Icons (CC0). */
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

const fromIcon = (id: string, icon: SimpleIcon, name: string = icon.title): Skin => ({
	id,
	name,
	color: `#${icon.hex}`,
	logo: icon.path
});

export const COMPONENT_TYPES: ComponentTypeInfo[] = [
	{
		type: 'client',
		label: 'Client',
		color: '#64748b',
		skins: [fromIcon('react', siReact), fromIcon('vue', siVuedotjs), fromIcon('android', siAndroid)]
	},
	{
		type: 'service',
		label: 'Service',
		color: '#2563eb',
		skins: [
			fromIcon('nodejs', siNodedotjs),
			fromIcon('spring-boot', siSpringboot),
			fromIcon('go', siGo)
		]
	},
	{
		type: 'database',
		label: 'Database',
		color: '#0f766e',
		skins: [
			fromIcon('postgresql', siPostgresql),
			fromIcon('mysql', siMysql),
			fromIcon('mongodb', siMongodb)
		]
	},
	{
		type: 'cache',
		label: 'Cache',
		color: '#b91c1c',
		skins: [
			fromIcon('redis', siRedis),
			{ id: 'valkey', name: 'Valkey', color: '#4a62d8' },
			{ id: 'memcached', name: 'Memcached', color: '#2a7a3b' }
		]
	},
	{
		type: 'queue',
		label: 'Message queue',
		color: '#9333ea',
		skins: [
			fromIcon('kafka', siApachekafka, 'Kafka'),
			fromIcon('rabbitmq', siRabbitmq),
			fromIcon('nats', siNatsdotio, 'NATS')
		]
	},
	{
		type: 'gateway',
		label: 'Gateway',
		color: '#ea580c',
		skins: [
			fromIcon('nginx', siNginx),
			fromIcon('traefik', siTraefikproxy, 'Traefik'),
			fromIcon('kong', siKong)
		]
	},
	{
		type: 'storage',
		label: 'Object storage',
		color: '#ca8a04',
		skins: [
			{ id: 's3', name: 'Amazon S3', color: '#569a31' },
			fromIcon('minio', siMinio),
			fromIcon('gcs', siGooglecloudstorage, 'Cloud Storage'),
			fromIcon('ceph', siCeph)
		]
	}
];

export function componentTypeInfo(type: ComponentType): ComponentTypeInfo {
	return COMPONENT_TYPES.find((t) => t.type === type) ?? COMPONENT_TYPES[0];
}

/** The Skin of a Component; an unknown id (e.g. from an imported file) means the generic look. */
export function findSkin(type: ComponentType, skinId: string | null): Skin | undefined {
	return componentTypeInfo(type).skins.find((s) => s.id === skinId);
}
