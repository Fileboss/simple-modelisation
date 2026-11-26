import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { DocumentStore } from './document-store.ts';

const dirs: string[] = [];
afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
const dataDir = () => {
	const dir = mkdtempSync(path.join(tmpdir(), 'store-test-'));
	dirs.push(dir);
	return dir;
};
const bytes = (n: number) => new Uint8Array(n).fill(7);

describe('DocumentStore', () => {
	it('adds last opens to a table made before them, from the last changes, once', () => {
		const dir = dataDir();
		const old = new DatabaseSync(path.join(dir, 'documents.sqlite'));
		old.exec(
			'CREATE TABLE documents (name TEXT PRIMARY KEY, data BLOB NOT NULL, updated_at INTEGER NOT NULL)'
		);
		old.prepare('INSERT INTO documents VALUES (?, ?, ?)').run('a', bytes(3), 1000);
		old.close();

		const first = new DocumentStore(dir);
		expect(first.lastOpened('a')).toBe(1000);
		first.touch('a', 5000);
		first.close();
		const second = new DocumentStore(dir);
		expect(second.lastOpened('a')).toBe(5000);
		expect(second.fetch('a')).toEqual(bytes(3));
		second.close();
	});

	it('counts storing and touching as opening', () => {
		const store = new DocumentStore(dataDir());
		store.store('a', bytes(1), 100);
		expect(store.lastOpened('a')).toBe(100);
		store.touch('a', 200);
		expect(store.lastOpened('a')).toBe(200);
		store.touch('unknown', 300);
		expect(store.has('unknown')).toBe(false);
		store.close();
	});

	it('sums the stored sizes, and counts them again at start', () => {
		const dir = dataDir();
		const store = new DocumentStore(dir);
		expect(store.totalBytes()).toBe(0);
		store.store('a', bytes(10));
		store.store('b', bytes(5));
		store.store('a', bytes(3));
		expect(store.totalBytes()).toBe(8);
		store.close();
		const again = new DocumentStore(dir);
		expect(again.totalBytes()).toBe(8);
		again.close();
	});

	it('deletes the documents last opened before a date, except those kept', () => {
		const store = new DocumentStore(dataDir());
		store.store('old', bytes(1), 100);
		store.store('open', bytes(1), 100);
		store.store('recent', bytes(1), 900);
		expect(store.expire(500, new Set(['open']))).toEqual(['old']);
		expect(['old', 'open', 'recent'].map((n) => store.has(n))).toEqual([false, true, true]);
		expect(store.totalBytes()).toBe(2);
		store.close();
	});
});
