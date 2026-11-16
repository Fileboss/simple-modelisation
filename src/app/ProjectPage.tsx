import { useEffect } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import type { Diagram, DiagramKind, ProjectDocument } from '../document/project';
import { DiagramCanvas, type CanvasKind } from '../canvas/DiagramCanvas';
import { EditableText } from '../canvas/EditableText';
import { mcdKind } from '../mcd/mcd-kind';
import { systemKind } from '../system/system-kind';
import { strings } from '../ui/strings';
import { useProjectDocument, useProjectVersion } from './project-hooks';
import { useProjects } from './registry-context';

const KINDS: Record<DiagramKind, CanvasKind> = {
	system: systemKind,
	mcd: mcdKind
};

export function ProjectPage() {
	const { projectId = '' } = useParams();
	const summary = useProjects().find((p) => p.id === projectId);
	const project = useProjectDocument(summary ? projectId : null);

	if (!summary) {
		return (
			<main className="status">
				<p>{strings.project.notFound}</p>
				<Link to="/">{strings.project.backHome}</Link>
			</main>
		);
	}

	return (
		<div className="project">
			<header className="project-header">
				<Link to="/">← {strings.project.backHome}</Link>
				<h1>{summary.name}</h1>
				{project && <ProjectActions project={project} name={summary.name} />}
			</header>
			{project ? (
				<ProjectWorkspace project={project} />
			) : (
				<main className="status">{strings.loading}</main>
			)}
		</div>
	);
}

function ProjectActions({ project, name }: { project: ProjectDocument; name: string }) {
	useUndoShortcuts(project);
	return (
		<div className="project-actions">
			<button onClick={() => project.undo()}>{strings.project.undo}</button>
			<button onClick={() => project.redo()}>{strings.project.redo}</button>
			<button onClick={() => downloadJson(`${name}.json`, project.toFile(name))}>
				{strings.project.export}
			</button>
		</div>
	);
}

function ProjectWorkspace({ project }: { project: ProjectDocument }) {
	useProjectVersion(project);
	const [searchParams, setSearchParams] = useSearchParams();
	const diagrams = project.diagrams();
	const open = diagrams.find((d) => d.id === searchParams.get('d')) ?? diagrams[0];
	const select = (id: string) => setSearchParams({ d: id }, { replace: true });

	const add = (kind: DiagramKind) => {
		project.stopCapturing();
		select(project.addDiagram(kind));
	};

	return (
		<>
			<nav className="tabs">
				{diagrams.map((d) => (
					<DiagramTab
						key={d.id}
						diagram={d}
						isOpen={d.id === open?.id}
						onSelect={() => select(d.id)}
						onRename={(name) => project.renameDiagram(d.id, name)}
						onDelete={() => project.deleteDiagram(d.id)}
					/>
				))}
				<button onClick={() => add('system')}>{strings.project.addSystem}</button>
				<button onClick={() => add('mcd')}>{strings.project.addMcd}</button>
			</nav>
			<main className="canvas">
				{open ? (
					<DiagramCanvas key={open.id} project={project} diagram={open} kind={KINDS[open.kind]} />
				) : (
					<p className="status">{strings.project.noDiagrams}</p>
				)}
			</main>
		</>
	);
}

type TabProps = {
	diagram: Diagram;
	isOpen: boolean;
	onSelect: () => void;
	onRename: (name: string) => void;
	onDelete: () => void;
};

function DiagramTab({ diagram, isOpen, onSelect, onRename, onDelete }: TabProps) {
	return (
		<div className={`tab ${isOpen ? 'tab-open' : ''}`}>
			<div className="tab-name" role="button" tabIndex={0} onClick={onSelect}>
				<span className={`tab-kind tab-kind-${diagram.kind}`}>
					{diagram.kind === 'mcd' ? 'MCD' : 'SD'}
				</span>
				<EditableText value={diagram.name} onChange={onRename} />
			</div>
			{isOpen && (
				<button
					className="tab-close"
					title={strings.project.deleteDiagram}
					aria-label={strings.project.deleteDiagram}
					onClick={onDelete}
				>
					×
				</button>
			)}
		</div>
	);
}

/** Ctrl/Cmd+Z undoes, Ctrl/Cmd+Shift+Z redoes, except while typing in a field. */
function useUndoShortcuts(project: ProjectDocument) {
	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return;
			const target = e.target as HTMLElement;
			if (target.closest('input, textarea, [contenteditable="true"]')) return;
			e.preventDefault();
			if (e.shiftKey) project.redo();
			else project.undo();
		};
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, [project]);
}

function downloadJson(fileName: string, data: unknown) {
	const url = URL.createObjectURL(
		new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
	);
	const link = document.createElement('a');
	link.href = url;
	link.download = fileName;
	document.body.append(link);
	link.click();
	link.remove();
	// Some browsers start the download after click() returns: revoke later.
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}
