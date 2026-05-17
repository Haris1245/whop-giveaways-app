import "server-only";

import { db } from "@/db";
import { entrantTable, giveawayTable } from "@/db/schema";
import { whopSdk } from "@/lib/whop-sdk";
import type { GiveawayRow } from "@/app/experiences/[experienceId]/giveaway-hub-types";
import { and, count, eq } from "drizzle-orm";

export async function loadGiveawayDetail(
	experienceId: string,
	giveawayId: string,
	userId: string,
): Promise<(GiveawayRow & { requiredPassTitle: string | null }) | null> {
	const rows = await db
		.select()
		.from(giveawayTable)
		.where(
			and(
				eq(giveawayTable.id, giveawayId),
				eq(giveawayTable.experienceId, experienceId),
			),
		)
		.limit(1);

	const row = rows[0];
	if (!row) return null;

	const [{ n }] = await db
		.select({ n: count() })
		.from(entrantTable)
		.where(eq(entrantTable.giveawayId, giveawayId));

	const enteredRows = await db
		.select({ id: entrantTable.id })
		.from(entrantTable)
		.where(
			and(
				eq(entrantTable.giveawayId, giveawayId),
				eq(entrantTable.userId, userId),
			),
		)
		.limit(1);

	let requiredPassTitle: string | null = null;
	if (row.requiredPassId) {
		try {
			const experience = await whopSdk.experiences.listAccessPassesForExperience({
				experienceId,
			});
			for (const p of experience?.accessPasses ?? []) {
				if (p.id === row.requiredPassId) {
					requiredPassTitle =
						typeof p.title === "string" && p.title.trim() !== ""
							? p.title.trim()
							: null;
					break;
				}
			}
		} catch {
			// Optional UI enrichment.
		}
	}

	return {
		id: row.id,
		experienceId: row.experienceId,
		title: row.title,
		description: row.description,
		coverImageUrl: row.coverImageUrl,
		rewardText: row.rewardText,
		requiredPassId: row.requiredPassId,
		requiredPassTitle,
		status: row.status,
		endTime: row.endTime.toISOString(),
		createdAt: row.createdAt.toISOString(),
		enforceIpChecks: row.enforceIpChecks,
		enforceAccountAge: row.enforceAccountAge,
		minAccountAgeDays: row.minAccountAgeDays,
		entrantCount: Number(n ?? 0),
		entered: enteredRows.length > 0,
		isWinner:
			row.status === "completed" &&
			row.winnerUserId != null &&
			row.winnerUserId === userId,
	};
}
