import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Awareness } from '../storage/sync';
import { loadIdentity, renameIdentity, saveIdentity, type Identity } from './presence';
import { PresenceContext, reportPresence, restorePresence } from './presence-context';

const storage = (): Storage | null => {
	try {
		return window.localStorage;
	} catch {
		return null;
	}
};

/** Gives this browser's identity and shares it with the other Participants of the open Project. */
export function PresenceProvider({
	awareness,
	children
}: {
	awareness: Awareness | null;
	children: ReactNode;
}) {
	const [identity, setIdentity] = useState<Identity>(() => loadIdentity(storage()));

	useEffect(() => {
		reportPresence(awareness, identity);
	}, [awareness, identity]);

	// Coming back from the back/forward cache: the provider cleared this Participant's state.
	useEffect(() => {
		const restore = () => restorePresence(awareness);
		window.addEventListener('pageshow', restore);
		return () => window.removeEventListener('pageshow', restore);
	}, [awareness]);

	const value = useMemo(
		() => ({
			awareness,
			identity,
			rename: (name: string) => {
				const next = renameIdentity(identity, name);
				saveIdentity(storage(), next);
				setIdentity(next);
			}
		}),
		[awareness, identity]
	);

	return <PresenceContext value={value}>{children}</PresenceContext>;
}
