import { createContext, use, useEffect, useReducer } from 'react';
import type { ProjectRegistry, ProjectSummary } from '../document/registry';

export const RegistryContext = createContext<ProjectRegistry | null>(null);

export function useRegistry(): ProjectRegistry {
	const registry = use(RegistryContext);
	if (!registry) throw new Error('useRegistry needs a RegistryProvider');
	return registry;
}

/** The Project list, re-rendering on every change. */
export function useProjects(): ProjectSummary[] {
	const registry = useRegistry();
	const [, rerender] = useReducer((n: number) => n + 1, 0);
	useEffect(() => registry.subscribe(rerender), [registry]);
	return registry.list();
}
