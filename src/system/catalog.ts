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
import type { ComponentType } from '@simple-modelisation/model/project.ts';
import { SKIN_IDS, type SkinId } from '@simple-modelisation/model/skins.ts';

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

type Look = Omit<Skin, 'id'>;

const fromIcon = (icon: SimpleIcon, name: string = icon.title): Look => ({
	name,
	color: `#${icon.hex}`,
	logo: icon.path
});

// The look of every Skin the model knows; the type makes a missing one a compile error.
const LOOKS: Record<SkinId, Look> = {
	react: fromIcon(siReact),
	vue: fromIcon(siVuedotjs),
	android: fromIcon(siAndroid),
	nodejs: fromIcon(siNodedotjs),
	'spring-boot': fromIcon(siSpringboot),
	go: fromIcon(siGo),
	postgresql: fromIcon(siPostgresql),
	mysql: fromIcon(siMysql),
	mongodb: fromIcon(siMongodb),
	redis: fromIcon(siRedis),
	valkey: { name: 'Valkey', color: '#4a62d8' },
	memcached: { name: 'Memcached', color: '#2a7a3b' },
	kafka: fromIcon(siApachekafka, 'Kafka'),
	rabbitmq: fromIcon(siRabbitmq),
	nats: fromIcon(siNatsdotio, 'NATS'),
	nginx: fromIcon(siNginx),
	traefik: fromIcon(siTraefikproxy, 'Traefik'),
	kong: fromIcon(siKong),
	s3: { name: 'Amazon S3', color: '#569a31' },
	minio: fromIcon(siMinio),
	gcs: fromIcon(siGooglecloudstorage, 'Cloud Storage'),
	ceph: fromIcon(siCeph)
};

const TYPES: { type: ComponentType; label: string; color: string }[] = [
	{ type: 'client', label: 'Client', color: '#64748b' },
	{ type: 'service', label: 'Service', color: '#2563eb' },
	{ type: 'database', label: 'Database', color: '#0f766e' },
	{ type: 'cache', label: 'Cache', color: '#b91c1c' },
	{ type: 'queue', label: 'Message queue', color: '#9333ea' },
	{ type: 'gateway', label: 'Gateway', color: '#ea580c' },
	{ type: 'storage', label: 'Object storage', color: '#ca8a04' }
];

/** Each Component type with its Skins, in the model's order (packages/model skins.ts). */
export const COMPONENT_TYPES: ComponentTypeInfo[] = TYPES.map((info) => ({
	...info,
	skins: SKIN_IDS[info.type].map((id) => ({ id, ...LOOKS[id] }))
}));

export function componentTypeInfo(type: ComponentType): ComponentTypeInfo {
	return COMPONENT_TYPES.find((t) => t.type === type) ?? COMPONENT_TYPES[0];
}

/** The Skin of a Component; an unknown id (e.g. from an imported file) means the generic look. */
export function findSkin(type: ComponentType, skinId: string | null): Skin | undefined {
	return componentTypeInfo(type).skins.find((s) => s.id === skinId);
}
