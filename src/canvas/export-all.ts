import type { Diagram, DiagramNode, ProjectDocument } from '@simple-modelisation/model/project.ts';

/**
 * Every Diagram of the Project with something in it, drawn as an SVG file by
 * `draw` from its nodes, in a .zip, each named after its Diagram (twins
 * numbered). Null when there is nothing to draw. The zip library loads on demand.
 */
export async function allDiagramsZip(
	project: ProjectDocument,
	draw: (diagram: Diagram, nodes: DiagramNode[]) => string
): Promise<Blob | null> {
	const drawn = project
		.diagrams()
		.map((diagram) => ({ diagram, nodes: project.nodes(diagram.id) }))
		.filter(({ nodes }) => nodes.length > 0);
	if (drawn.length === 0) return null;
	const { zipSync, strToU8 } = await import('fflate');
	const files: Record<string, Uint8Array> = {};
	for (const { diagram, nodes } of drawn) {
		const base = fileName(diagram.name);
		let name = `${base}.svg`;
		for (let n = 2; name in files; n++) name = `${base} (${n}).svg`;
		files[name] = strToU8(draw(diagram, nodes));
	}
	return new Blob([zipSync(files) as BlobPart], { type: 'application/zip' });
}

/** A Diagram name as a file name: no path separators or characters systems refuse. */
export const fileName = (name: string) => name.replace(/[\\/:*?"<>|]/g, '-').trim() || 'Diagram';
