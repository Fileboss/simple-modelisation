/** How a Participant appears to others: chosen once per browser, renamable. */
export type Identity = { name: string; color: string };

type Point = { x: number; y: number };

/** What a Participant shares while connected; exchanged, never stored in the Project. */
export type PresenceState = Identity & {
	diagramId: string | null;
	/** In canvas coordinates, so it stays on the same element whatever the zoom. */
	cursor: Point | null;
	/** Ids of the selected nodes and edges. */
	selection: string[];
};

export type Participant = PresenceState & { clientId: number };

/** The awareness field holding a Participant's state. */
export const PRESENCE_FIELD = 'presence';

export const MAX_NAME_LENGTH = 32;

// Saturated enough for a cursor, dark enough for white text on an avatar.
export const PALETTE = [
	'#dc2626',
	'#ea580c',
	'#ca8a04',
	'#16a34a',
	'#0d9488',
	'#2563eb',
	'#7c3aed',
	'#c026d3',
	'#db2777',
	'#475569'
];

const ADJECTIVES = [
	'Blue',
	'Swift',
	'Quiet',
	'Bright',
	'Bold',
	'Calm',
	'Clever',
	'Lucky',
	'Brave',
	'Witty'
];
const ANIMALS = [
	'Fox',
	'Otter',
	'Heron',
	'Lynx',
	'Badger',
	'Falcon',
	'Panda',
	'Seal',
	'Wolf',
	'Koala'
];

const STORAGE_KEY = 'simple-modelisation:identity';

const pick = <T>(list: T[], random: () => number): T => list[Math.floor(random() * list.length)];

export function generateIdentity(random: () => number = Math.random): Identity {
	return {
		name: `${pick(ADJECTIVES, random)} ${pick(ANIMALS, random)}`,
		color: pick(PALETTE, random)
	};
}

type IdentityStorage = Pick<Storage, 'getItem' | 'setItem'>;

/** This browser's identity: the stored one, or a new one stored for next time. */
export function loadIdentity(storage: IdentityStorage | null, random?: () => number): Identity {
	try {
		const stored = JSON.parse(storage?.getItem(STORAGE_KEY) ?? 'null') as Partial<Identity> | null;
		if (typeof stored?.name === 'string' && typeof stored.color === 'string' && stored.name) {
			return { name: stored.name, color: stored.color };
		}
	} catch {
		// Unreadable or blocked storage: start over below.
	}
	const identity = generateIdentity(random);
	saveIdentity(storage, identity);
	return identity;
}

export function saveIdentity(storage: IdentityStorage | null, identity: Identity): void {
	try {
		storage?.setItem(STORAGE_KEY, JSON.stringify(identity));
	} catch {
		// Private browsing or blocked storage: the identity lasts for this visit only.
	}
}

/** A new display name, trimmed and capped; a blank one keeps the current name. */
export function renameIdentity(identity: Identity, name: string): Identity {
	const clean = name.trim().slice(0, MAX_NAME_LENGTH);
	return clean ? { ...identity, name: clean } : identity;
}

/** The other Participants from awareness states, by name; incomplete states are skipped. */
export function participantsFrom(
	states: Map<number, Record<string, unknown>>,
	ownClientId: number
): Participant[] {
	const participants: Participant[] = [];
	for (const [clientId, state] of states) {
		if (clientId === ownClientId) continue;
		const presence = state[PRESENCE_FIELD] as Partial<PresenceState> | undefined;
		// Peers send anything: the color goes into styles, so only plain hex colors pass.
		if (typeof presence?.name !== 'string' || !HEX_COLOR.test(presence.color ?? '')) continue;
		participants.push({
			clientId,
			name: presence.name.slice(0, MAX_NAME_LENGTH),
			color: presence.color!,
			diagramId: typeof presence.diagramId === 'string' ? presence.diagramId : null,
			cursor: isPoint(presence.cursor) ? presence.cursor : null,
			selection: Array.isArray(presence.selection) ? presence.selection.filter(isString) : []
		});
	}
	return participants.sort((a, b) => a.name.localeCompare(b.name) || a.clientId - b.clientId);
}

const isString = (value: unknown): value is string => typeof value === 'string';
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

function isPoint(value: unknown): value is Point {
	const point = value as Partial<Point> | null;
	return Number.isFinite(point?.x) && Number.isFinite(point?.y);
}

/** Up to two initials for an avatar. */
export function initials(name: string): string {
	return name
		.split(/\s+/)
		.filter(Boolean)
		.map((word) => word[0].toUpperCase())
		.join('')
		.slice(0, 2);
}
