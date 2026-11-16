import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import type { Diagram, DiagramKind, ProjectDocument } from '@simple-modelisation/model/project.ts';
import { DiagramCanvas, type CanvasKind } from '../canvas/DiagramCanvas';
import { EditableText } from '../canvas/EditableText';
import { mcdKind } from '../mcd/mcd-kind';
import { systemKind } from '../system/system-kind';
import { copyText } from '../ui/clipboard';
import { downloadText } from '../ui/download';
import { strings } from '../ui/strings';
import { shareLink, type SyncStatus } from '../storage/sync';
import { Avatars } from '../presence/Avatars';
import { reportPresence, usePresence } from '../presence/presence-context';
import { PresenceProvider } from '../presence/PresenceProvider';
import { useProjectDocument, useProjectVersion, useSync } from './project-hooks';
import { useProjects, useRegistry } from './registry-context';

const KINDS: Record<DiagramKind, CanvasKind> = {
	system: systemKind,
	mcd: mcdKind
};

export function ProjectPage() {
	const { projectId = '' } = useParams();
	const summary = useProjects().find((p) => p.id === projectId);
	const project = useProjectDocument(summary ? projectId : null);
	const { status, awareness } = useSync(projectId, project, summary?.shared ?? false);

	if (!summary) {
		return (
			<main className="status">
				<p>{strings.project.notFound}</p>
				<Link to="/">{strings.project.backHome}</Link>
			</main>
		);
	}

	return (
		<PresenceProvider awareness={awareness}>
			<div className="project">
				<header className="project-header">
					<Link to="/">← {strings.project.backHome}</Link>
					<h1>
						{project ? (
							<EditableText value={project.name()} onChange={(name) => project.rename(name)} />
						) : (
							summary.name
						)}
					</h1>
					<span className={`sync-status sync-${status}`}>{strings.project.status[status]}</span>
					{project && <Avatars project={project} />}
					{project && <ProjectActions project={project} projectId={projectId} status={status} />}
				</header>
				{project ? (
					<ProjectWorkspace project={project} />
				) : (
					<main className="status">{strings.loading}</main>
				)}
			</div>
		</PresenceProvider>
	);
}

type ActionsProps = { project: ProjectDocument; projectId: string; status: SyncStatus };

function ProjectActions({ project, projectId, status }: ActionsProps) {
	useUndoShortcuts(project);
	const registry = useRegistry();
	const [copy, setCopy] = useState<'idle' | 'copied' | 'failed'>('idle');

	const share = async () => {
		if (status === 'local') registry.setShared(projectId, true);
		setCopy((await copyText(shareLink(projectId))) ? 'copied' : 'failed');
	};
	useEffect(() => {
		if (copy !== 'copied') return;
		const timer = setTimeout(() => setCopy('idle'), 2000);
		return () => clearTimeout(timer);
	}, [copy]);

	return (
		<div className="project-actions">
			{copy === 'failed' && (
				<label className="share-link">
					{strings.project.copyFailed}
					<input
						readOnly
						autoFocus
						value={shareLink(projectId)}
						onFocus={(e) => e.currentTarget.select()}
					/>
				</label>
			)}
			<button className="primary" onClick={() => void share()}>
				{copy === 'copied'
					? strings.project.linkCopied
					: status === 'local'
						? strings.project.share
						: strings.project.copyLink}
			</button>
			<button onClick={() => project.undo()}>{strings.project.undo}</button>
			<button onClick={() => project.redo()}>{strings.project.redo}</button>
			<button
				onClick={() =>
					downloadText(
						`${project.name()}.json`,
						JSON.stringify(project.toFile(), null, 2),
						'application/json'
					)
				}
			>
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

	// Others see which Diagram this Participant is on; the canvas reports its own cursor and selection.
	const { awareness } = usePresence();
	const openId = open?.id ?? null;
	useEffect(() => {
		reportPresence(awareness, { diagramId: openId });
	}, [awareness, openId]);

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
