import { useEffect, useReducer, useState } from 'react';
import { ProjectDocument } from '../document/project';
import { openProjectDoc } from '../storage/persistence';
import { connectSync, type SyncStatus } from '../storage/sync';
import { useRegistry } from './registry-context';

/** The open Project, loaded from the browser and saved while the page is open. */
export function useProjectDocument(projectId: string | null): ProjectDocument | null {
	const registry = useRegistry();
	const [project, setProject] = useState<ProjectDocument | null>(null);

	useEffect(() => {
		if (!projectId) return;
		let close: (() => void) | undefined;
		let unsubscribe: (() => void) | undefined;
		let cancelled = false;
		void openProjectDoc(projectId).then((opened) => {
			if (cancelled) return opened.close();
			close = opened.close;
			const doc = new ProjectDocument(opened.doc);
			doc.adoptName(registry.get(projectId)?.name ?? '');
			const stopTouching = touchOnLocalEdits(doc, () => registry.touch(projectId));
			// The list shows a copy of the name; the document holds the real one.
			const stopNaming = doc.subscribe(() => {
				if (doc.name()) registry.rename(projectId, doc.name());
			});
			unsubscribe = () => {
				stopTouching();
				stopNaming();
			};
			setProject(doc);
		});
		return () => {
			cancelled = true;
			unsubscribe?.();
			close?.();
			setProject(null);
		};
	}, [projectId, registry]);

	return project;
}

/** Re-renders the caller on every change of the Project. */
export function useProjectVersion(project: ProjectDocument): void {
	const [, rerender] = useReducer((n: number) => n + 1, 0);
	useEffect(() => project.subscribe(rerender), [project]);
}

/**
 * Keeps the Project's "last updated" date current with this user's own edits:
 * one touch shortly after a burst of edits, and a final one on close.
 */
function touchOnLocalEdits(project: ProjectDocument, touch: () => void): () => void {
	let pending: ReturnType<typeof setTimeout> | undefined;
	const unsubscribe = project.subscribeLocalEdits(() => {
		if (pending) return;
		pending = setTimeout(() => {
			pending = undefined;
			touch();
		}, 2000);
	});
	return () => {
		unsubscribe();
		if (!pending) return;
		clearTimeout(pending);
		touch();
	};
}

/** Syncs the open Project with the server while it is shared; Local otherwise. */
export function useSync(
	projectId: string,
	project: ProjectDocument | null,
	shared: boolean
): SyncStatus {
	const [status, setStatus] = useState<SyncStatus>('offline');
	const isSyncing = project !== null && shared;

	useEffect(() => {
		if (!isSyncing) return;
		// This device holds the Project's content already: it may recreate it on the server.
		return connectSync(projectId, project.doc, 'share', { onStatus: setStatus });
	}, [projectId, project, isSyncing]);

	return isSyncing ? status : 'local';
}
