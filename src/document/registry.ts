import * as Y from 'yjs';

export type ProjectSummary = {
	id: string;
	name: string;
	createdAt: number;
	updatedAt: number;
};

export const DEFAULT_PROJECT_NAME = 'Untitled project';

/**
 * The list of Projects, kept in its own Yjs document so it persists and,
 * later, syncs the same way as the Projects themselves (ADR 0001).
 */
export class ProjectRegistry {
	readonly doc: Y.Doc;
	private readonly projects: Y.Map<ProjectSummary>;

	constructor(doc: Y.Doc = new Y.Doc()) {
		this.doc = doc;
		this.projects = doc.getMap('projects');
	}

	/** Most recently updated first. */
	list(): ProjectSummary[] {
		return [...this.projects.values()].sort((a, b) => b.updatedAt - a.updatedAt);
	}

	get(id: string): ProjectSummary | undefined {
		return this.projects.get(id);
	}

	create(
		name: string = DEFAULT_PROJECT_NAME,
		now: number = Date.now(),
		id: string = crypto.randomUUID()
	): ProjectSummary {
		const project = {
			id,
			name: cleanName(name),
			createdAt: now,
			updatedAt: now
		};
		this.projects.set(project.id, project);
		return project;
	}

	rename(id: string, name: string, now: number = Date.now()): void {
		const project = this.require(id);
		this.projects.set(id, { ...project, name: cleanName(name), updatedAt: now });
	}

	/** Marks a Project as just edited, so it moves to the top of the list. */
	touch(id: string, now: number = Date.now()): void {
		const project = this.projects.get(id);
		if (project) this.projects.set(id, { ...project, updatedAt: now });
	}

	remove(id: string): void {
		this.projects.delete(id);
	}

	subscribe(listener: () => void): () => void {
		this.projects.observe(listener);
		return () => this.projects.unobserve(listener);
	}

	private require(id: string): ProjectSummary {
		const project = this.projects.get(id);
		if (!project) throw new Error(`Unknown project ${id}`);
		return project;
	}
}

function cleanName(name: string): string {
	return name.trim() || DEFAULT_PROJECT_NAME;
}
