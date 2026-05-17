import { db } from "@/db";
import { entrantTable, giveawayTable } from "@/db/schema";
import { notifyGiveawayCompleted } from "@/lib/notify-giveaway-winner";
import { and, eq, lte } from "drizzle-orm";
import { randomInt } from "node:crypto";

export type ExpireGiveawaysResult = {
	expiredCount: number;
	expiredIds: string[];
};

async function completeGiveaway(id: string, now: Date): Promise<void> {
	const [giveaway] = await db
		.select({
			title: giveawayTable.title,
			rewardText: giveawayTable.rewardText,
			companyId: giveawayTable.companyId,
		})
		.from(giveawayTable)
		.where(eq(giveawayTable.id, id))
		.limit(1);

	if (!giveaway) return;

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

	const expiredIds: string[] = [];
	for (const { id } of pastDue) {
		await completeGiveaway(id, now);
		expiredIds.push(id);
	}

	return { expiredCount: expiredIds.length, expiredIds };
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

	const expiredIds: string[] = [];
	for (const { id } of pastDue) {
		await completeGiveaway(id, now);
		expiredIds.push(id);
	}

	return { expiredCount: expiredIds.length, expiredIds };
}
