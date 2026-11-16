import { ViewportPortal } from '@xyflow/react';
import { useRemoteCursors } from './presence-context';

/** The cursors of the other Participants on this Diagram, in canvas coordinates. */
export function RemoteCursors({ diagramId }: { diagramId: string }) {
	const here = useRemoteCursors(diagramId);
	return (
		<ViewportPortal>
			{here.map((p) => (
				<div
					key={p.clientId}
					className="remote-cursor"
					style={{ transform: `translate(${p.cursor!.x}px, ${p.cursor!.y}px)`, color: p.color }}
				>
					<svg width="16" height="20" viewBox="0 0 16 20" aria-hidden="true">
						<path
							d="M1 1 L1 16 L5 12 L8 19 L11 18 L8 11 L14 11 Z"
							fill="currentColor"
							stroke="#fff"
						/>
					</svg>
					<span className="remote-cursor-name" style={{ background: p.color }}>
						{p.name}
					</span>
				</div>
			))}
		</ViewportPortal>
	);
}
