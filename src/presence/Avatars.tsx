import { useState } from 'react';
import { EditableText } from '../canvas/EditableText';
import { useProjectVersion } from '../app/project-hooks';
import type { ProjectDocument } from '@simple-modelisation/model/project.ts';
import { strings } from '../ui/strings';
import { initials } from './presence';
import { useParticipants, usePresence } from './presence-context';

/** Who is on the Project: oneself first (click to rename), then the others with their Diagram. */
export function Avatars({ project }: { project: ProjectDocument }) {
	const { awareness, identity, rename } = usePresence();
	const participants = useParticipants();
	// Tooltips name each Participant's Diagram: follow renames and deletions.
	useProjectVersion(project);
	const [isRenaming, setRenaming] = useState(false);
	if (!awareness) return null;

	const diagramName = (id: string | null) => project.diagrams().find((d) => d.id === id)?.name;

	return (
		<div className="avatars">
			{isRenaming ? (
				<EditableText
					className="avatar-rename"
					value={identity.name}
					onChange={rename}
					isEditing
					onEditingChange={setRenaming}
				/>
			) : (
				<button
					className="avatar avatar-me"
					style={{ background: identity.color }}
					title={`${identity.name} (${strings.presence.you}) · ${strings.presence.renameHint}`}
					aria-label={`${identity.name} (${strings.presence.you})`}
					onClick={() => setRenaming(true)}
				>
					{initials(identity.name)}
				</button>
			)}
			{participants.map((p) => {
				const where = diagramName(p.diagramId);
				return (
					<span
						key={p.clientId}
						className="avatar"
						style={{ background: p.color }}
						title={where ? `${p.name} · ${where}` : p.name}
						aria-label={p.name}
					>
						{initials(p.name)}
					</span>
				);
			})}
		</div>
	);
}
