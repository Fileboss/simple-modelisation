/** Whether a key event goes to a field the user types in: shortcuts leave those alone. */
export function isTypingTarget(target: EventTarget | null): boolean {
	const element = target as HTMLElement | null;
	if (!element?.closest) return false;
	return (
		element.isContentEditable ||
		Boolean(element.closest('input, textarea, select, [contenteditable], [role="textbox"]'))
	);
}
