import type { NodeProps } from '@xyflow/react';
import { useState } from 'react';
import { NOTE_LOOKS } from '@simple-modelisation/model/looks.ts';
import { NOTE_WIDTH } from '@simple-modelisation/model/layout.ts';
import { NOTE_COLORS, type NoteNode as NoteData } from '@simple-modelisation/model/project.ts';
import { strings } from '../ui/strings';
import { useCanvas } from './canvas-context';

/**
 * A Note: a sticky note in its color, its text wrapped; a double click writes
 * in it, leaving the field or Cmd/Ctrl+Enter saves, Escape cancels. No handles:
 * nothing connects to a Note.
 */
export function NoteNode({ id, data, selected }: NodeProps) {
	const { project, diagramId } = useCanvas();
	const note = data as NoteData;
	const look = NOTE_LOOKS[note.color ?? 'yellow'];
	const [editing, setEditing] = useState(false);
	return (
		<div
			className={`note ${selected ? 'selected' : ''}`}
			style={{ width: NOTE_WIDTH, background: look.paper, borderColor: look.edge }}
			onDoubleClick={() => setEditing(true)}
		>
			{editing ? (
				<textarea
					className="nodrag nowheel note-input"
					autoFocus
					defaultValue={note.text}
					aria-label={strings.note.text}
					onBlur={(e) => {
						project.stopCapturing();
						project.setNoteText(diagramId, id, e.currentTarget.value);
						setEditing(false);
					}}
					onKeyDown={(e) => {
						// The canvas shortcuts (Delete, Cmd+A…) are not for the text being written.
						e.stopPropagation();
						if (e.key === 'Escape') setEditing(false);
						if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) e.currentTarget.blur();
					}}
				/>
			) : note.text ? (
				<p className="note-text">{note.text}</p>
			) : (
				<p className="note-text note-empty">{strings.note.empty}</p>
			)}
		</div>
	);
}

/** A Note's panel: its text and its paper color. */
export function NotePanel({ note }: { note: NoteData }) {
	const { project, diagramId } = useCanvas();
	const current = note.color ?? 'yellow';
	return (
		<>
			<h2>{strings.note.title}</h2>
			<label className="panel-field">
				<span>{strings.note.text}</span>
				{/* Shown afresh when the text changes on the canvas, from a peer or an agent. */}
				<textarea
					key={note.text}
					className="note-panel-text"
					defaultValue={note.text}
					rows={5}
					onBlur={(e) => {
						project.stopCapturing();
						project.setNoteText(diagramId, note.id, e.currentTarget.value);
					}}
				/>
			</label>
			<h3>{strings.note.color}</h3>
			<div className="note-colors" role="radiogroup" aria-label={strings.note.color}>
				{NOTE_COLORS.map((color) => (
					<button
						key={color}
						role="radio"
						aria-checked={color === current}
						aria-label={strings.note.colors[color]}
						title={strings.note.colors[color]}
						className={`note-swatch ${color === current ? 'note-swatch-current' : ''}`}
						style={{ background: NOTE_LOOKS[color].paper, borderColor: NOTE_LOOKS[color].edge }}
						onClick={() => {
							project.stopCapturing();
							project.setNoteColor(diagramId, note.id, color);
						}}
					/>
				))}
			</div>
		</>
	);
}
