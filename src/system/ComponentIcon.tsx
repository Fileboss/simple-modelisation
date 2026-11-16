import type { ComponentType } from '../document/project';
import type { Skin } from './catalog';

// Line glyphs on a 24×24 box for the generic look of each Component type.
const GLYPHS: Record<ComponentType, string> = {
	client: 'M3 5h18v11H3zM8 20h8M12 16v4',
	service: 'M4 4h16v6H4zM4 14h16v6H4zM7 7h.01M7 17h.01',
	database:
		'M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
	cache: 'M13 2 4 14h7l-1 8 9-12h-7z',
	queue: 'M3 7h4v10H3zM10 7h4v10h-4zM17 7h4v10h-4z',
	gateway: 'M12 3l9 9-9 9-9-9zM8 12h8M13 9l3 3-3 3',
	storage: 'M3 7l9-4 9 4-9 4zM3 7v10l9 4 9-4V7M12 11v10'
};

export function GenericIcon({ type, color }: { type: ComponentType; color: string }) {
	return (
		<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke={color} strokeWidth="1.8">
			<path d={GLYPHS[type]} strokeLinecap="round" strokeLinejoin="round" />
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
