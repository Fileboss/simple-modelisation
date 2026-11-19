import type { ComponentType } from '@simple-modelisation/model/project.ts';
import { TYPE_LOOKS } from '@simple-modelisation/model/looks.ts';
import type { Skin } from './catalog';

export function GenericIcon({ type, color }: { type: ComponentType; color: string }) {
	return (
		<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke={color} strokeWidth="1.8">
			<path d={TYPE_LOOKS[type].glyph} strokeLinecap="round" strokeLinejoin="round" />
		</svg>
	);
}

/** A product's logo, or its initials on its color when Simple Icons has no logo for it. */
export function SkinLogo({ skin, size = 28 }: { skin: Skin; size?: number }) {
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
