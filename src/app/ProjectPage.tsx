import { isTypingTarget } from '../ui/typing';
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
import { downloadBlob, downloadText } from '../ui/download';
import { allDiagramsZip, fileName } from '../canvas/export-all';
import { readIncludeLegend, saveIncludeLegend } from './legend-preference';
import { strings } from '../ui/strings';
import { useTransientNote } from '../ui/transient-note';
import { useSmallScreen } from '../ui/media';
import { useMenuDismiss } from '../ui/menu';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { shareLink, type SyncStatus } from '../storage/sync';
import { Avatars } from '../presence/Avatars';
import { reportPresence, usePresence } from '../presence/presence-context';
import { PresenceProvider } from '../presence/PresenceProvider';
import { useProjectDocument, useProjectVersion, useSync } from './project-hooks';
import { DiagramKindBadge, DiagramTabs } from './DiagramTabs';
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
	const smallScreen = useSmallScreen();

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
			{/* The whole page, header included; another Project starts afresh. */}
			<ErrorBoundary key={projectId}>
				<div className="project">
					{smallScreen && project ? (
						<CompactHeader
							project={project}
							projectId={projectId}
							status={status}
							onCopied={openCopy}
						/>
					) : (
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
					)}
					{project ? (
						<ProjectWorkspace project={project} tabs={!smallScreen} />
					) : (
						<main className="status">{strings.loading}</main>
					)}
				</div>
			</ErrorBoundary>
		</PresenceProvider>
	);
}

type ActionsProps = {
	project: ProjectDocument;
	projectId: string;
	status: SyncStatus;
	onCopied: (copyId: string) => void;
	/** In the ☰ menu: undo and redo stay outside it. */
	inMenu?: boolean;
};

/**
 * The header on a small screen, on one line: ☰ for the Project's actions, the
 * open Diagram as a picker, undo and redo.
 */
function CompactHeader(props: ActionsProps) {
	const { project, status } = props;
	useProjectVersion(project);
	const menu = useRef<HTMLDetailsElement>(null);
	useMenuDismiss(menu);
	const [renaming, setRenaming] = useState(false);
	return (
		<header className="project-header compact-header">
			<details className="header-menu" ref={menu}>
				<summary aria-label={strings.project.menu}>☰</summary>
				<div className="header-menu-options">
					<Link to="/">← {strings.project.backHome}</Link>
					<div className="header-menu-name">
						<EditableText
							value={project.name()}
							onChange={(name) => project.rename(name)}
							isEditing={renaming}
							onEditingChange={setRenaming}
						/>
						{!renaming && (
							<button onClick={() => setRenaming(true)}>{strings.project.rename}</button>
						)}
					</div>
					<span className={`sync-status sync-${status}`}>{strings.project.status[status]}</span>
					<ProjectActions {...props} inMenu />
				</div>
			</details>
			<DiagramPicker project={project} />
			<Avatars project={project} />
			<button
				className="header-icon"
				aria-label={strings.project.undo}
				title={strings.project.undo}
				onClick={() => project.undo()}
			>
				↶
			</button>
			<button
				className="header-icon"
				aria-label={strings.project.redo}
				title={strings.project.redo}
				onClick={() => project.redo()}
			>
				↷
			</button>
		</header>
	);
}

/** The open Diagram's name, opening the list of Diagrams: switch, add, rename, delete. */
function DiagramPicker({ project }: { project: ProjectDocument }) {
	const { diagrams, open, select, add, duplicate } = useOpenDiagram(project);
	const menu = useRef<HTMLDetailsElement>(null);
	useMenuDismiss(menu);
	const [renaming, setRenaming] = useState(false);
	// Deleting asks once: the entries are close together under a finger.
	const [confirming, setConfirming] = useState(false);
	const close = () => {
		menu.current?.removeAttribute('open');
		setConfirming(false);
	};

	if (open && renaming) {
		return (
			<div className="diagram-picker">
				<EditableText
					value={open.name}
					onChange={(name) => project.renameDiagram(open.id, name)}
					isEditing
					onEditingChange={setRenaming}
				/>
			</div>
		);
	}
	return (
		<details className="diagram-picker" ref={menu}>
			<summary>
				{open ? <DiagramLabel diagram={open} /> : strings.project.diagrams}
				<span aria-hidden="true"> ▾</span>
			</summary>
			<div className="header-menu-options" onClick={close}>
				{diagrams.map((d) => (
					<button
						key={d.id}
						className={d.id === open?.id ? 'diagram-picker-open' : ''}
						onClick={() => select(d.id)}
					>
						<DiagramLabel diagram={d} />
					</button>
				))}
				<hr />
				<button onClick={() => add('system')}>{strings.project.addSystem}</button>
				<button onClick={() => add('mcd')}>{strings.project.addMcd}</button>
				{open && (
					<>
						<hr />
						<button onClick={() => setRenaming(true)}>{strings.project.renameDiagram}</button>
						<button onClick={() => duplicate(open.id)}>{strings.project.duplicateDiagram}</button>
						{confirming ? (
							<span className="confirm-inline">
								<span>{strings.project.confirmDeleteDiagram(open.name)}</span>
								<button className="danger" onClick={() => project.deleteDiagram(open.id)}>
									{strings.home.delete}
								</button>
								<button
									onClick={(e) => {
										e.stopPropagation();
										setConfirming(false);
									}}
								>
									{strings.home.cancel}
								</button>
							</span>
						) : (
							<button
								onClick={(e) => {
									e.stopPropagation();
									setConfirming(true);
								}}
							>
								{strings.project.deleteDiagram}
							</button>
						)}
					</>
				)}
			</div>
		</details>
	);
}

