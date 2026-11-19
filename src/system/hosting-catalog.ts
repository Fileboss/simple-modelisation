import { HOSTINGS, type Hosting } from '@simple-modelisation/model/project.ts';
import { HOSTING_MARKS, type HostingMark } from '@simple-modelisation/model/looks.ts';
import { strings } from '../ui/strings';

/** How a Hosting looks: a brand logo (filled) or a line glyph, on 24×24, on its color. */
export type HostingLook = HostingMark & { hosting: Hosting; label: string };

/** Every Hosting with its look, from the most concrete to the most abstract. */
export const HOSTING_LOOKS: HostingLook[] = HOSTINGS.map((hosting) => ({
	hosting,
	label: strings.hosting.names[hosting],
	...HOSTING_MARKS[hosting]
}));

const BY_HOSTING = new Map(HOSTING_LOOKS.map((look) => [look.hosting, look]));

export const hostingLook = (hosting: Hosting | null | undefined) =>
	hosting ? BY_HOSTING.get(hosting) : undefined;
