import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { ProjectDocument } from '@simple-modelisation/model/project.ts';
import { storeCopy, type OpenStorage } from './persistence';

/**
 * A browser storage in memory that behaves as y-indexeddb does: it stores the
 * document's state once synced, writes in the background (after `destroy` has
 * resolved), and a later read waits for earlier writes, as IndexedDB orders
 * them. With `quotaAfter`, writes past that many bytes are lost without a word.
 */
function memoryStorage(quotaAfter = Infinity) {
	const stored = new Map<string, Uint8Array[]>();
	let pending = Promise.resolve();
	const write = (name: string, update: Uint8Array) => {
		pending = pending.then(() => {
			const kept = stored.get(name) ?? [];
			const size = kept.reduce((total, u) => total + u.length, 0);
			if (size + update.length > quotaAfter) return;
			stored.set(name, [...kept, update]);
		});
	};
	const open: OpenStorage = (name, doc) => {
		const save = (update: Uint8Array, origin: unknown) => {
			if (origin !== 'load') write(name, update);
		};
		const whenSynced = pending.then(() => {
			for (const update of stored.get(name) ?? []) Y.applyUpdate(doc, update, 'load');
			doc.on('update', save);
			write(name, Y.encodeStateAsUpdate(doc));
		});
		const destroy = async () => doc.off('update', save);
		return {
			whenSynced,
			destroy,
			clearData: async () => {
				await destroy();
				await pending;
				stored.delete(name);
			}
		};
	};
	return { open, stored };
}

const project = () => {
	const p = new ProjectDocument();
	p.rename('Shop');
	const d = p.addDiagram('mcd', 'Data');
	p.addEntity(d, 0, 0, 'Customer');
	return p;
};

const readBack = (updates: Uint8Array[]) => {
	const doc = new Y.Doc();
	for (const update of updates) Y.applyUpdate(doc, update);
	return new ProjectDocument(doc);
};

describe('storeCopy', () => {
	it('stores the copy and resolves once it reads back the same', async () => {
		const source = project();
		const { open, stored } = memoryStorage();
		await storeCopy('copy', source.doc, open);
		const copy = readBack([...stored.values()][0]);
		expect(copy.name()).toBe('Shop');
		expect(copy.nodes(copy.diagrams()[0].id).map((n) => n.name)).toEqual(['Customer']);
	});

	it('is not undone by a change made to the original meanwhile', async () => {
		const source = project();
		const { open } = memoryStorage();
		const copying = storeCopy('copy', source.doc, open);
		source.rename('Changed while copying');
		await expect(copying).resolves.toBeUndefined();
	});

	it('rejects and deletes what it wrote when the quota drops the copy', async () => {
		// Room for the empty state written once synced, not for the Project.
		const { open, stored } = memoryStorage(10);
		await expect(storeCopy('copy', project().doc, open)).rejects.toThrow(
			'The local copy could not be stored'
		);
		expect(stored.size).toBe(0);
	});
});
