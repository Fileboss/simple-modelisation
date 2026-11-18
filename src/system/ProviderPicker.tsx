import type { Provider } from '@simple-modelisation/model/project.ts';
import { useCanvas } from '../canvas/canvas-context';
import { strings } from '../ui/strings';
import { ChoiceGrid } from './ChoiceGrid';
import { PROVIDER_LOOKS, RECOMMENDED_PROVIDERS } from './provider-catalog';
import { ProviderIcon } from './ProviderIcon';

type Props = { componentId: string; current: Provider | undefined };

/** Whose infrastructure a Component runs on, as logo tiles. */
export function ProviderPicker({ componentId, current }: Props) {
	const { project, diagramId } = useCanvas();
	const choose = (provider: Provider | null) => {
		project.stopCapturing();
		project.setProvider(diagramId, componentId, provider);
	};
	return (
		<ChoiceGrid
			none={{
				label: strings.provider.unset,
				icon: <span className="badge-unset" style={{ width: 20, height: 20 }} aria-hidden="true" />
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
	);
}
