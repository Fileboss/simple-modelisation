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

	it('lists a Local copy of a Shared Project with its name and creation date', () => {
		const registry = new ProjectRegistry();
		const shared = registry.create('Shop', 1);
		registry.setShared(shared.id, true);
		const copy = registry.addLocalCopy(shared.id, 'copy', 5);
		expect(copy).toEqual({ id: 'copy', name: 'Shop', createdAt: 1, updatedAt: 5, shared: false });
		expect(registry.get(shared.id)?.shared).toBe(true);
	});
});
