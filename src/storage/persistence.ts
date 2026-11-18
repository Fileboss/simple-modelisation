import { IndexeddbPersistence } from 'y-indexeddb';
import * as Y from 'yjs';
import { ProjectDocument } from '@simple-modelisation/model/project.ts';
import { ProjectRegistry } from '../document/registry';

const PREFIX = 'simple-modelisation';
const projectDbName = (id: string) => `${PREFIX}:project:${id}`;

/** Loads the Project list from the browser and keeps it saved until `close`. */
export async function openRegistry(): Promise<{ registry: ProjectRegistry; close: () => void }> {
	const doc = new Y.Doc();
	const persistence = new IndexeddbPersistence(`${PREFIX}:projects`, doc);
	await persistence.whenSynced;
	return {
		registry: new ProjectRegistry(doc),
		close: () => {
			void persistence.destroy();
			doc.destroy();
		}
	};
}

/** Loads a Project's document from the browser and keeps it saved until `close`. */
export async function openProjectDoc(id: string): Promise<{ doc: Y.Doc; close: () => void }> {
	const doc = new Y.Doc();
	const persistence = new IndexeddbPersistence(projectDbName(id), doc);
	await persistence.whenSynced;
	return {
		doc,
		close: () => {
			void persistence.destroy();
			doc.destroy();
		}
	};
}

export async function deleteProjectDoc(id: string): Promise<void> {
	await new IndexeddbPersistence(projectDbName(id), new Y.Doc()).clearData();
}

/** Renames a Project that is not open, in its stored document. */
export async function renameStoredProject(id: string, name: string): Promise<void> {
	const { doc, close } = await openProjectDoc(id);
	new ProjectDocument(doc).rename(name);
	close();
}

/**
 * Stores a copy of a Project document under a new Project id (stopping
 * sharing): taken once the new storage is open, so it holds every change made
 * until then; a failed copy leaves nothing behind. Its undo history is empty.
 */
export async function storeCopy(id: string, source: Y.Doc): Promise<void> {
	const doc = new Y.Doc();
	const persistence = new IndexeddbPersistence(projectDbName(id), doc);
	try {
		await persistence.whenSynced;
		Y.applyUpdate(doc, Y.encodeStateAsUpdate(source));
	} catch (error) {
		await persistence.clearData();
		throw error;
	} finally {
		// Closing waits for the copy's write to finish.
		void persistence.destroy();
		doc.destroy();
	}
}

/** Stores a Project document built in memory (an import) under a new Project id. */
export async function saveProjectDoc(id: string, doc: Y.Doc): Promise<void> {
	const persistence = new IndexeddbPersistence(projectDbName(id), doc);
	await persistence.whenSynced;
	await persistence.destroy();
}
