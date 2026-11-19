import { describe, expect, it } from 'vitest';
import { groupedChoices, visibleChoices } from './choice-grid';

const choices = ['Node.js', 'Spring Boot', 'Go', 'Bun', 'Python', 'Rust', 'Café'].map((label) => ({
	id: label.toLowerCase(),
	label
}));
const labels = (list: { label: string }[]) => list.map((c) => c.label);

describe('visibleChoices', () => {
	it('shows the recommended choices and the current one when folded, in the catalog order', () => {
		expect(labels(visibleChoices(choices, ['go', 'node.js'], null, false))).toEqual([
			'Node.js',
			'Go'
		]);
		expect(labels(visibleChoices(choices, ['go', 'node.js'], 'rust', false))).toEqual([
			'Node.js',
			'Go',
			'Rust'
		]);
	});

	it('shows every choice unfolded, filtered by name ignoring case and accents', () => {
		expect(visibleChoices(choices, ['go'], null, true)).toHaveLength(choices.length);
		expect(labels(visibleChoices(choices, ['go'], null, true, '  PYT '))).toEqual(['Python']);
		expect(labels(visibleChoices(choices, ['go'], null, true, 'cafe'))).toEqual(['Café']);
		expect(visibleChoices(choices, ['go'], null, true, 'cobol')).toEqual([]);
	});
});

describe('groupedChoices', () => {
	it('cuts choices into their sections, in the order they first appear', () => {
		const list = [
			{ id: 'next', group: 'Frameworks' },
			{ id: 'caddy', group: 'Products' },
			{ id: 'nest', group: 'Frameworks' }
		];
		expect(groupedChoices(list).map((s) => [s.group, s.choices.map((c) => c.id)])).toEqual([
			['Frameworks', ['next', 'nest']],
			['Products', ['caddy']]
		]);
		const plain: { id: string; group?: string }[] = [{ id: 'a' }, { id: 'b' }];
		expect(groupedChoices(plain)).toEqual([{ group: undefined, choices: plain }]);
	});
});
