import type { ProviderLook } from './provider-catalog';

/** A Provider's mark on its color, in a round badge of `size` px. */
export function ProviderIcon({ look, size = 18 }: { look: ProviderLook; size?: number }) {
	const { mark } = look;
	return (
		<span
			className="badge-icon"
			style={{ background: look.color, width: size, height: size }}
			aria-hidden="true"
		>
			{mark.kind === 'logo' ? (
				<svg viewBox="0 0 24 24" width={size * 0.6} height={size * 0.6} fill="#fff">
					<path d={mark.path} />
				</svg>
			) : mark.kind === 'line' ? (
				<svg
					viewBox="0 0 24 24"
					width={size * 0.62}
					height={size * 0.62}
					fill="none"
					stroke="#fff"
					strokeWidth="2.2"
					strokeLinecap="round"
					strokeLinejoin="round"
				>
					<path d={mark.path} />
				</svg>
			) : (
				// Stretched over most of the badge, so that even three letters stay legible at 18px.
				<svg viewBox="0 0 24 24" width={size} height={size}>
					<text
						x="12"
						y="12"
						dominantBaseline="central"
						textAnchor="middle"
						textLength={mark.text.length > 2 ? 19 : 15}
						lengthAdjust="spacingAndGlyphs"
						fontSize={mark.text.length > 2 ? 11 : 12}
						fontWeight="800"
						fill={mark.ink}
					>
						{mark.text}
					</text>
				</svg>
			)}
		</span>
	);
}
