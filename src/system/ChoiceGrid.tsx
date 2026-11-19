import { useState, type ReactNode } from 'react';
import { strings } from '../ui/strings';
import { groupedChoices, SEARCH_FROM, visibleChoices } from './choice-grid';

export type Choice = {
	id: string;
	label: string;
	icon: ReactNode;
	/** Its section's heading (Frameworks, Products); a grid without groups has no headings. */
	group?: string;
};

type Props = {
	/** The first tile, which clears the choice (Generic, Not specified). */
	none: Omit<Choice, 'id'>;
	choices: Choice[];
	recommended: readonly string[];
	current: string | null | undefined;
	onChoose: (id: string | null) => void;
};

/**
 * A grid of logo tiles: the recommended choices first, the rest behind "Show
 * all", with a search field when the full list is long, under their sections'
 * headings when they have some. The first tile, or the current one again,
 * clears the choice.
 */
export function ChoiceGrid({ none, choices, recommended, current, onChoose }: Props) {
	const [expanded, setExpanded] = useState(false);
	const [query, setQuery] = useState('');
	const shown = visibleChoices(choices, recommended, current, expanded, query);
	// Unfolded, the toggle stays so it can fold again, whatever gets picked meanwhile.
	const folds =
		expanded || visibleChoices(choices, recommended, current, false).length < choices.length;
	const sections = groupedChoices(shown);
	const noneTile = (
		<button
			className={`skin ${current ? '' : 'skin-current'}`}
			aria-pressed={!current}
			onClick={() => onChoose(null)}
		>
			{none.icon}
			{none.label}
		</button>
	);
	const tile = (choice: Choice) => {
		const isCurrent = choice.id === current;
		return (
			<button
				key={choice.id}
				className={`skin ${isCurrent ? 'skin-current' : ''}`}
				title={isCurrent ? strings.hosting.clear : undefined}
				aria-pressed={isCurrent}
				onClick={() => onChoose(isCurrent ? null : choice.id)}
			>
				{choice.icon}
				{choice.label}
			</button>
		);
	};
	const grouped = choices.some((c) => c.group);

	return (
		<>
			{expanded && choices.length > SEARCH_FROM && (
				<input
					className="choice-search"
					type="search"
					placeholder={strings.choices.search}
					aria-label={strings.choices.search}
					value={query}
					onChange={(e) => setQuery(e.target.value)}
				/>
			)}
			{grouped ? (
				<>
					{/* Clearing belongs to no section: it comes first, on its own. */}
					<div className="skin-grid">{noneTile}</div>
					{sections.map(({ group, choices: section }) => (
						<section key={group ?? ''} aria-label={group}>
							{group && <h4 className="choice-group">{group}</h4>}
							<div className="skin-grid">{section.map(tile)}</div>
						</section>
					))}
				</>
			) : (
				<div className="skin-grid">
					{noneTile}
					{shown.map(tile)}
				</div>
			)}
			{query && shown.length === 0 && <p className="panel-hint">{strings.choices.noMatch}</p>}
			{folds && (
				<button
					className="choice-more"
					onClick={() => {
						setExpanded(!expanded);
						setQuery('');
					}}
				>
					{expanded ? strings.choices.showLess : strings.choices.showAll(choices.length)}
				</button>
			)}
		</>
	);
}
