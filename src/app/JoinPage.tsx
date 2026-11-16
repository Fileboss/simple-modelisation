import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import * as Y from 'yjs';
import { ProjectDocument } from '../document/project';
import { saveProjectDoc } from '../storage/persistence';
import { connectSync } from '../storage/sync';
import { strings } from '../ui/strings';
import { useRegistry } from './registry-context';

/** Opens a Share link: fetches the Shared Project, adds it to this browser's list, then opens it. */
export function JoinPage() {
	const { projectId = '' } = useParams();
	const registry = useRegistry();
	const navigate = useNavigate();
	const [problem, setProblem] = useState<'notFound' | 'unreachable' | null>(null);

	useEffect(() => {
		if (registry.get(projectId)) {
			void navigate(`/p/${projectId}`, { replace: true });
			return;
		}
		const doc = new Y.Doc();
		let settled = false;
		let left = false;
		const settle = () => {
			settled = true;
			disconnect();
		};
		const disconnect = connectSync(projectId, doc, 'join', {
			onStatus: (status) => {
				if (status !== 'synced' || settled) return;
				settle();
				const name = new ProjectDocument(doc).name();
				void saveProjectDoc(projectId, doc).then(() => {
					doc.destroy();
					if (left) return;
					registry.create(name, Date.now(), projectId);
					registry.setShared(projectId, true);
					void navigate(`/p/${projectId}`, { replace: true });
				});
			},
			onRefused: () => {
				settle();
				doc.destroy();
				setProblem('notFound');
			}
		});
		const timeout = setTimeout(() => {
			if (settled) return;
			settle();
			doc.destroy();
			setProblem('unreachable');
		}, 10_000);
		return () => {
			left = true;
			clearTimeout(timeout);
			if (!settled) {
				disconnect();
				doc.destroy();
			}
		};
	}, [projectId, registry, navigate]);

	return (
		<main className="status">
			<p>{problem ? strings.join[problem] : strings.join.joining}</p>
			{problem && <Link to="/">{strings.project.backHome}</Link>}
		</main>
	);
}