function DiagramLabel({ diagram }: { diagram: Diagram }) {
	return (
		<span className="tab-name">
			<DiagramKindBadge kind={diagram.kind} />
			<span className="diagram-label-name">{diagram.name}</span>
		</span>
	);
}

/** The Diagram open in the page (from the URL), and the ways to change it. */
function useOpenDiagram(project: ProjectDocument) {
	const [searchParams, setSearchParams] = useSearchParams();
	const diagrams = project.diagrams();
	const named = (key: string) => diagrams.find((d) => d.id === searchParams.get(key));
	// A copy undone or deleted gives way to what it was made from.
	const asked = named('d') ?? named('from');
	const open = asked ?? diagrams[0];
	// The first one, opened because none was asked for, stays open when tabs move.
	const unpinned = asked ? undefined : open?.id;
	useEffect(() => {
		if (unpinned) setSearchParams({ d: unpinned }, { replace: true });
	}, [unpinned, setSearchParams]);
	const select = (id: string) => setSearchParams({ d: id }, { replace: true });
	const add = (kind: DiagramKind) => {
		project.stopCapturing();
		select(project.addDiagram(kind));
	};
	const duplicate = (id: string) => {
		setSearchParams({ d: project.duplicateDiagram(id), from: id }, { replace: true });
	};
	return { diagrams, open, select, add, duplicate };
}

function ProjectActions({ project, projectId, status, onCopied, inMenu }: ActionsProps) {
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
			{!inMenu && <button onClick={() => project.undo()}>{strings.project.undo}</button>}
			{!inMenu && <button onClick={() => project.redo()}>{strings.project.redo}</button>}
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

/** Export: the Project as JSON, the open Diagram as an image, with a Legend or not. */
function ExportMenu({ project }: { project: ProjectDocument }) {
	const menu = useRef<HTMLDetailsElement>(null);
	const [note, setNote] = useTransientNote();
	const [legend, setLegend] = useState(readIncludeLegend);
	const toggleLegend = (include: boolean) => {
		setLegend(include);
		saveIncludeLegend(include);
	};

	// Closes on a click elsewhere or on Escape, like a menu.
	useMenuDismiss(menu);
	const exportAll = async () => {
		try {
			// Every image at the model's estimates, as over MCP, the open Diagram included: its
			// own SVG export, at the sizes the canvas measured, may differ slightly.
			const zip = await allDiagramsZip(project, (d, nodes) =>
				KINDS[d.kind].drawSvg(d.id, nodes, project.edges(d.id), () => undefined, legend)
			);
			if (!zip) return setNote(strings.project.nothingToZip);
			downloadBlob(`${fileName(project.name())}.zip`, zip);
		} catch (error) {
			console.error('Export failed', error);
			setNote(strings.project.exportFailed);
		}
	};

	const exportImage = async (format: ImageFormat) => {
		try {
			if (!(await exportOpenDiagram(format, { legend }))) setNote(strings.project.nothingToExport);
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
					<button onClick={() => void exportAll()}>{strings.project.exportAll}</button>
					{/* A setting, not an action: checking it leaves the menu open. */}
					<label className="export-check" onClick={(e) => e.stopPropagation()}>
						<input
							type="checkbox"
							checked={legend}
							onChange={(e) => toggleLegend(e.target.checked)}
						/>
						{strings.project.includeLegend}
					</label>
				</div>
			</details>
		</>
	);
}

/** The open Diagram, under its tabs (`tabs`; on a small screen the header picks it). */
function ProjectWorkspace({ project, tabs }: { project: ProjectDocument; tabs: boolean }) {
	useProjectVersion(project);
	const { diagrams, open, select, add, duplicate } = useOpenDiagram(project);
	// Entries this version cannot read (malformed, or from another version): left out, and said.
	const unreadable = project.unreadable(open?.id);

	// Others see which Diagram this Participant is on; the canvas reports its own cursor and selection.
	const { awareness } = usePresence();
	const openId = open?.id ?? null;
	useEffect(() => {
		reportPresence(awareness, { diagramId: openId });
	}, [awareness, openId]);

	return (
		<>
			{unreadable > 0 && (
				<p className="unreadable-note" role="status">
					{strings.project.unreadable(unreadable)}
				</p>
			)}
			{tabs && (
				<DiagramTabs
					project={project}
					diagrams={diagrams}
					openId={open?.id}
					onSelect={select}
					onDuplicate={duplicate}
					onAdd={add}
				/>
			)}
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

/** Ctrl/Cmd+Z undoes, Ctrl/Cmd+Shift+Z redoes, except while typing in a field. */
function useUndoShortcuts(project: ProjectDocument) {
	useEffect(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return;
			if (isTypingTarget(e.target)) return;
			e.preventDefault();
			if (e.shiftKey) project.redo();
			else project.undo();
		};
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, [project]);
}
