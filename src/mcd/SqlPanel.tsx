import { useEffect, useState } from 'react';
import { useProjectVersion } from '../app/project-hooks';
import { useCanvas } from '../canvas/canvas-context';
import type { Diagram } from '../document/project';
import { deriveMld } from '../sql/mld';
import { linesText, mldLines, postgresScript } from '../sql/postgres';
import { copyText } from '../ui/clipboard';
import { downloadText } from '../ui/download';
import { strings } from '../ui/strings';

const OPEN_KEY = 'simple-modelisation:sql-panel-open';

function readOpen(): boolean {
	try {
		return localStorage.getItem(OPEN_KEY) !== 'false';
	} catch {
		return true;
	}
}

/** Under an MCD: its MLD and PostgreSQL script, live, in a panel that folds away. */
export function SqlPanel({ diagram }: { diagram: Diagram }) {
	const { project } = useCanvas();
	useProjectVersion(project);
	const [isOpen, setOpen] = useState(readOpen);
	const [tab, setTab] = useState<'mld' | 'sql'>('mld');
	const [copy, setCopy] = useState<'idle' | 'copied' | 'failed'>('idle');
	useEffect(() => {
		if (copy === 'idle') return;
		const timer = setTimeout(() => setCopy('idle'), 2000);
		return () => clearTimeout(timer);
	}, [copy]);

	// The warning count shows even folded; the text is only built when it is seen.
	const mld = deriveMld(project.nodes(diagram.id), project.edges(diagram.id));
	const lines = isOpen && tab === 'mld' ? mldLines(mld) : [];
	const text = !isOpen ? '' : tab === 'mld' ? linesText(lines) : postgresScript(mld, diagram.name);

	const toggle = () => {
		setOpen(!isOpen);
		try {
			localStorage.setItem(OPEN_KEY, String(!isOpen));
		} catch {
			// Blocked storage: the panel just forgets its state.
		}
	};

	return (
		<section className={`sql-panel ${isOpen ? 'sql-panel-open' : ''}`}>
			<header className="sql-panel-bar">
				<button
					className="sql-panel-toggle"
					aria-expanded={isOpen}
					onClick={toggle}
					title={isOpen ? strings.sql.collapse : strings.sql.expand}
				>
					{isOpen ? '▾' : '▸'}
				</button>
				{(['mld', 'sql'] as const).map((name) => (
					<button
						key={name}
						className={`sql-tab ${tab === name ? 'sql-tab-open' : ''}`}
						onClick={() => {
							setTab(name);
							if (!isOpen) toggle();
						}}
					>
						{strings.sql.tabs[name]}
					</button>
				))}
				{mld.warnings.length > 0 && (
					<span className="sql-warning-count">
						⚠ {mld.warnings.length} {strings.sql.warnings}
					</span>
				)}
				{isOpen && (
					<span className="sql-actions">
						<button
							onClick={() =>
								void copyText(text).then((done) => setCopy(done ? 'copied' : 'failed'))
							}
						>
							{copy === 'copied'
								? strings.sql.copied
								: copy === 'failed'
									? strings.sql.copyFailed
									: strings.sql.copy}
						</button>
						<button
							onClick={() =>
								downloadText(`${diagram.name}.${tab === 'mld' ? 'txt' : 'sql'}`, text, 'text/plain')
							}
						>
							{strings.sql.download}
						</button>
					</span>
				)}
			</header>
			{isOpen && (
				<div className="sql-panel-body">
					{mld.warnings.length > 0 && (
						<ul className="sql-warnings">
							{mld.warnings.map((warning, index) => (
								<li key={index}>{warning}</li>
							))}
						</ul>
					)}
					{mld.tables.length === 0 ? (
						<p className="panel-hint">{strings.sql.empty}</p>
					) : tab === 'mld' ? (
						<pre className="sql-output">
							{/* Two tables can share a name (a warning), so lines are keyed by position. */}
							{lines.map((line, index) => (
								<div key={index}>
									{line.table} = (
									{line.parts.map((part, index) => (
										<span key={index}>
											{index > 0 && ', '}
											{part.primary ? <u>{part.text}</u> : part.text}
										</span>
									))}
									);
								</div>
							))}
						</pre>
					) : (
						<pre className="sql-output">{text}</pre>
					)}
				</div>
			)}
		</section>
	);
}
