import { createContext, use } from 'react';
import type { ProjectDocument } from '@simple-modelisation/model/project.ts';

export type CanvasContextValue = { project: ProjectDocument; diagramId: string };

export const CanvasContext = createContext<CanvasContextValue | null>(null);

/** The Project and Diagram a node, edge or panel belongs to. */
export function useCanvas(): CanvasContextValue {
	const value = use(CanvasContext);
	if (!value) throw new Error('useCanvas needs a DiagramCanvas');
	return value;
}
