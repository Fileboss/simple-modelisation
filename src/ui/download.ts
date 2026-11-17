/** Saves `content` as a file named `fileName` through the browser's download. */
export function downloadText(fileName: string, content: string, type: string): void {
	downloadBlob(fileName, new Blob([content], { type }));
}

/** Saves a Blob as a file named `fileName` through the browser's download. */
export function downloadBlob(fileName: string, blob: Blob): void {
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = fileName;
	document.body.append(link);
	link.click();
	link.remove();
	// Some browsers start the download after click() returns: revoke later.
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}
