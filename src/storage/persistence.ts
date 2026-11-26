import { IndexeddbPersistence } from 'y-indexeddb';
import * as Y from 'yjs';
import { ProjectDocument } from '@simple-modelisation/model/project.ts';
import { ProjectRegistry } from '../document/registry';
import { joinTabs } from './tab-channel';

const PREFIX = 'simple-modelisation';
const projectDbName = (id: string) => `${PREFIX}:project:${id}`;

/**
 * Loads a document from the browser, then keeps it saved and in step with the
 * other tabs holding it until `close`.
 */
async function openStored(name: string): Promise<{ doc: Y.Doc; close: () => void }> {
	const doc = new Y.Doc();
	const persistence = new IndexeddbPersistence(name, doc);
	await persistence.whenSynced;
	const leaveTabs = joinTabs(name, doc);
	return {
		doc,
		close: () => {
			leaveTabs();
			void persistence.destroy();
			doc.destroy();
		}
	};
}

/** Loads the Project list from the browser and keeps it saved until `close`. */
export async function openRegistry(): Promise<{ registry: ProjectRegistry; close: () => void }> {
	const { doc, close } = await openStored(`${PREFIX}:projects`);
	return { registry: new ProjectRegistry(doc), close };
}

/** Loads a Project's document from the browser and keeps it saved until `close`. */
export function openProjectDoc(id: string): Promise<{ doc: Y.Doc; close: () => void }> {
	return openStored(projectDbName(id));
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

/** What `storeCopy` needs of a browser storage: IndexedDB, or a stand-in in tests. */
export type CopyStorage = {
	whenSynced: Promise<unknown>;
	destroy: () => Promise<void>;
	/** Deletes the stored copy; resolves once it is gone. */
	clearData: () => Promise<void>;
};
export type OpenStorage = (name: string, doc: Y.Doc) => CopyStorage;

const openIndexedDb: OpenStorage = (name, doc) => {
	const persistence = new IndexeddbPersistence(name, doc);
	return {
		whenSynced: persistence.whenSynced,
		destroy: () => persistence.destroy(),
		// y-indexeddb does not wait for the database to be deleted: this does.
		clearData: async () => {
			await persistence.destroy();
			await new Promise<void>((resolve) => {
				const request = indexedDB.deleteDatabase(name);
				request.onsuccess = request.onerror = request.onblocked = () => resolve();
			});
		}
	};
};

/**
 * Stores a copy of a Project document under a new Project id (stopping
 * sharing). Resolves only once the copy, read back from storage, holds exactly
 * what was written: IndexedDB writes in the background and y-indexeddb swallows
 * a full quota, so the original must not go before. Changes made to `source`
 * meanwhile do not count against it. A failed copy is deleted and the error
 * rethrown. Its undo history is empty.
 */
export async function storeCopy(
	id: string,
	source: Y.Doc,
	open: OpenStorage = openIndexedDb
): Promise<void> {
	const name = projectDbName(id);
	// What is written, taken once: the reference the copy is checked against.
	const update = Y.encodeStateAsUpdate(source);
	const written = new Y.Doc();
	Y.applyUpdate(written, update);

	const doc = new Y.Doc();
	const writing = open(name, doc);
	try {
		await writing.whenSynced;
		Y.applyUpdate(doc, update);
		await writing.destroy();
	} catch (error) {
		await discard(writing);
		throw error;
	} finally {
		doc.destroy();
	}

	// A read opened after the write is ordered after it by IndexedDB, whether the
	// write commits or aborts: it sees exactly what was stored.
	const check = new Y.Doc();
	const reading = open(name, check);
	try {
		await reading.whenSynced;
		if (!Y.equalSnapshots(Y.snapshot(check), Y.snapshot(written))) {
			throw new Error('The local copy could not be stored');
		}
		await reading.destroy();
	} catch (error) {
		await discard(reading);
		throw error;
	} finally {
		check.destroy();
		written.destroy();
	}
}

/** Deletes a failed copy; a failure to delete must not hide why the copy failed. */
async function discard(storage: CopyStorage): Promise<void> {
	try {
		await storage.clearData();
	} catch (error) {
		console.error('A failed local copy could not be deleted', error);
	}
}

/** Stores a Project document built in memory (an import) under a new Project id. */
export async function saveProjectDoc(id: string, doc: Y.Doc): Promise<void> {
	const persistence = new IndexeddbPersistence(projectDbName(id), doc);
	await persistence.whenSynced;
	await persistence.destroy();
}
