import { useId, useState, type ReactNode } from 'react';
import { strings } from './strings';

type Props = {
	title: string;
	level?: 2 | 3;
	/** What the "i" button shows and hides under the heading. */
	children: ReactNode;
};

/** A heading of the palette or the properties panel whose explanations stay hidden until asked for. */
export function HelpHeading({ title, level = 2, children }: Props) {
	const [isOpen, setOpen] = useState(false);
	const id = useId();
	const Heading = level === 2 ? 'h2' : 'h3';
	const label = strings.help(title);
	return (
		<>
			<div className="help-heading">
				<Heading>{title}</Heading>
				<button
					className="help-button"
					aria-expanded={isOpen}
					aria-controls={id}
					aria-label={label}
					title={label}
					onClick={() => setOpen(!isOpen)}
				>
					i
				</button>
			</div>
			<div id={id} className="help-text" hidden={!isOpen}>
				{children}
			</div>
		</>
	);
}
