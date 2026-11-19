import { PROVIDERS, type Provider } from '@simple-modelisation/model/project.ts';
import { PROVIDER_MARKS, type ProviderMark } from '@simple-modelisation/model/looks.ts';
import { strings } from '../ui/strings';

/** How a Provider looks: its logo in white on its color, or a monogram where Simple Icons has none. */
export type ProviderLook = ProviderMark & { provider: Provider; label: string };

/** Every Provider with its look, in the model's order. */
export const PROVIDER_LOOKS: ProviderLook[] = PROVIDERS.map((provider) => ({
	provider,
	label: strings.provider.names[provider],
	...PROVIDER_MARKS[provider]
}));

/** The Providers the panel shows first; the others are one click away. */
export const RECOMMENDED_PROVIDERS: readonly Provider[] = [
	'self-hosted',
	'aws',
	'google-cloud',
	'azure',
	'ovhcloud',
	'scaleway',
	'hetzner'
];

const BY_PROVIDER = new Map(PROVIDER_LOOKS.map((look) => [look.provider, look]));

export const providerLook = (provider: Provider | null | undefined) =>
	provider ? BY_PROVIDER.get(provider) : undefined;
