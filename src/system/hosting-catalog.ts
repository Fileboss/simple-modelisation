import { HOSTINGS, type Hosting } from '@simple-modelisation/model/project.ts';
import { siDocker, siKubernetes } from 'simple-icons';
import { strings } from '../ui/strings';

/** How a Hosting looks: a brand logo (filled) or a line glyph, on 24×24, on its color. */
export type HostingLook = {
	hosting: Hosting;
	label: string;
	color: string;
	icon: { kind: 'logo' | 'line'; path: string };
};

const line = (path: string) => ({ kind: 'line' as const, path });

const LOOKS: Record<Hosting, Omit<HostingLook, 'hosting' | 'label'>> = {
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

/** Every Hosting with its look, from the most concrete to the most abstract. */
export const HOSTING_LOOKS: HostingLook[] = HOSTINGS.map((hosting) => ({
	hosting,
	label: strings.hosting.names[hosting],
	...LOOKS[hosting]
}));

const BY_HOSTING = new Map(HOSTING_LOOKS.map((look) => [look.hosting, look]));

export const hostingLook = (hosting: Hosting | null | undefined) =>
	hosting ? BY_HOSTING.get(hosting) : undefined;
