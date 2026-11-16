/** Saves `content` as a file named `fileName` through the browser's download. */
export function downloadText(fileName: string, content: string, type: string): void {
	const url = URL.createObjectURL(new Blob([content], { type }));
	const link = document.createElement('a');
	link.href = url;
	link.download = fileName;
	document.body.append(link);
	link.click();
	link.remove();
	// Some browsers start the download after click() returns: revoke later.
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}
