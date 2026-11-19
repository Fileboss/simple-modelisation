import type { InternalNode } from '@xyflow/react';
import type { Box } from '@simple-modelisation/model/geometry.ts';

export * from '@simple-modelisation/model/geometry.ts';

/** The box React Flow draws a node in. */
export function boxOf(node: InternalNode): Box {
	const { x, y } = node.internals.positionAbsolute;
	return { x, y, width: node.measured.width ?? 0, height: node.measured.height ?? 0 };
}
