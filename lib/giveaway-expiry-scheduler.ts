import { expireAllPastDueGiveaways } from "@/lib/expire-giveaways";

const INTERVAL_MS = 60_000;

type GlobalWithExpiry = typeof globalThis & {
	__giveawayExpiryInterval?: ReturnType<typeof setInterval>;
};

async function tick(): Promise<void> {
	try {
		const result = await expireAllPastDueGiveaways();
		if (result.expiredCount > 0) {
			console.log(
				`[giveaway-expiry] ended ${result.expiredCount} giveaway(s): ${result.expiredIds.join(", ")}`,
			);
		}
	} catch (e) {
		console.error("[giveaway-expiry] tick failed:", e);
	}
}

/** Starts a once-per-minute loop that ends past-due giveaways. Idempotent per process. */
export function startGiveawayExpiryScheduler(): void {
	const g = globalThis as GlobalWithExpiry;
	if (g.__giveawayExpiryInterval) return;

	void tick();
	g.__giveawayExpiryInterval = setInterval(() => void tick(), INTERVAL_MS);
	console.log("[giveaway-expiry] background scheduler started (every 60s)");
}
