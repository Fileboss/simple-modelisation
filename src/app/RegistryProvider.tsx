import { useEffect, useState, type ReactNode } from 'react';
import type { ProjectRegistry } from '../document/registry';
import { openRegistry } from '../storage/persistence';
import { strings } from '../ui/strings';
import { RegistryContext } from './registry-context';

export function RegistryProvider({ children }: { children: ReactNode }) {
	const [registry, setRegistry] = useState<ProjectRegistry | null>(null);

	useEffect(() => {
		let close: (() => void) | undefined;
		let cancelled = false;
		void openRegistry().then((opened) => {
			if (cancelled) return opened.close();
			close = opened.close;
			setRegistry(opened.registry);
		});
		return () => {
			cancelled = true;
			close?.();
		};
	}, []);

	if (!registry) return <p className="status">{strings.loading}</p>;
	return <RegistryContext value={registry}>{children}</RegistryContext>;
}
