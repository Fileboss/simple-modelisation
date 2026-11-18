/** Beyond this many choices, the unfolded grid gets a search field. */
export const SEARCH_FROM = 8;

/** Lower case, without accents: "Café" and "cafe" match. */
const folded = (text: string) =>
	text
		.normalize('NFD')
		.replace(/\p{Diacritic}/gu, '')
		.toLowerCase();

/**
 * The choices a grid shows: folded, the recommended ones and the current one
 * (so the choice made always shows); unfolded, all of them matching `query`.
 * The catalog's order is kept.
 */
export function visibleChoices<T extends { id: string; label: string }>(
	choices: T[],
	recommended: readonly string[],
	current: string | null | undefined,
	expanded: boolean,
	query = ''
): T[] {
	if (!expanded) return choices.filter((c) => recommended.includes(c.id) || c.id === current);
	const wanted = folded(query.trim());
	return wanted ? choices.filter((c) => folded(c.label).includes(wanted)) : choices;
}
