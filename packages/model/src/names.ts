import type { ComponentType } from './component-types.ts';
import type { DiskKind, Flow, Hosting, Provider } from './project.ts';

/**
 * The catalog's names in English: what the MCP server prints in images, and
 * where the app's UI strings start from (a translation replaces them there).
 */
export const ENGLISH_NAMES: {
	types: Record<ComponentType, string>;
	diskKinds: Record<DiskKind, string>;
	hostings: Record<Hosting, string>;
	providers: Record<Provider, string>;
	flows: Record<Flow, string>;
	/** What badges are named by, before their value: "Hosting: Docker". */
	titles: { hosting: string; provider: string; runtime: string };
} = {
	types: {
		person: 'Person',
		client: 'Client',
		service: 'Service',
		database: 'Database',
		cache: 'Cache',
		queue: 'Message queue',
		gateway: 'Gateway',
		storage: 'Object storage',
		disk: 'Disk'
	},
	diskKinds: { hdd: 'HDD', ssd: 'SSD', nvme: 'NVMe', usb: 'USB' },
	hostings: {
		'bare-metal': 'Bare metal',
		vm: 'VM',
		docker: 'Docker',
		kubernetes: 'Kubernetes',
		managed: 'Managed (cloud)',
		serverless: 'Serverless',
		external: 'External service'
	},
	providers: {
		'self-hosted': 'Self-hosted',
		aws: 'AWS',
		'google-cloud': 'Google Cloud',
		azure: 'Azure',
		ovhcloud: 'OVHcloud',
		scaleway: 'Scaleway',
		hetzner: 'Hetzner',
		ionos: 'IONOS',
		'clever-cloud': 'Clever Cloud',
		digitalocean: 'DigitalOcean',
		vultr: 'Vultr',
		akamai: 'Akamai (Linode)',
		'alibaba-cloud': 'Alibaba Cloud',
		cloudflare: 'Cloudflare',
		vercel: 'Vercel',
		netlify: 'Netlify',
		fly: 'Fly.io',
		render: 'Render',
		railway: 'Railway'
	},
	flows: { read: 'Read', write: 'Write', 'read-write': 'Read/Write' },
	titles: { hosting: 'Hosting', provider: 'Provider', runtime: 'Runtime' }
};
