import { useState } from 'react';

type Props = {
	value: string;
	onChange: (value: string) => void;
	className?: string;
	/** What shows when not editing, if not the value itself (a UML Attribute line). */
	display?: string;
	/** Controls the editing state from outside (e.g. a Rename button); otherwise double-click starts it. */
	isEditing?: boolean;
	onEditingChange?: (isEditing: boolean) => void;
};

/**
 * Text that turns into an input; Enter or leaving the field saves a changed,
 * non-blank value, Escape cancels.
 */
export function EditableText({ value, onChange, className, display, ...control }: Props) {
	const [isEditingLocally, setEditingLocally] = useState(false);
	const isEditing = control.isEditing ?? isEditingLocally;
	const setEditing = (editing: boolean) => {
		setEditingLocally(editing);
		control.onEditingChange?.(editing);
	};

	if (!isEditing) {
		return (
			<span className={className} data-editable onDoubleClick={() => setEditing(true)}>
				{display ?? value}
			</span>
		);
	}

	return (
		<input
			className={`nodrag inline-input ${className ?? ''}`}
			autoFocus
			defaultValue={value}
			size={Math.max(value.length, 4)}
			onClick={(e) => e.stopPropagation()}
			onBlur={(e) => {
				const next = e.currentTarget.value.trim();
				if (next && next !== value) onChange(next);
				setEditing(false);
			}}
			onKeyDown={(e) => {
				e.stopPropagation();
				if (e.key === 'Enter') e.currentTarget.blur();
				if (e.key === 'Escape') setEditing(false);
			}}
		/>
	);
}
