/** One button of a ChoiceRow: its value, its name, and a color for its text when not current. */
export type RowChoice<T extends string> = { value: T; label: string; color?: string };

type Props<T extends string> = {
	/** What the row is for, for screen readers (Kind, Flow). */
	label: string;
	/** The first button, which clears the choice (Not specified). */
	unset: string;
	choices: RowChoice<T>[];
	current: T | undefined;
	onChoose: (value: T | null) => void;
};

/** A short choice as a row of text buttons; the first one, or the current one again, clears it. */
export function ChoiceRow<T extends string>({
	label,
	unset,
	choices,
	current,
	onChoose
}: Props<T>) {
	return (
		<div className="choice-row" role="group" aria-label={label}>
			{[{ value: null, label: unset }, ...choices].map((choice) => {
				const isCurrent = (current ?? null) === choice.value;
				const color = 'color' in choice && !isCurrent ? choice.color : undefined;
				return (
					<button
						key={choice.value ?? 'none'}
						className={isCurrent ? 'choice-row-current' : ''}
						style={color ? { color } : undefined}
						aria-pressed={isCurrent}
						onClick={() => onChoose(isCurrent ? null : choice.value)}
					>
						{choice.label}
					</button>
				);
			})}
		</div>
	);
}
