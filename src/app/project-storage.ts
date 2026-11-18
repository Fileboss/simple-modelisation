import type { ProjectRegistry } from '../document/registry';
import { deleteProjectDoc, storeCopy } from '../storage/persistence';
import type * as Y from 'yjs';

/** Drops a Project from this browser: its list entry and its stored document. */
export function forgetProject(registry: ProjectRegistry, id: string): void {
	registry.remove(id);
	void deleteProjectDoc(id);
}

/** Stores and lists a Local copy of a Project under a new id, which it returns. */
export async function makeLocalCopy(
	registry: ProjectRegistry,
	id: string,
	doc: Y.Doc
): Promise<string> {
	const copyId = crypto.randomUUID();
	await storeCopy(copyId, doc);
	registry.addLocalCopy(id, copyId);
	return copyId;
}
