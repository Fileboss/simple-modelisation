import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

/**
 * Shared Projects' Yjs documents, one row per document, in a SQLite file, with
 * when each was last changed and last opened (ADR 0011).
 */
export class DocumentStore {
	private readonly db: DatabaseSync;
	/** The stored documents' total size, kept as they are stored and deleted. */
	private bytes: number;

	constructor(dataDir: string) {
		mkdirSync(dataDir, { recursive: true });
		this.db = new DatabaseSync(path.join(dataDir, 'documents.sqlite'));
		this.db.exec(`CREATE TABLE IF NOT EXISTS documents (
			name TEXT PRIMARY KEY,
			data BLOB NOT NULL,
			updated_at INTEGER NOT NULL,
			last_opened_at INTEGER
		)`);
		// A table made before last opens were kept: until opened again, its last change stands for it.
		const columns = this.db.prepare('PRAGMA table_info(documents)').all() as { name: string }[];
		if (!columns.some((c) => c.name === 'last_opened_at')) {
			this.db.exec('ALTER TABLE documents ADD COLUMN last_opened_at INTEGER');
		}
		this.db.exec('CREATE INDEX IF NOT EXISTS documents_last_opened ON documents (last_opened_at)');
		// Also rows an older server wrote after this one had added the column.
		this.db.exec('UPDATE documents SET last_opened_at = updated_at WHERE last_opened_at IS NULL');
		const total = this.db
			.prepare('SELECT COALESCE(SUM(length(data)), 0) AS bytes FROM documents')
			.get() as { bytes: number };
		this.bytes = total.bytes;
	}

	has(name: string): boolean {
		return this.db.prepare('SELECT 1 FROM documents WHERE name = ?').get(name) !== undefined;
	}

	fetch(name: string): Uint8Array | null {
		const row = this.db.prepare('SELECT data FROM documents WHERE name = ?').get(name) as
			{ data: Uint8Array } | undefined;
		return row ? new Uint8Array(row.data) : null;
	}

	/** Stores a document's state; storing it means it is open. */
	store(name: string, data: Uint8Array, now: number = Date.now()): void {
		const before = this.db
			.prepare('SELECT length(data) AS bytes FROM documents WHERE name = ?')
			.get(name) as { bytes: number } | undefined;
		this.db
			.prepare(
				`INSERT INTO documents (name, data, updated_at, last_opened_at) VALUES (?, ?, ?, ?)
				ON CONFLICT(name) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at,
				last_opened_at = excluded.last_opened_at`
			)
			.run(name, data, now, now);
		this.bytes += data.byteLength - (before?.bytes ?? 0);
	}

	/** Notes that a stored document is open now (loaded, held in memory, or leaving it). */
	touch(name: string, now: number = Date.now()): void {
		this.db.prepare('UPDATE documents SET last_opened_at = ? WHERE name = ?').run(now, name);
	}

	/** When a document was last opened, if it is stored. */
	lastOpened(name: string): number | undefined {
		const row = this.db.prepare('SELECT last_opened_at FROM documents WHERE name = ?').get(name) as
			{ last_opened_at: number } | undefined;
		return row?.last_opened_at;
	}

	/** The stored documents' total size, in bytes. */
	totalBytes(): number {
		return this.bytes;
	}

	/** Deletes the documents last opened before `before`, except `kept`; returns their names. */
	expire(before: number, kept: ReadonlySet<string>): string[] {
		const rows = this.db
			.prepare('SELECT name, length(data) AS bytes FROM documents WHERE last_opened_at < ?')
			.all(before) as { name: string; bytes: number }[];
		const expired = rows.filter((r) => !kept.has(r.name));
		if (expired.length === 0) return [];
		const remove = this.db.prepare('DELETE FROM documents WHERE name = ? AND last_opened_at < ?');
		// One transaction: a first sweep may delete many.
		this.db.exec('BEGIN');
		try {
			for (const { name } of expired) remove.run(name, before);
			this.db.exec('COMMIT');
		} catch (error) {
			this.db.exec('ROLLBACK');
			throw error;
		}
		for (const { bytes } of expired) this.bytes -= bytes;
		return expired.map((r) => r.name);
	}

	close(): void {
		this.db.close();
	}
}
