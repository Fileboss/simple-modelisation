import {
	siAdguard,
	siAndroid,
	siApachekafka,
	siApple,
	siBun,
	siCaddy,
	siCeph,
	siGithub,
	siGo,
	siGooglecloudstorage,
	siKiwix,
	siKong,
	siMinio,
	siMongodb,
	siMysql,
	siNatsdotio,
	siNginx,
	siNodedotjs,
	siPostgresql,
	siPython,
	siRabbitmq,
	siReact,
	siRedis,
	siRust,
	siSpringboot,
	siTailscale,
	siTraefikproxy,
	siVaultwarden,
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
	apple: fromIcon(siApple),
	nodejs: fromIcon(siNodedotjs),
	'spring-boot': fromIcon(siSpringboot),
	go: fromIcon(siGo),
	bun: fromIcon(siBun),
	python: fromIcon(siPython),
	rust: fromIcon(siRust),
	caddy: fromIcon(siCaddy),
	vaultwarden: fromIcon(siVaultwarden),
	kiwix: fromIcon(siKiwix),
	github: fromIcon(siGithub),
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
	tailscale: fromIcon(siTailscale),
	adguard: fromIcon(siAdguard, 'AdGuard'),
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
	{ type: 'storage', label: 'Object storage', color: '#ca8a04' },
	{ type: 'disk', label: 'Disk', color: '#57534e' }
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
