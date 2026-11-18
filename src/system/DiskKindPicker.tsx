import { DISK_KINDS, type DiskKind } from '@simple-modelisation/model/project.ts';
import { useCanvas } from '../canvas/canvas-context';
import { strings } from '../ui/strings';

type Props = { diskId: string; current: DiskKind | undefined };

/** What a Disk is (HDD, SSD, NVMe, USB), as a row of buttons; "Not specified" or the current one again clears it. */
export function DiskKindPicker({ diskId, current }: Props) {
	const { project, diagramId } = useCanvas();
	const choose = (kind: DiskKind | null) => {
		project.stopCapturing();
		project.setDiskKind(diagramId, diskId, kind);
	};
	return (
		<div className="disk-kinds" role="group" aria-label={strings.disk.title}>
			{[null, ...DISK_KINDS].map((kind) => {
				const isCurrent = (current ?? null) === kind;
				return (
					<button
						key={kind ?? 'none'}
						className={isCurrent ? 'disk-kind-current' : ''}
						aria-pressed={isCurrent}
						onClick={() => choose(isCurrent ? null : kind)}
					>
						{kind ? strings.disk.names[kind] : strings.disk.unset}
					</button>
				);
			})}
		</div>
	);
}
