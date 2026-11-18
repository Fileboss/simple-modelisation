import { PROVIDERS, type Provider } from '@simple-modelisation/model/project.ts';
import {
	siAkamai,
	siAlibabacloud,
	siClevercloud,
	siCloudflare,
	siDigitalocean,
	siFlydotio,
	siGooglecloud,
	siHetzner,
	siIonos,
	siNetlify,
	siOvh,
	siRailway,
	siRender,
	siScaleway,
	siVercel,
	siVultr,
	type SimpleIcon
} from 'simple-icons';
import { strings } from '../ui/strings';

/** How a Provider looks: its logo in white on its color, or a monogram where Simple Icons has none. */
export type ProviderLook = {
	provider: Provider;
	label: string;
	color: string;
	mark: { kind: 'logo'; path: string } | { kind: 'monogram'; text: string; ink: string };
};

const logo = (icon: SimpleIcon) => ({
	color: `#${icon.hex}`,
	mark: { kind: 'logo' as const, path: icon.path }
});

// AWS and Azure are no longer in Simple Icons: a monogram on their color.
const LOOKS: Record<Provider, Omit<ProviderLook, 'provider' | 'label'>> = {
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

/** Every Provider with its look, in the model's order. */
export const PROVIDER_LOOKS: ProviderLook[] = PROVIDERS.map((provider) => ({
	provider,
	label: strings.provider.names[provider],
	...LOOKS[provider]
}));

const BY_PROVIDER = new Map(PROVIDER_LOOKS.map((look) => [look.provider, look]));

export const providerLook = (provider: Provider | null | undefined) =>
	provider ? BY_PROVIDER.get(provider) : undefined;
