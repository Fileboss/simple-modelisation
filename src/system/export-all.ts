import type { ProjectDocument } from '@simple-modelisation/model/project.ts';
import { systemSvg } from '@simple-modelisation/model/svg/system.ts';
import { measureInPage } from './label-placement';
import { SVG_NAMES } from './system-kind';

/**
 * Every System design diagram of the Project as an SVG file in a .zip, named
 * after the Diagram (twins numbered); MCDs are not drawn yet and come back in
 * `skipped`. Each SVG has a Legend unless `legend` is false. Null when there is nothing to draw. The zip library loads on demand.
 */
export async function allDiagramsZip(
	project: ProjectDocument,
	{ legend }: { legend: boolean }
): Promise<{ zip: Blob; skipped: string[] } | null> {
	const diagrams = project.diagrams();
	const drawn = diagrams.filter((d) => d.kind === 'system');
	if (drawn.length === 0) return null;
	const { zipSync, strToU8 } = await import('fflate');
	const files: Record<string, Uint8Array> = {};
	for (const diagram of drawn) {
		const base = fileName(diagram.name);
		let name = `${base}.svg`;
		for (let n = 2; name in files; n++) name = `${base} (${n}).svg`;
		const svg = systemSvg(project.nodes(diagram.id), project.edges(diagram.id), {
			names: SVG_NAMES,
			measure: measureInPage,
			legend
		});
		files[name] = strToU8(svg);
	}
	return {
		zip: new Blob([zipSync(files) as BlobPart], { type: 'application/zip' }),
		skipped: diagrams.filter((d) => d.kind === 'mcd').map((d) => d.name)
	};
}

/** A Diagram name as a file name: no path separators or characters systems refuse. */
export const fileName = (name: string) => name.replace(/[\\/:*?"<>|]/g, '-').trim() || 'Diagram';
