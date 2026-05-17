import { db, formatDbError } from "@/db";
import { entrantTable, giveawayTable } from "@/db/schema";
import { notifyGiveawayCompleted } from "@/lib/notify-giveaway-winner";
import { and, eq, lte } from "drizzle-orm";
import { randomInt } from "node:crypto";

export type ExpireGiveawaysResult = {
	expiredCount: number;
	expiredIds: string[];
};

async function completeGiveaway(id: string, now: Date): Promise<boolean> {
	const locked = await db
		.update(giveawayTable)
		.set({ status: "drawing", updatedAt: now })
		.where(and(eq(giveawayTable.id, id), eq(giveawayTable.status, "active")))
		.returning({ id: giveawayTable.id });

	if (locked.length === 0) return false;

	const [giveaway] = await db
		.select({
			title: giveawayTable.title,
			rewardText: giveawayTable.rewardText,
			companyId: giveawayTable.companyId,
		})
		.from(giveawayTable)
		.where(eq(giveawayTable.id, id))
		.limit(1);

	if (!giveaway) return false;

	const entrants = await db
		.select({ userId: entrantTable.userId })
		.from(entrantTable)
		.where(eq(entrantTable.giveawayId, id));

	const picked =
		entrants.length > 0 ? entrants[randomInt(entrants.length)]! : null;

	await db
		.update(giveawayTable)
		.set({
			status: "completed",
			winnerUserId: picked?.userId ?? null,
			winnerPickedAt: picked ? now : null,
			updatedAt: now,
		})
		.where(eq(giveawayTable.id, id));

	const notify = await notifyGiveawayCompleted({
		companyId: giveaway.companyId,
		title: giveaway.title,
		rewardText: giveaway.rewardText,
		winnerUserId: picked?.userId ?? null,
		entrantCount: entrants.length,
	});
	if (notify.errors.length > 0) {
		console.warn(
			`[expire-giveaways] Giveaway ${id} drawn; notification issues:`,
			notify.errors.join("; "),
		);
	}

	return true;
}

async function expirePastDueIds(
	ids: string[],
	now: Date,
): Promise<ExpireGiveawaysResult> {
	const expiredIds: string[] = [];
	for (const id of ids) {
		try {
			const completed = await completeGiveaway(id, now);
			if (completed) expiredIds.push(id);
		} catch (e) {
			console.error(
				`[expire-giveaways] failed to complete giveaway ${id}:`,
				formatDbError(e),
			);
		}
	}
	return { expiredCount: expiredIds.length, expiredIds };
}

/** Ends all past-due active giveaways (used by the background worker). */
export async function expireAllPastDueGiveaways(): Promise<ExpireGiveawaysResult> {
	const now = new Date();

	const pastDue = await db
		.select({ id: giveawayTable.id })
		.from(giveawayTable)
		.where(
			and(eq(giveawayTable.status, "active"), lte(giveawayTable.endTime, now)),
		);

	return expirePastDueIds(
		pastDue.map((row) => row.id),
		now,
	);
}

/**
 * Ends active giveaways whose end time has passed: picks a random winner (if any)
 * and sets status to completed.
 */
export async function expirePastDueGiveaways(
	experienceId: string,
	options?: { giveawayId?: string },
): Promise<ExpireGiveawaysResult> {
	const now = new Date();

	const conditions = [
		eq(giveawayTable.experienceId, experienceId),
		eq(giveawayTable.status, "active"),
		lte(giveawayTable.endTime, now),
	];

	if (options?.giveawayId) {
		conditions.push(eq(giveawayTable.id, options.giveawayId));
	}

	const pastDue = await db
		.select({ id: giveawayTable.id })
		.from(giveawayTable)
		.where(and(...conditions));

	return expirePastDueIds(
		pastDue.map((row) => row.id),
		now,
	);
}

/** Best-effort expiry for request handlers; logs and never throws. */
export async function syncPastDueGiveaways(
	experienceId: string,
	options?: { giveawayId?: string },
): Promise<void> {
	try {
		const result = await expirePastDueGiveaways(experienceId, options);
		if (result.expiredCount > 0) {
			console.log(
				`[expire-giveaways] synced ${result.expiredCount} giveaway(s) for ${experienceId}: ${result.expiredIds.join(", ")}`,
			);
		}
	} catch (e) {
		console.error(
			`[expire-giveaways] sync failed for ${experienceId}:`,
			formatDbError(e),
		);
	}
}
