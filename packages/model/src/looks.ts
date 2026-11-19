import {
	siAdguard,
	siAkamai,
	siAlibabacloud,
	siAndroid,
	siAngular,
	siApachekafka,
	siApple,
	siBun,
	siCaddy,
	siCeph,
	siClevercloud,
	siCloudflare,
	siDigitalocean,
	siDjango,
	siDocker,
	siDotnet,
	siExpress,
	siFastapi,
	siFastify,
	siFlydotio,
	siGithub,
	siGo,
	siGooglecloud,
	siGooglecloudstorage,
	siHetzner,
	siIonos,
	siKiwix,
	siKong,
	siKubernetes,
	siLaravel,
	siMinio,
	siMongodb,
	siMysql,
	siNatsdotio,
	siNestjs,
	siNetlify,
	siNextdotjs,
	siNginx,
	siNodedotjs,
	siNuxt,
	siOpenjdk,
	siOvh,
	siPhp,
	siPostgresql,
	siPython,
	siQuarkus,
	siRabbitmq,
	siRailway,
	siReact,
	siRedis,
	siRender,
	siRuby,
	siRubyonrails,
	siRust,
	siScaleway,
	siSpringboot,
	siSvelte,
	siTailscale,
	siTraefikproxy,
	siVaultwarden,
	siVercel,
	siVuedotjs,
	siVultr,
	type SimpleIcon
} from 'simple-icons';
import type { ComponentType } from './component-types.ts';
import type { Flow, Hosting, Provider, Runtime } from './project.ts';
import type { SkinId } from './skins.ts';

/*
 * How the System design catalog looks, shared by the canvas and the SVG
 * renderer: colors and logo paths (Simple Icons, CC0, on a 24×24 box).
 * Product names are brands; UI names (types, Hostings) stay in the app's strings.
 */

/**
 * A Skin's or a Runtime's look: its name, its color, and its logo, or a line
 * glyph for what no brand stands for (initials show without either).
 */
export type SkinLook = { name: string; color: string; logo?: string; glyph?: string };

/** A Component type's generic look: its color and a line glyph. */
export type TypeLook = { color: string; glyph: string };

/** A Hosting's badge: a brand logo (filled) or a line glyph, in white on its color. */
export type HostingMark = { color: string; icon: { kind: 'logo' | 'line'; path: string } };

/** A Provider's badge: its logo, a line glyph or a monogram, on its color. */
export type ProviderMark = {
	color: string;
	mark:
		| { kind: 'logo'; path: string }
		| { kind: 'line'; path: string }
		| { kind: 'monogram'; text: string; ink: string };
};

const fromIcon = (icon: SimpleIcon, name: string = icon.title): SkinLook & { logo: string } => ({
	name,
	color: `#${icon.hex}`,
	logo: icon.path
});

