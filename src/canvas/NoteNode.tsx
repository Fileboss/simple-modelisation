import { NodeResizeControl, ResizeControlVariant, type NodeProps } from '@xyflow/react';
import { useRef, useState } from 'react';
import { NOTE_LOOKS } from '@simple-modelisation/model/looks.ts';
import {
	NOTE_COLORS,
	NOTE_WIDTHS,
	type NoteNode as NoteData
} from '@simple-modelisation/model/project.ts';
import { strings } from '../ui/strings';
import { useCanvas } from './canvas-context';

/**
 * A Note: a sticky note in its color, its text wrapped; a double click writes
 * in it, leaving the field or Cmd/Ctrl+Enter saves, Escape cancels. No
 * connection handles: nothing connects to a Note. Once selected, its left and
 * right sides resize it; its height follows its text.
 */
export function NoteNode({ id, data, selected }: NodeProps) {
	const { project, diagramId } = useCanvas();
	const note = data as NoteData;
	const look = NOTE_LOOKS[note.color ?? 'yellow'];
	const [editing, setEditing] = useState(false);
	// Escape removes the field, which may fire a blur: that blur must not save. Nor one that
	// changed nothing: it would undo a change a peer or an agent made meanwhile.
	const cancelled = useRef(false);
	const started = useRef('');
	return (
		<div
			className={`note ${selected ? 'selected' : ''}`}
			// As wide as its node, which the canvas sizes and a resize changes live.
			style={{ width: '100%', background: look.paper, borderColor: look.edge }}
			onDoubleClick={() => setEditing(true)}
		>
			{/* Not while its text is edited: a click at the field's edge is for the text. */}
			{selected &&
				!editing &&
				(['left', 'right'] as const).map((side) => (
					<NodeResizeControl
						key={side}
						position={side}
						variant={ResizeControlVariant.Line}
						resizeDirection="horizontal"
						minWidth={NOTE_WIDTHS.min}
						maxWidth={NOTE_WIDTHS.max}
						className="note-resize"
						onResizeStart={() => project.stopCapturing()}
						// The canvas saves the width at the end of the resize, snapped (see useSnapGestures).
					/>
				))}
			{editing ? (
				<textarea
					className="nodrag nowheel note-input"
					autoFocus
					defaultValue={note.text}
					aria-label={strings.note.text}
					onFocus={(e) => {
						cancelled.current = false;
						started.current = e.currentTarget.value;
					}}
					onBlur={(e) => {
						if (!cancelled.current && e.currentTarget.value !== started.current) {
							project.stopCapturing();
							project.setNoteText(diagramId, id, e.currentTarget.value);
						}
						setEditing(false);
					}}
					onKeyDown={(e) => {
						// The canvas shortcuts (Delete, Cmd+A…) are not for the text being written.
						e.stopPropagation();
						if (e.key === 'Escape') {
							cancelled.current = true;
							setEditing(false);
						}
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
	// While the field has the focus, a change from a peer or an agent waits: its key stays
	// what it was at focus time, so what is being typed stays, and is saved on blur.
	const [editedFrom, setEditedFrom] = useState<string | null>(null);
	return (
		<>
			<h2>{strings.note.title}</h2>
			<label className="panel-field">
				<span>{strings.note.text}</span>
				{/* Shown afresh when the text changes elsewhere, unless it is being edited here. */}
				<textarea
					key={editedFrom ?? note.text}
					className="note-panel-text"
					defaultValue={note.text}
					rows={5}
					onFocus={() => setEditedFrom(note.text)}
					onBlur={(e) => {
						setEditedFrom(null);
						// Unchanged, it would undo a change made meanwhile elsewhere.
						if (e.currentTarget.value === editedFrom) return;
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
