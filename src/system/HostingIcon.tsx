import type { HostingLook } from './hosting-catalog';

/** A Hosting's icon in white on its color, in a round badge of `size` px. */
export function HostingIcon({ look, size = 18 }: { look: HostingLook; size?: number }) {
	const glyph = size * 0.62;
	return (
		<span
			className="badge-icon"
			style={{ background: look.color, width: size, height: size }}
			aria-hidden="true"
		>
			<svg
				viewBox="0 0 24 24"
				width={glyph}
				height={glyph}
				fill={look.icon.kind === 'logo' ? '#fff' : 'none'}
				stroke={look.icon.kind === 'line' ? '#fff' : 'none'}
				strokeWidth="2.2"
				strokeLinecap="round"
				strokeLinejoin="round"
			>
				<path d={look.icon.path} />
			</svg>
		</span>
	);
}
