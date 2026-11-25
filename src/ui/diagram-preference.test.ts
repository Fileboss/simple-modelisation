import { afterEach, describe, expect, it, vi } from 'vitest';
import { diagramPreference } from './diagram-preference';

describe('diagramPreference', () => {
	afterEach(() => vi.unstubAllGlobals());

	const storage = (stored: Record<string, string> = {}) => {
		vi.stubGlobal('localStorage', {
			getItem: (key: string) => stored[key] ?? null,
			setItem: (key: string, value: string) => (stored[key] = value)
		});
		return stored;
	};

	it('keeps a choice per Diagram, the first value until one is made', () => {
		const stored = storage();
		const { get, set } = diagramPreference('types', ['hidden', 'shown']);
		set('a', 'shown');
		expect([get('a'), get('b')]).toEqual(['shown', 'hidden']);
		expect(stored).toEqual({ 'simple-modelisation:types:a': 'shown' });
	});

	it('reads a value it does not know as the first one', () => {
		storage({ 'simple-modelisation:notation:a': 'chen' });
		expect(diagramPreference('notation', ['merise', 'uml']).get('a')).toBe('merise');
	});

	it('remembers the choice until reload when storage is blocked', () => {
		vi.stubGlobal('localStorage', {
			getItem: () => {
				throw new Error('blocked');
			},
			setItem: () => {
				throw new Error('blocked');
			}
		});
		const { get, set } = diagramPreference('types', ['hidden', 'shown']);
		set('a', 'shown');
		expect(get('a')).toBe('shown');
	});
});
