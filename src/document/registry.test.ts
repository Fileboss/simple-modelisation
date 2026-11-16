import { describe, expect, it } from 'vitest';
import { DEFAULT_PROJECT_NAME, ProjectRegistry } from './registry';

describe('ProjectRegistry', () => {
	it('creates, renames and removes Projects, most recently updated first', () => {
		const registry = new ProjectRegistry();
		const shop = registry.create('Shop', 1);
		const blog = registry.create('Blog', 2);
		expect(registry.list().map((p) => p.name)).toEqual(['Blog', 'Shop']);

		registry.rename(shop.id, '  Webshop ', 3);
		expect(registry.list().map((p) => p.name)).toEqual(['Webshop', 'Blog']);

		registry.remove(blog.id);
		expect(registry.list().map((p) => p.id)).toEqual([shop.id]);
	});

	it('falls back to the default name for a blank one', () => {
		const registry = new ProjectRegistry();
		const project = registry.create('   ');
		expect(project.name).toBe(DEFAULT_PROJECT_NAME);
	});
});
