// A per-browser preference, never stored in the Project: exported images of
// System design diagrams carry a Legend unless it is turned off here.
const LEGEND_KEY = 'simple-modelisation:export-legend';

export function readIncludeLegend(): boolean {
	try {
		return localStorage.getItem(LEGEND_KEY) !== 'false';
	} catch {
		return true;
	}
}

export function saveIncludeLegend(include: boolean): void {
	try {
		localStorage.setItem(LEGEND_KEY, String(include));
	} catch {
		// Blocked storage: the choice lasts until the page reloads.
	}
}