// The look of every Skin the model knows; the type makes a missing one a compile error.
export const SKIN_LOOKS: Record<SkinId, SkinLook> = {
	// Roles have no brand: line glyphs, drawn in white in the Person's avatar.
	customer: { name: 'Customer', color: '#db2777', glyph: 'M6 8h12l-1 12H7zM9 8a3 3 0 0 1 6 0' },
	admin: {
		name: 'Admin',
		color: '#4f46e5',
		glyph: 'M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6zM9 12l2 2 4-4'
	},
	partner: {
		name: 'Partner',
		color: '#0d9488',
		glyph:
			'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20a6 6 0 0 1 12 0M16 5a3 3 0 0 1 0 6M18 14.5a6 6 0 0 1 3 5.5'
	},
	support: {
		name: 'Support',
		color: '#ea580c',
		glyph: 'M4 15v-3a8 8 0 0 1 16 0v3M4 14h3v5H4zM17 14h3v5h-3zM20 19a3 3 0 0 1-3 3h-3'
	},
	browser: {
		name: 'Web browser',
		color: '#0284c7',
		glyph:
			'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9M12 3c-2.5 2.6-3.8 5.6-3.8 9s1.3 6.4 3.8 9'
	},
	android: fromIcon(siAndroid),
	ios: fromIcon(siApple, 'iOS'),
	desktop: { name: 'Desktop', color: '#475569', glyph: 'M5 5h14v10H5zM2 19h20' },
	nextjs: fromIcon(siNextdotjs),
	nuxt: fromIcon(siNuxt),
	sveltekit: fromIcon(siSvelte, 'SvelteKit'),
	svelte: fromIcon(siSvelte),
	react: fromIcon(siReact),
	vue: fromIcon(siVuedotjs),
	angular: fromIcon(siAngular),
	nestjs: fromIcon(siNestjs),
	express: fromIcon(siExpress),
	fastify: fromIcon(siFastify),
	'spring-boot': fromIcon(siSpringboot),
	quarkus: fromIcon(siQuarkus),
	django: fromIcon(siDjango),
	fastapi: fromIcon(siFastapi),
	laravel: fromIcon(siLaravel),
	rails: fromIcon(siRubyonrails),
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

// A Runtime is the Service's logo when it has no Skin, else a badge beside it.
export const RUNTIME_LOOKS: Record<Runtime, SkinLook & { logo: string }> = {
	nodejs: fromIcon(siNodedotjs),
	bun: fromIcon(siBun),
	// Java has left Simple Icons: OpenJDK's logo, in Java's orange.
	java: { ...fromIcon(siOpenjdk, 'Java'), color: '#e76f00' },
	dotnet: fromIcon(siDotnet),
	python: fromIcon(siPython),
	php: fromIcon(siPhp),
	ruby: fromIcon(siRuby),
	go: fromIcon(siGo),
	rust: fromIcon(siRust)
};

/** A Connection's color by Flow; one without a Flow is drawn in the neutral edge color. */
export const FLOW_COLORS: Record<Flow, string> = {
	read: '#2563eb',
	write: '#ea580c',
	'read-write': '#7c3aed'
};

/** Every Component type's generic look, in the palette's order. */
export const TYPE_LOOKS: Record<ComponentType, TypeLook> = {
	person: { color: '#a21caf', glyph: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0' },
	client: { color: '#64748b', glyph: 'M3 5h18v11H3zM8 20h8M12 16v4' },
	service: { color: '#2563eb', glyph: 'M4 4h16v6H4zM4 14h16v6H4zM7 7h.01M7 17h.01' },
	database: {
		color: '#0f766e',
		glyph:
			'M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3'
	},
	cache: { color: '#b91c1c', glyph: 'M13 2 4 14h7l-1 8 9-12h-7z' },
	queue: { color: '#9333ea', glyph: 'M3 7h4v10H3zM10 7h4v10h-4zM17 7h4v10h-4z' },
	gateway: { color: '#ea580c', glyph: 'M12 3l9 9-9 9-9-9zM8 12h8M13 9l3 3-3 3' },
	storage: { color: '#ca8a04', glyph: 'M3 7l9-4 9 4-9 4zM3 7v10l9 4 9-4V7M12 11v10' },
	disk: { color: '#57534e', glyph: 'M4 14l2.5-9h11L20 14M4 14h16v5H4zM16 16.5h.01M8 16.5h4' }
};

const line = (path: string) => ({ kind: 'line' as const, path });

export const HOSTING_MARKS: Record<Hosting, HostingMark> = {
	'bare-metal': {
		color: '#475569',
		icon: line('M4 4h16v6H4zM4 14h16v6H4zM8 7h.01M8 17h.01M12 7h4M12 17h4')
	},
	vm: { color: '#7c3aed', icon: line('M3 4h18v12H3zM7 20h10M12 16v4M7 8h10M7 12h6') },
	docker: { color: `#${siDocker.hex}`, icon: { kind: 'logo', path: siDocker.path } },
	kubernetes: { color: `#${siKubernetes.hex}`, icon: { kind: 'logo', path: siKubernetes.path } },
	managed: {
		color: '#0ea5e9',
		icon: line('M7 18h11a4 4 0 0 0 .5-7.97A6 6 0 0 0 6.6 9.1 4.5 4.5 0 0 0 7 18z')
	},
	serverless: { color: '#ea580c', icon: line('M6 4h3l9 16M12 11 6 20') },
	external: {
		color: '#64748b',
		icon: line('M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5')
	}
};

const logo = (icon: SimpleIcon) => ({
	color: `#${icon.hex}`,
	mark: { kind: 'logo' as const, path: icon.path }
});

// AWS and Azure are no longer in Simple Icons: a monogram on their color.
export const PROVIDER_MARKS: Record<Provider, ProviderMark> = {
	// One's own machines: a house, as a line glyph like the Hostings'.
	'self-hosted': {
		color: '#475569',
		mark: { kind: 'line', path: 'M3 11.5 12 4l9 7.5M5.5 9.5V20h13V9.5M10 20v-5h4v5' }
	},
	aws: { color: '#ff9900', mark: { kind: 'monogram', text: 'aws', ink: '#232f3e' } },
	'google-cloud': logo(siGooglecloud),
	azure: { color: '#0078d4', mark: { kind: 'monogram', text: 'Az', ink: '#fff' } },
	ovhcloud: logo(siOvh),
	scaleway: logo(siScaleway),
	hetzner: logo(siHetzner),
	ionos: logo(siIonos),
	'clever-cloud': logo(siClevercloud),
	digitalocean: logo(siDigitalocean),
	vultr: logo(siVultr),
	akamai: logo(siAkamai),
	'alibaba-cloud': logo(siAlibabacloud),
	cloudflare: logo(siCloudflare),
	vercel: logo(siVercel),
	netlify: logo(siNetlify),
	fly: logo(siFlydotio),
	render: logo(siRender),
	railway: logo(siRailway)
};
