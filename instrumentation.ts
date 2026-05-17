export async function register() {
	if (process.env.NEXT_RUNTIME === "edge") return;
	const { startGiveawayExpiryScheduler } = await import(
		"@/lib/giveaway-expiry-scheduler"
	);
	startGiveawayExpiryScheduler();
}
