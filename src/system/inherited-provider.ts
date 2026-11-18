import { estimatedSize } from '@simple-modelisation/model/layout.ts';
import type { DiagramNode, Provider } from '@simple-modelisation/model/project.ts';
import { effectiveProviders, zoneParents } from '@simple-modelisation/model/zones.ts';
import { strings } from '../ui/strings';

/** Set on a Component's or Zone's data when its Provider comes from a Zone around it. */
export type InheritedProvider = { provider: Provider; zone: string };

export const inheritedProvider = (node: DiagramNode): InheritedProvider | undefined =>
	(node as { inheritedProvider?: InheritedProvider }).inheritedProvider;

/** The System design derivation step: each node gets the Provider it takes from a Zone. */
export function withInheritedProviders(nodes: DiagramNode[]): DiagramNode[] {
	if (!nodes.some((n) => n.type === 'zone' && n.provider)) return nodes;
	const providers = effectiveProviders(nodes, zoneParents(nodes, estimatedSize));
	const names = new Map(nodes.map((n) => [n.id, String(n.name ?? '')]));
	return nodes.map((n) => {
		const effective = providers.get(n.id);
		if (!effective?.from) return n;
		const zone = names.get(effective.from) || strings.system.zone;
		return { ...n, inheritedProvider: { provider: effective.provider, zone } };
	});
}
