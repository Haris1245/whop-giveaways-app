function normalizeMessage(error: unknown): string {
	if (typeof error === "string") return error.trim();
	if (error instanceof Error) return error.message.trim();
	return String(error).trim();
}

/** User closed checkout — no error UI needed. */
export function isPurchaseCanceledMessage(error: unknown): boolean {
	const message = normalizeMessage(error).toLowerCase();
	if (!message) return false;
	return (
		message.includes("purchase was canceled") ||
		message.includes("purchase was cancelled") ||
		message.includes("canceled by the user") ||
		message.includes("cancelled by the user")
	);
}

/** Returns null when the user canceled checkout; otherwise a display message. */
export function formatCheckoutError(
	error: unknown,
	fallback = "Could not complete checkout.",
): string | null {
	const message = normalizeMessage(error);
	if (!message || isPurchaseCanceledMessage(message)) return null;
	return message;
}
