import { useRef, useState } from 'react';

type Props = {
	value: string;
	onChange: (value: string) => void;
	className?: string;
	/** Whether an empty value is saved (an Area's label) or ignored (a name). */
	allowBlank?: boolean;
	/** What shows when not editing, if not the value itself (a UML Attribute line). */
	display?: string;
	/** Controls the editing state from outside (e.g. a Rename button); otherwise double-click starts it. */
	isEditing?: boolean;
	onEditingChange?: (isEditing: boolean) => void;
};

/**
 * Text that turns into an input; Enter or leaving the field saves a changed
 * value (not a blank one, unless allowed), Escape cancels.
 */
export function EditableText({
	value,
	onChange,
	className,
	display,
	allowBlank = false,
	...control
}: Props) {
	const [isEditingLocally, setEditingLocally] = useState(false);
	// What the edit started from: left unchanged, it saves nothing, or it would undo a change
	// a peer or an agent made meanwhile.
	const started = useRef('');
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
			onFocus={(e) => (started.current = e.currentTarget.value)}
			onBlur={(e) => {
				const next = e.currentTarget.value.trim();
				if ((next || allowBlank) && next !== started.current && next !== value) onChange(next);
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
