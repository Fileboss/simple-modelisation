import type { ReactNode } from 'react';
import { strings } from './strings';

type Props = {
	title: string;
	onClose: () => void;
	/** Rises higher than the default 60 % of the screen (the SQL). */
	tall?: boolean;
	children: ReactNode;
};

/** A panel rising from the bottom of a small screen, over the canvas. */
export function Drawer({ title, onClose, tall, children }: Props) {
	return (
		<section className={`drawer ${tall ? 'drawer-tall' : ''}`} aria-label={title}>
			<header className="drawer-bar">
				<h2>{title}</h2>
				<button className="drawer-close" aria-label={strings.drawer.close} onClick={onClose}>
					×
				</button>
			</header>
			<div className="drawer-body">{children}</div>
		</section>
	);
}
