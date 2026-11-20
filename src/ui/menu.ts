import { useEffect, type RefObject } from 'react';

/** Closes a `<details>` menu on a pointer down outside it or on Escape. */
export function useMenuDismiss(menu: RefObject<HTMLDetailsElement | null>) {
	useEffect(() => {
		const close = (e: Event) => {
			const details = menu.current;
			if (!details?.open) return;
			if (e instanceof KeyboardEvent ? e.key === 'Escape' : !details.contains(e.target as Node))
				details.open = false;
		};
		document.addEventListener('pointerdown', close);
		document.addEventListener('keydown', close);
		return () => {
			document.removeEventListener('pointerdown', close);
			document.removeEventListener('keydown', close);
		};
	}, [menu]);
}
