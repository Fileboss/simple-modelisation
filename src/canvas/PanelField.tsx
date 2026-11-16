type Props = {
	label?: string;
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	/** Whether an empty value is accepted (a Connection label) or reverted (a name). */
	allowBlank?: boolean;
};

/** A text field of the properties panel, saved on Enter or when leaving it, only when changed. */
export function PanelField({ label, value, onChange, placeholder, allowBlank = false }: Props) {
	const input = (
		<input
			key={value}
			defaultValue={value}
			placeholder={placeholder}
			onBlur={(e) => {
				const next = e.currentTarget.value.trim();
				if (!next && !allowBlank) e.currentTarget.value = value;
				else if (next !== value) onChange(next);
			}}
			onKeyDown={(e) => {
				if (e.key === 'Enter') e.currentTarget.blur();
			}}
		/>
	);
	if (!label) return input;
	return (
		<label className="panel-field">
			<span>{label}</span>
			{input}
		</label>
	);
}
