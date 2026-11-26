import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { ProjectDocument } from '@simple-modelisation/model/project.ts';
import { ProjectRegistry } from '../document/registry';
import {
	announceReplaced,
	joinTabs,
	subscribeReplaced,
	type TabChannel,
	type TabMessage
} from './tab-channel';

/**
 * Tabs of one browser in memory: what a tab posts reaches the others, in order,
 * never itself, and copied as BroadcastChannel does. `flush` delivers.
 */
function browser() {
	const tabs: Array<Set<(message: TabMessage) => void>> = [];
	const queue: Array<{ from: number; message: TabMessage }> = [];
	const tab = (): TabChannel => {
		const index = tabs.push(new Set()) - 1;
		return {
			post: (message) => queue.push({ from: index, message: structuredClone(message) }),
			subscribe: (listener) => {
				tabs[index].add(listener);
				return () => tabs[index].delete(listener);
			}
		};
	};
	const flush = () => {
		while (queue.length > 0) {
			const { from, message } = queue.shift()!;
			tabs.forEach((listeners, index) => {
				if (index !== from) for (const listener of [...listeners]) listener(message);
			});
		}
	};
	return { tab, flush };
}

const projectIn = (doc: Y.Doc) => new ProjectDocument(doc);

describe('joinTabs', () => {
	it('passes edits between two tabs, both ways', () => {
		const { tab, flush } = browser();
		const a = new Y.Doc();
		const b = new Y.Doc();
		joinTabs('p', a, tab());
		joinTabs('p', b, tab());
		flush();

		projectIn(a).addDiagram('system', 'Back end');
		flush();
		expect(
			projectIn(b)
				.diagrams()
				.map((d) => d.name)
		).toEqual(['Back end']);

		projectIn(b).rename('Shop');
		flush();
		expect(projectIn(a).name()).toBe('Shop');
	});

	it('gives a joining tab what the others hold, and takes what it holds', () => {
		const { tab, flush } = browser();
		const a = new Y.Doc();
		projectIn(a).addDiagram('system', 'Back end');
		joinTabs('p', a, tab());
		flush();

		// b loaded from storage something a never saw.
		const b = new Y.Doc();
		projectIn(b).addDiagram('mcd', 'Orders');
		joinTabs('p', b, tab());
		flush();

		const names = (doc: Y.Doc) =>
			projectIn(doc)
				.diagrams()
				.map((d) => d.name)
				.sort();
		expect(names(a)).toEqual(['Back end', 'Orders']);
		expect(names(b)).toEqual(['Back end', 'Orders']);
	});

	it('leaves edits from other tabs out of undo', () => {
		const { tab, flush } = browser();
		const a = new Y.Doc();
		const b = new Y.Doc();
		joinTabs('p', a, tab());
		joinTabs('p', b, tab());
		const inA = projectIn(a);
		const inB = projectIn(b);
		inA.addDiagram('system', 'Mine');
		flush();
		inB.addDiagram('mcd', 'Theirs');
		flush();

		inA.undo();
		flush();
		expect(inB.diagrams().map((d) => d.name)).toEqual(['Theirs']);
	});

	it('ignores other documents, and stops both ways once left', () => {
		const { tab, flush } = browser();
		const a = new Y.Doc();
		const b = new Y.Doc();
		const other = new Y.Doc();
		const leave = joinTabs('p', a, tab());
		const tabB = tab();
		joinTabs('p', b, tabB);
		joinTabs('q', other, tabB);
		flush();

		projectIn(a).rename('Shop');
		flush();
		expect(projectIn(other).name()).toBe('');

		leave();
		projectIn(a).rename('Mine');
		projectIn(b).rename('Theirs');
		flush();
		expect(projectIn(a).name()).toBe('Mine');
		expect(projectIn(b).name()).toBe('Theirs');
	});

	it('keeps the Project list in step: a Project deleted in one tab is gone in the other', () => {
		const { tab, flush } = browser();
		const a = new ProjectRegistry();
		const b = new ProjectRegistry();
		joinTabs('projects', a.doc, tab());
		joinTabs('projects', b.doc, tab());
		const project = a.create('Shop');
		flush();
		expect(b.get(project.id)?.name).toBe('Shop');

		a.remove(project.id);
		flush();
		b.touch(project.id);
		flush();
		expect(a.get(project.id)).toBeUndefined();
		expect(b.get(project.id)).toBeUndefined();
	});

	it('does nothing without a channel', () => {
		const doc = new Y.Doc();
		const leave = joinTabs('p', doc, null);
		projectIn(doc).rename('Shop');
		leave();
		expect(projectIn(doc).name()).toBe('Shop');
	});
});

describe('announceReplaced', () => {
	it('tells the other tabs which Local copy replaces a Project', () => {
		const { tab, flush } = browser();
		const a = tab();
		const b = tab();
		const copies: string[] = [];
		subscribeReplaced('shared', (copyId) => copies.push(copyId), b);
		subscribeReplaced('other', () => copies.push('wrong'), b);
		announceReplaced('shared', 'copy', a);
		flush();
		expect(copies).toEqual(['copy']);
	});
});
