import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { EditableText } from '../canvas/EditableText';
import { ProjectDocument } from '@simple-modelisation/model/project.ts';
import type { ProjectSummary } from '../document/registry';
import { deleteProjectDoc, renameStoredProject, saveProjectDoc } from '../storage/persistence';
import { strings } from '../ui/strings';
import { useProjects, useRegistry } from './registry-context';

export function HomePage() {
	const registry = useRegistry();
	const projects = useProjects();
	const navigate = useNavigate();
	const fileInput = useRef<HTMLInputElement>(null);
	const [importError, setImportError] = useState<string | null>(null);

	const create = () => {
		const project = registry.create();
		void navigate(`/p/${project.id}`);
	};

	const importFile = async (file: File) => {
		setImportError(null);
		try {
			const project = ProjectDocument.fromFile(JSON.parse(await file.text()));
			// Store the content first, so a failed save leaves no empty Project behind.
			const id = crypto.randomUUID();
			await saveProjectDoc(id, project.doc);
			registry.create(project.name(), Date.now(), id);
			void navigate(`/p/${id}`);
		} catch (error) {
			setImportError(error instanceof Error ? error.message : String(error));
		}
	};

	return (
		<main className="home">
			<header className="home-header">
				<h1>{strings.home.title}</h1>
				<div className="home-actions">
					<button onClick={() => fileInput.current?.click()}>{strings.home.importProject}</button>
					<button className="primary" onClick={create}>
						{strings.home.newProject}
					</button>
				</div>
				<input
					ref={fileInput}
					type="file"
					accept="application/json,.json"
					hidden
					onChange={(e) => {
						const file = e.currentTarget.files?.[0];
						e.currentTarget.value = '';
						if (file) void importFile(file);
					}}
				/>
			</header>
			{importError && (
				<p className="error">
					{strings.home.importFailed} {importError}
				</p>
			)}
			{projects.length === 0 ? (
				<p className="status">{strings.home.empty}</p>
			) : (
				<ul className="project-list">
					{projects.map((project) => (
						<ProjectRow key={project.id} project={project} />
					))}
				</ul>
			)}
		</main>
	);
}

function ProjectRow({ project }: { project: ProjectSummary }) {
	const registry = useRegistry();
	const [mode, setMode] = useState<'view' | 'rename' | 'delete'>('view');

	const remove = () => {
		registry.remove(project.id);
		void deleteProjectDoc(project.id);
	};

	return (
		<li className="project-row">
			{mode === 'rename' ? (
				<EditableText
					className="project-name-input"
					value={project.name}
					onChange={(name) => {
						registry.rename(project.id, name);
						void renameStoredProject(project.id, name);
					}}
					isEditing
					onEditingChange={(editing) => !editing && setMode('view')}
				/>
			) : (
				<Link className="project-name" to={`/p/${project.id}`}>
					{project.name}
				</Link>
			)}
			{project.shared && <span className="shared-badge">{strings.home.shared}</span>}
			<span className="project-date">
				{strings.home.updated} {new Date(project.updatedAt).toLocaleString()}
			</span>
			{mode === 'delete' ? (
				<>
					<span>{project.shared ? strings.home.confirmRemove : strings.home.confirmDelete}</span>
					<button className="danger" onClick={remove}>
						{project.shared ? strings.home.remove : strings.home.delete}
					</button>
					<button onClick={() => setMode('view')}>{strings.home.cancel}</button>
				</>
			) : (
				<>
					{/* A Shared Project is renamed inside it, where the rename syncs. */}
					{!project.shared && (
						<button onClick={() => setMode('rename')}>{strings.home.rename}</button>
					)}
					<button onClick={() => setMode('delete')}>
						{project.shared ? strings.home.remove : strings.home.delete}
					</button>
				</>
			)}
		</li>
	);
}
