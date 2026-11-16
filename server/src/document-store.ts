import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

/** Shared Projects' Yjs documents, one row per document, in a SQLite file. */
export class DocumentStore {
	private readonly db: DatabaseSync;

	constructor(dataDir: string) {
		mkdirSync(dataDir, { recursive: true });
		this.db = new DatabaseSync(path.join(dataDir, 'documents.sqlite'));
		this.db.exec(`CREATE TABLE IF NOT EXISTS documents (
			name TEXT PRIMARY KEY,
			data BLOB NOT NULL,
			updated_at INTEGER NOT NULL
		)`);
	}

	has(name: string): boolean {
		return this.db.prepare('SELECT 1 FROM documents WHERE name = ?').get(name) !== undefined;
	}

	fetch(name: string): Uint8Array | null {
		const row = this.db.prepare('SELECT data FROM documents WHERE name = ?').get(name) as
			{ data: Uint8Array } | undefined;
		return row ? new Uint8Array(row.data) : null;
	}

	store(name: string, data: Uint8Array): void {
		this.db
			.prepare(
				`INSERT INTO documents (name, data, updated_at) VALUES (?, ?, ?)
				ON CONFLICT(name) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
			)
			.run(name, data, Date.now());
	}

	close(): void {
		this.db.close();
	}
}
