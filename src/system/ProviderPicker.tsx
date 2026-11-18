import type { Provider } from '@simple-modelisation/model/project.ts';
import { useCanvas } from '../canvas/canvas-context';
import { strings } from '../ui/strings';
import { ChoiceGrid } from './ChoiceGrid';
import type { InheritedProvider } from './inherited-provider';
import { PROVIDER_LOOKS, providerLook, RECOMMENDED_PROVIDERS } from './provider-catalog';
import { ProviderIcon } from './ProviderIcon';

type Props = {
	/** A Component or a Zone. */
	nodeId: string;
	current: Provider | undefined;
	/** What a Component takes from a Zone around it while it has no Provider of its own. */
	inherited?: InheritedProvider;
};

/** Whose infrastructure a Component, or a Zone's content, runs on, as logo tiles. */
export function ProviderPicker({ nodeId, current, inherited }: Props) {
	const { project, diagramId } = useCanvas();
	const choose = (provider: Provider | null) => {
		project.stopCapturing();
		project.setProvider(diagramId, nodeId, provider);
	};
	const from = !current && inherited && providerLook(inherited.provider);
	return (
		<>
			{from && (
				<p className="panel-hint">{strings.provider.inherited(inherited.zone, from.label)}</p>
			)}
			<ChoiceGrid
				none={{
					label: strings.provider.unset,
					icon: (
						<span className="badge-unset" style={{ width: 20, height: 20 }} aria-hidden="true" />
					)
				}}
				choices={PROVIDER_LOOKS.map((look) => ({
					id: look.provider,
					label: look.label,
					icon: <ProviderIcon look={look} size={20} />
				}))}
				recommended={RECOMMENDED_PROVIDERS}
				current={current}
				onChoose={(id) => choose(id as Provider | null)}
			/>
		</>
	);
}
