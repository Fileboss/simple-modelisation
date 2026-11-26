import { describe, expect, it } from 'vitest';
import { listing } from './listing';

describe('listing', () => {
	it('shows a listed Project, and remembers it was seen', () => {
		expect(listing(null, 'a', true)).toEqual({ listing: 'listed', seen: 'a' });
	});

	it('tells a Project that left the list while shown from one never listed', () => {
		expect(listing('a', 'a', false).listing).toBe('deleted');
		expect(listing(null, 'a', false).listing).toBe('notFound');
		// Seen before another Project was opened: that one was never listed.
		expect(listing('a', 'b', false).listing).toBe('notFound');
	});
});
