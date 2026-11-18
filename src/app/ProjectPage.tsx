import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import type { Diagram, DiagramKind, ProjectDocument } from '@simple-modelisation/model/project.ts';
import { DiagramCanvas, type CanvasKind } from '../canvas/DiagramCanvas';
import { EditableText } from '../canvas/EditableText';
import { mcdKind } from '../mcd/mcd-kind';
import { systemKind } from '../system/system-kind';
import type { ImageFormat } from '../canvas/export-image';
import { exportOpenDiagram } from '../canvas/exporter';
import { copyText } from '../ui/clipboard';
import { downloadText } from '../ui/download';
import { strings } from '../ui/strings';
import { shareLink, type SyncStatus } from '../storage/sync';
import { Avatars } from '../presence/Avatars';
import { reportPresence, usePresence } from '../presence/presence-context';
import { PresenceProvider } from '../presence/PresenceProvider';
import { useProjectDocument, useProjectVersion, useSync } from './project-hooks';
import { forgetProject, makeLocalCopy } from './project-storage';
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
	const registry = useRegistry();
	const navigate = useNavigate();

	// Stopping sharing opens the Local copy; the Shared Project is dropped once its page
	// has closed (its document, sync and list subscriptions gone), not before.
	const retired = useRef<string | null>(null);
	useEffect(() => {
		const old = retired.current;
		if (!old || old === projectId) return;
		retired.current = null;
		forgetProject(registry, old);
	}, [projectId, registry]);
	const openCopy = (copyId: string) => {
		retired.current = projectId;
		void navigate(`/p/${copyId}`, { replace: true });
	};

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
					{project && (
						<ProjectActions
							project={project}
							projectId={projectId}
							status={status}
							onCopied={openCopy}
						/>
					)}
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

type ActionsProps = {
	project: ProjectDocument;
	projectId: string;
	status: SyncStatus;
	onCopied: (copyId: string) => void;
};

function ProjectActions({ project, projectId, status, onCopied }: ActionsProps) {
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
			{status !== 'local' && (
				<StopSharing project={project} projectId={projectId} onCopied={onCopied} />
			)}
			<button onClick={() => project.undo()}>{strings.project.undo}</button>
			<button onClick={() => project.redo()}>{strings.project.redo}</button>
			<ExportMenu project={project} />
		</div>
	);
}

/**
 * Stops sharing on this device: stores and lists a Local copy under a new id,
 * so that sharing it again gives a new link; `onCopied` then opens it. Others
 * keep the Shared Project.
 */
function StopSharing({ projectId, project, onCopied }: StopSharingProps) {
	const registry = useRegistry();
	const [step, setStep] = useState<'idle' | 'confirm' | 'copying' | 'failed'>('idle');

	const stop = async () => {
		setStep('copying');
		try {
			onCopied(await makeLocalCopy(registry, projectId, project.doc));
		} catch (error) {
			console.error('Stop sharing failed', error);
			setStep('failed');
		}
	};

	if (step === 'idle' || step === 'failed') {
		return (
			<>
				{step === 'failed' && (
					<span className="export-note">{strings.project.stopSharingFailed}</span>
				)}
				<button onClick={() => setStep('confirm')}>{strings.project.stopSharing}</button>
			</>
		);
	}
	return (
		<span className="confirm-inline">
			<span>{strings.project.confirmStopSharing}</span>
			<button className="danger" disabled={step === 'copying'} onClick={() => void stop()}>
				{strings.project.stopSharing}
			</button>
			<button disabled={step === 'copying'} onClick={() => setStep('idle')}>
				{strings.home.cancel}
			</button>
		</span>
	);
}

type StopSharingProps = {
	projectId: string;
	project: ProjectDocument;
	onCopied: (copyId: string) => void;
};

/** Export: the Project as JSON, the open Diagram as an image. */
function ExportMenu({ project }: { project: ProjectDocument }) {
	const menu = useRef<HTMLDetailsElement>(null);
	const [note, setNote] = useState<string | null>(null);

	// Closes on a click elsewhere or on Escape, like a menu.
	useEffect(() => {
		const close = (e: Event) => {
			const details = menu.current;
			if (!details?.open) return;
			if (e instanceof KeyboardEvent ? e.key === 'Escape' : !details.contains(e.target as Node))
				details.open = false;
		};
		document.addEventListener('pointerdown', close);
		document.addEventListener('keydown', close);
		return () => {
			document.removeEventListener('pointerdown', close);
			document.removeEventListener('keydown', close);
		};
	}, []);
	useEffect(() => {
		if (!note) return;
		const timer = setTimeout(() => setNote(null), 3000);
		return () => clearTimeout(timer);
	}, [note]);

	const exportImage = async (format: ImageFormat) => {
		try {
			if (!(await exportOpenDiagram(format))) setNote(strings.project.nothingToExport);
		} catch (error) {
			console.error('Image export failed', error);
			setNote(strings.project.exportFailed);
		}
	};

	return (
		<>
			{note && <span className="export-note">{note}</span>}
			<details className="export-menu" ref={menu}>
				<summary>{strings.project.export}</summary>
				<div className="export-options" onClick={() => menu.current?.removeAttribute('open')}>
					<button
						onClick={() =>
							downloadText(
								`${project.name()}.json`,
								JSON.stringify(project.toFile(), null, 2),
								'application/json'
							)
						}
					>
						{strings.project.exportProject}
					</button>
					{(['png', 'svg'] as const).map((format) => (
						<button key={format} onClick={() => void exportImage(format)}>
							{strings.project.exportImage[format]}
						</button>
					))}
				</div>
			</details>
		</>
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
