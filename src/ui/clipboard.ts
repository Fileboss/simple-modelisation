/**
 * Copies text; false when the browser refuses, as it does outside secure
 * origins (http on a LAN address), where navigator.clipboard is missing.
 */
export async function copyText(text: string): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch {
		return false;
	}
}
