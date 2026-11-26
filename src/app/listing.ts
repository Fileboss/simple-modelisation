/**
 * Whether the Project page shows its Project, or why not: `deleted` when it
 * left the list while the page showed it (deleted in another tab), `notFound`
 * when it was never listed here.
 */
export type Listing = 'listed' | 'deleted' | 'notFound';

/**
 * The Listing of `projectId`, given the Project the page last saw listed
 * (`seen`); returns what it has now seen.
 */
export function listing(
	seen: string | null,
	projectId: string,
	listed: boolean
): { listing: Listing; seen: string | null } {
	if (listed) return { listing: 'listed', seen: projectId };
	return { listing: seen === projectId ? 'deleted' : 'notFound', seen };
}
