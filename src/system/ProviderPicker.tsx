import type { Provider } from '@simple-modelisation/model/project.ts';
import { useCanvas } from '../canvas/canvas-context';
import { strings } from '../ui/strings';
import { PROVIDER_LOOKS } from './provider-catalog';
import { ProviderIcon } from './ProviderIcon';

type Props = { componentId: string; current: Provider | undefined };

/** Whose infrastructure a Component runs on, as a grid of logos; "Not specified" (or the current one again) clears it. */
export function ProviderPicker({ componentId, current }: Props) {
	const { project, diagramId } = useCanvas();
	const choose = (provider: Provider | null) => {
		project.stopCapturing();
		project.setProvider(diagramId, componentId, provider);
	};
	return (
		<div className="skin-grid">
			<button
				className={`skin ${current ? '' : 'skin-current'}`}
				aria-pressed={!current}
				onClick={() => choose(null)}
			>
				<span className="badge-unset" style={{ width: 20, height: 20 }} aria-hidden="true" />
				{strings.provider.unset}
			</button>
			{PROVIDER_LOOKS.map((look) => {
				const isCurrent = look.provider === current;
				return (
					<button
						key={look.provider}
						className={`skin ${isCurrent ? 'skin-current' : ''}`}
						title={isCurrent ? strings.hosting.clear : undefined}
						aria-pressed={isCurrent}
						onClick={() => choose(isCurrent ? null : look.provider)}
					>
						<ProviderIcon look={look} size={20} />
						{look.label}
					</button>
				);
			})}
		</div>
	);
}
