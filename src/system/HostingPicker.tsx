import type { Hosting } from '@simple-modelisation/model/project.ts';
import { useCanvas } from '../canvas/canvas-context';
import { strings } from '../ui/strings';
import { HOSTING_LOOKS } from './hosting-catalog';
import { HostingIcon } from './HostingIcon';

type Props = {
	componentId: string;
	current: Hosting | null | undefined;
	/** Show the names beside the icons (the panel), or icons only (the toolbar). */
	labelled?: boolean;
};

/** Where a Component runs, as icon buttons; "Not specified" (or the current one again) clears it. */
export function HostingPicker({ componentId, current, labelled = false }: Props) {
	const { project, diagramId } = useCanvas();
	const choose = (hosting: Hosting | null) => {
		project.stopCapturing();
		project.setHosting(diagramId, componentId, hosting);
	};
	const size = labelled ? 20 : 18;
	return (
		<div className={`hosting-picker ${labelled ? 'hosting-picker-labelled' : ''}`}>
			<button
				className={`nodrag hosting-choice ${current ? '' : 'hosting-current'}`}
				title={strings.hosting.unset}
				aria-label={strings.hosting.unset}
				aria-pressed={!current}
				onClick={() => choose(null)}
			>
				<span className="badge-unset" style={{ width: size, height: size }} aria-hidden="true" />
				{labelled && <span>{strings.hosting.unset}</span>}
			</button>
			{HOSTING_LOOKS.map((look) => {
				const isCurrent = look.hosting === current;
				return (
					<button
						key={look.hosting}
						className={`nodrag hosting-choice ${isCurrent ? 'hosting-current' : ''}`}
						title={isCurrent ? `${look.label} · ${strings.hosting.clear}` : look.label}
						aria-label={look.label}
						aria-pressed={isCurrent}
						onClick={() => choose(isCurrent ? null : look.hosting)}
					>
						<HostingIcon look={look} size={size} />
						{labelled && <span>{look.label}</span>}
					</button>
				);
			})}
		</div>
	);
}
