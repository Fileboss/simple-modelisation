import type { ComponentType } from '@simple-modelisation/model/project.ts';
import { TYPE_LOOKS } from '@simple-modelisation/model/looks.ts';
import type { Skin } from './catalog';

/** A line glyph on a 24×24 box, stroked in `color`. */
export function LineGlyph({
	path,
	color,
	size = 28,
	label
}: {
	path: string;
	color: string;
	size?: number;
	label?: string;
}) {
	return (
		<svg
			viewBox="0 0 24 24"
			width={size}
			height={size}
			fill="none"
			stroke={color}
			strokeWidth="1.8"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-label={label}
			aria-hidden={label ? undefined : true}
		>
			<path d={path} />
		</svg>
	);
}

export function GenericIcon({ type, color }: { type: ComponentType; color: string }) {
	return <LineGlyph path={TYPE_LOOKS[type].glyph} color={color} />;
}

/** A product's logo or line glyph, or its initials on its color when Simple Icons has no logo for it. */
export function SkinLogo({ skin, size = 28 }: { skin: Skin; size?: number }) {
	if (skin.glyph) {
		return <LineGlyph path={skin.glyph} color={skin.color} size={size} label={skin.name} />;
	}
	if (skin.logo) {
		return (
			<svg viewBox="0 0 24 24" width={size} height={size} fill={skin.color} aria-label={skin.name}>
				<path d={skin.logo} />
			</svg>
		);
	}
	const initials = skin.name
		.split(/\s+/)
		.map((word) => word[0])
		.join('')
		.slice(0, 2);
	return (
		<span
			className="skin-initials"
			style={{ background: skin.color, width: size, height: size, fontSize: size * 0.42 }}
			aria-label={skin.name}
		>
			{initials}
		</span>
	);
}
