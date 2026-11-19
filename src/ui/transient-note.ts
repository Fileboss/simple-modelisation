import { useCallback, useEffect, useState } from 'react';

/**
 * A short message that clears itself after `ms`: `show` restarts the wait each
 * time, even with the same text, so a repeated failure is seen as long as the first.
 */
export function useTransientNote(ms = 3000): [string | null, (text: string) => void] {
	const [shown, setShown] = useState<{ text: string } | null>(null);
	useEffect(() => {
		if (!shown) return;
		const timer = setTimeout(() => setShown(null), ms);
		return () => clearTimeout(timer);
	}, [shown, ms]);
	// A new object each time: the effect runs again even for the same text.
	const show = useCallback((text: string) => setShown({ text }), []);
	return [shown?.text ?? null, show];
}
