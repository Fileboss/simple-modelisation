import type { AreaNode, DiagramNode } from './project.ts';

/** The Areas in the order they are drawn: the bigger first, under the smaller. */
export function areasInOrder(nodes: DiagramNode[]): AreaNode[] {
	const size = (area: AreaNode) => area.width * area.height;
	return nodes
		.filter((n): n is AreaNode => n.type === 'area')
		.sort((a, b) => size(b) - size(a) || (a.id < b.id ? -1 : 1));
}

/** The nodes that are part of the model drawn: all but the Areas behind it. */
export const withoutAreas = (nodes: DiagramNode[]) => nodes.filter((n) => n.type !== 'area');
