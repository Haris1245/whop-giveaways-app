import { db, formatDbError } from "@/db";
import { entrantTable, giveawayTable } from "@/db/schema";
import { notifyGiveawayCompleted } from "@/lib/notify-giveaway-winner";
import { and, eq, inArray, sql } from "drizzle-orm";
import { randomInt } from "node:crypto";

export type ExpireGiveawaysResult = {
	expiredCount: number;
	expiredIds: string[];
	skippedCount: number;
};

export type ExpireDiagnostics = {
	serverNow: string;
	candidates: Array<{
		id: string;
		status: string;
		endTime: string;
		experienceId: string;
		isPastDue: boolean;
	}>;
};

const EXPIRABLE_STATUSES = ["active", "drawing"] as const;

/** Compare end_time using Postgres clock (avoids JS/DB timezone drift). */
function pastDueCondition() {
	return and(
		inArray(giveawayTable.status, [...EXPIRABLE_STATUSES]),
		sql`${giveawayTable.endTime} <= NOW()`,
	);
}

async function completeGiveaway(id: string, now: Date): Promise<boolean> {
	const [giveaway] = await db
		.select({
			title: giveawayTable.title,
			rewardText: giveawayTable.rewardText,
			companyId: giveawayTable.companyId,
		})
		.from(giveawayTable)
		.where(
			and(
				eq(giveawayTable.id, id),
				inArray(giveawayTable.status, [...EXPIRABLE_STATUSES]),
				sql`${giveawayTable.endTime} <= NOW()`,
			),
		)
		.limit(1);

	if (!giveaway) return false;

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

	void notifyGiveawayCompleted({
		companyId: giveaway.companyId,
		title: giveaway.title,
		rewardText: giveaway.rewardText,
		winnerUserId: picked?.userId ?? null,
		entrantCount: entrants.length,
	}).then((notify) => {
		if (notify.errors.length > 0) {
			console.warn(
				`[expire-giveaways] Giveaway ${id} drawn; notification issues:`,
				notify.errors.join("; "),
			);
		}
	});

	return true;
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

export async function getExpireDiagnostics(): Promise<ExpireDiagnostics> {
	const rows = await db
		.select({
			id: giveawayTable.id,
			status: giveawayTable.status,
			endTime: giveawayTable.endTime,
			experienceId: giveawayTable.experienceId,
			isPastDue: sql<boolean>`(${giveawayTable.endTime} <= NOW())`.as(
				"is_past_due",
			),
		})
		.from(giveawayTable)
		.where(inArray(giveawayTable.status, [...EXPIRABLE_STATUSES]))
		.limit(25);

	return {
		serverNow: new Date().toISOString(),
		candidates: rows.map((r) => ({
			id: r.id,
			status: r.status,
			endTime: r.endTime.toISOString(),
			experienceId: r.experienceId,
			isPastDue: Boolean(r.isPastDue),
		})),
	};
}

export async function logExpireDiagnostics(): Promise<void> {
	try {
		const diag = await getExpireDiagnostics();
		const pastDue = diag.candidates.filter((c) => c.isPastDue);
		if (pastDue.length === 0) {
			if (diag.candidates.length === 0) {
				console.log("[expire-giveaways] no active/drawing giveaways in DB");
			} else {
				console.log(
					`[expire-giveaways] tick: 0 past-due (${diag.candidates.length} active/drawing still open). serverNow=${diag.serverNow}`,
				);
				for (const c of diag.candidates.slice(0, 5)) {
					console.log(
						`  - ${c.id.slice(0, 8)}… status=${c.status} end=${c.endTime}`,
					);
				}
			}
			return;
		}
		console.log(
			`[expire-giveaways] tick: ${pastDue.length} should expire but were not completed:`,
			pastDue.map((c) => `${c.id.slice(0, 8)}…(end ${c.endTime})`).join(", "),
		);
	} catch (e) {
		console.error("[expire-giveaways] diagnostics failed:", formatDbError(e));
	}
}

/** Ends all past-due active/drawing giveaways (background worker / cron). */
export async function expireAllPastDueGiveaways(): Promise<ExpireGiveawaysResult> {
	const now = new Date();

	const pastDue = await db
		.select({
			id: giveawayTable.id,
			status: giveawayTable.status,
			endTime: giveawayTable.endTime,
		})
		.from(giveawayTable)
		.where(pastDueCondition());

	if (pastDue.length > 0) {
		console.log(
			`[expire-giveaways] found ${pastDue.length} past-due: ${pastDue
				.map((r) => `${r.id.slice(0, 8)}…(${r.status}, end ${r.endTime.toISOString()})`)
				.join(", ")}`,
		);
	}

	const result = await expirePastDueIds(
		pastDue.map((row) => row.id),
		now,
	);

	if (result.expiredCount === 0 && pastDue.length > 0) {
		console.warn(
			`[expire-giveaways] ${pastDue.length} past-due listed but 0 completed (${result.skippedCount} skipped)`,
		);
	}

	return result;
}

export async function expirePastDueGiveaways(
	experienceId: string,
	options?: { giveawayId?: string },
): Promise<ExpireGiveawaysResult> {
	const now = new Date();

	const conditions = [eq(giveawayTable.experienceId, experienceId), pastDueCondition()];

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
