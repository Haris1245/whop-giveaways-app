import { db, formatDbError } from "@/db";
import { entrantTable, giveawayTable } from "@/db/schema";
import { notifyGiveawayCompleted } from "@/lib/notify-giveaway-winner";
import { and, eq, inArray, lte } from "drizzle-orm";
import { randomInt } from "node:crypto";

export type ExpireGiveawaysResult = {
	expiredCount: number;
	expiredIds: string[];
	skippedCount: number;
};

const EXPIRABLE_STATUSES = ["active", "drawing"] as const;

async function completeGiveaway(id: string, now: Date): Promise<boolean> {
	const [giveaway] = await db
		.select({
			title: giveawayTable.title,
			rewardText: giveawayTable.rewardText,
			companyId: giveawayTable.companyId,
			status: giveawayTable.status,
			endTime: giveawayTable.endTime,
		})
		.from(giveawayTable)
		.where(eq(giveawayTable.id, id))
		.limit(1);

	if (!giveaway) return false;
	if (
		!EXPIRABLE_STATUSES.includes(
			giveaway.status as (typeof EXPIRABLE_STATUSES)[number],
		)
	) {
		return false;
	}
	if (giveaway.endTime > now) return false;

	const entrants = await db
		.select({ userId: entrantTable.userId })
		.from(entrantTable)
		.where(eq(entrantTable.giveawayId, id));

	const picked =
		entrants.length > 0 ? entrants[randomInt(entrants.length)]! : null;

	const [updated] = await db
		.update(giveawayTable)
		.set({
			status: "completed",
			winnerUserId: picked?.userId ?? null,
			winnerPickedAt: picked ? now : null,
			updatedAt: now,
		})
		.where(
			and(
				eq(giveawayTable.id, id),
				inArray(giveawayTable.status, [...EXPIRABLE_STATUSES]),
			),
		)
		.returning({ id: giveawayTable.id });

	if (!updated) return false;

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

function pastDueCondition(now: Date) {
	return and(
		inArray(giveawayTable.status, [...EXPIRABLE_STATUSES]),
		lte(giveawayTable.endTime, now),
	);
}

async function expirePastDueIds(
	ids: string[],
	now: Date,
): Promise<ExpireGiveawaysResult> {
	const expiredIds: string[] = [];
	let skippedCount = 0;
	for (const id of ids) {
		try {
			const completed = await completeGiveaway(id, now);
			if (completed) expiredIds.push(id);
			else skippedCount += 1;
		} catch (e) {
			skippedCount += 1;
			console.error(
				`[expire-giveaways] failed to complete giveaway ${id}:`,
				formatDbError(e),
			);
		}
	}
	return { expiredCount: expiredIds.length, expiredIds, skippedCount };
}

/** Ends all past-due active/drawing giveaways (background worker / cron). */
export async function expireAllPastDueGiveaways(): Promise<ExpireGiveawaysResult> {
	const now = new Date();

	const pastDue = await db
		.select({ id: giveawayTable.id, status: giveawayTable.status })
		.from(giveawayTable)
		.where(pastDueCondition(now));

	if (pastDue.length > 0) {
		console.log(
			`[expire-giveaways] found ${pastDue.length} past-due giveaway(s): ${pastDue.map((r) => `${r.id}(${r.status})`).join(", ")}`,
		);
	}

	return expirePastDueIds(
		pastDue.map((row) => row.id),
		now,
	);
}

/**
 * Ends active/drawing giveaways whose end time has passed: picks a random winner (if any)
 * and sets status to completed.
 */
export async function expirePastDueGiveaways(
	experienceId: string,
	options?: { giveawayId?: string },
): Promise<ExpireGiveawaysResult> {
	const now = new Date();

	const conditions = [eq(giveawayTable.experienceId, experienceId), pastDueCondition(now)];

	if (options?.giveawayId) {
		conditions.push(eq(giveawayTable.id, options.giveawayId));
	}

	const pastDue = await db
		.select({ id: giveawayTable.id, status: giveawayTable.status })
		.from(giveawayTable)
		.where(and(...conditions));

	if (pastDue.length > 0) {
		console.log(
			`[expire-giveaways] experience ${experienceId}: ${pastDue.length} past-due — ${pastDue.map((r) => `${r.id}(${r.status})`).join(", ")}`,
		);
	}

	return expirePastDueIds(
		pastDue.map((row) => row.id),
		now,
	);
}

/** Best-effort expiry for request handlers; logs and never throws. */
export async function syncPastDueGiveaways(
	experienceId: string,
	options?: { giveawayId?: string },
): Promise<ExpireGiveawaysResult | null> {
	try {
		const result = await expirePastDueGiveaways(experienceId, options);
		if (result.expiredCount > 0) {
			console.log(
				`[expire-giveaways] synced ${result.expiredCount} giveaway(s) for ${experienceId}: ${result.expiredIds.join(", ")}`,
			);
		}
		return result;
	} catch (e) {
		console.error(
			`[expire-giveaways] sync failed for ${experienceId}:`,
			formatDbError(e),
		);
		return null;
	}
}
