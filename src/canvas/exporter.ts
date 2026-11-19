import type { ImageFormat } from './export-image';

/** How to draw the image: with a Legend or without (kinds without one ignore it). */
export type ExportOptions = { legend: boolean };

/** Exports the Diagram as an image; false when there is nothing to export. */
type Exporter = (format: ImageFormat, options: ExportOptions) => Promise<boolean>;

// The open Diagram's canvas registers how to export it, so the header can reach it.
let current: Exporter | null = null;

export function registerExporter(exporter: Exporter): () => void {
	current = exporter;
	return () => {
		if (current === exporter) current = null;
	};
}

/** Exports the open Diagram; false when none is open or it is empty. */
export async function exportOpenDiagram(
	format: ImageFormat,
	options: ExportOptions
): Promise<boolean> {
	return current ? current(format, options) : false;
}
