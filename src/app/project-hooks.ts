import { useEffect, useReducer, useState } from 'react';
import { ProjectDocument } from '../document/project';
import { openProjectDoc } from '../storage/persistence';
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
			unsubscribe = touchOnLocalEdits(doc, () => registry.touch(projectId));
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
 * Keeps the Project's "last updated" date current: one touch shortly after a
 * burst of edits, and a final one on close. It subscribes once the stored
 * content is loaded, so every update is an edit.
 */
function touchOnLocalEdits(project: ProjectDocument, touch: () => void): () => void {
	let pending: ReturnType<typeof setTimeout> | undefined;
	const unsubscribe = project.subscribe(() => {
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
