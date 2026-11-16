import { describe, expect, it } from 'vitest';
import {
	initials,
	loadIdentity,
	MAX_NAME_LENGTH,
	PALETTE,
	participantsFrom,
	PRESENCE_FIELD,
	renameIdentity
} from './presence';

const memoryStorage = () => {
	const items = new Map<string, string>();
	return {
		getItem: (key: string) => items.get(key) ?? null,
		setItem: (key: string, value: string) => void items.set(key, value)
	};
};

describe('Identity', () => {
	it('is generated once and reused on the next visit', () => {
		const storage = memoryStorage();
		const first = loadIdentity(storage);
		expect(first.name).toMatch(/^\w+ \w+$/);
		expect(PALETTE).toContain(first.color);
		expect(loadIdentity(storage)).toEqual(first);
	});

	it('still works without storage', () => {
		const blocked = {
			getItem: () => {
				throw new Error('blocked');
			},
			setItem: () => {
				throw new Error('blocked');
			}
		};
		expect(loadIdentity(blocked).name).toBeTruthy();
		expect(loadIdentity(null).name).toBeTruthy();
	});

	it('renames: trimmed, capped, a blank name keeps the current one', () => {
		const me = { name: 'Blue Fox', color: PALETTE[0] };
		expect(renameIdentity(me, '  Ada  ').name).toBe('Ada');
		expect(renameIdentity(me, 'x'.repeat(50)).name).toHaveLength(MAX_NAME_LENGTH);
		expect(renameIdentity(me, '   ')).toBe(me);
	});

	it('gives up to two initials', () => {
		expect(initials('Blue Fox')).toBe('BF');
		expect(initials('ada')).toBe('A');
	});
});

describe('participantsFrom', () => {
	it('caps a name sent by a peer', () => {
		const states = new Map([
			[2, { [PRESENCE_FIELD]: { name: 'x'.repeat(500), color: '#123456' } }]
		]);
		expect(participantsFrom(states, 1)[0].name).toHaveLength(MAX_NAME_LENGTH);
	});

	it('lists the others by name, skipping oneself and incomplete or unsafe states', () => {
		const states = new Map<number, Record<string, unknown>>([
			[1, { [PRESENCE_FIELD]: { name: 'Me', color: '#000000' } }],
			[
				2,
				{
					[PRESENCE_FIELD]: {
						name: 'Zoe',
						color: '#111111',
						diagramId: 'd1',
						cursor: { x: 1, y: 2 }
					}
				}
			],
			[3, { [PRESENCE_FIELD]: { name: 'Ada', color: '#222222', selection: ['n1', 4] } }],
			[4, {}],
			[5, { [PRESENCE_FIELD]: { name: 'No color' } }],
			[6, { [PRESENCE_FIELD]: { name: 'Sneaky', color: 'url(https://example.test/t.png)' } }]
		]);
		expect(participantsFrom(states, 1)).toEqual([
			{
				clientId: 3,
				name: 'Ada',
				color: '#222222',
				diagramId: null,
				cursor: null,
				selection: ['n1']
			},
			{
				clientId: 2,
				name: 'Zoe',
				color: '#111111',
				diagramId: 'd1',
				cursor: { x: 1, y: 2 },
				selection: []
			}
		]);
	});
});
