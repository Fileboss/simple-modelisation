type Props<C extends string> = {
	title: string;
	colors: readonly C[];
	current: C;
	names: Record<C, string>;
	look: (color: C) => { background: string; borderColor: string };
	onPick: (color: C) => void;
};

/** A panel's color choice (a Note's paper, an Area's fill): one swatch per color. */
export function ColorSwatches<C extends string>(props: Props<C>) {
	const { title, colors, current, names, look, onPick } = props;
	return (
		<>
			<h3>{title}</h3>
			<div className="color-swatches" role="radiogroup" aria-label={title}>
				{colors.map((color) => (
					<button
						key={color}
						role="radio"
						aria-checked={color === current}
						aria-label={names[color]}
						title={names[color]}
						className={`color-swatch ${color === current ? 'color-swatch-current' : ''}`}
						style={look(color)}
						onClick={() => onPick(color)}
					/>
				))}
			</div>
		</>
	);
}
