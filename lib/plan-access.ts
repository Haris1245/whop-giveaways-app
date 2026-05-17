import { db } from "@/db";
import { giveawayTable, subscriptionTable } from "@/db/schema";
import { getPlanFromPassId, type PlanType } from "@/lib/plans";
import { and, count, eq, sql } from "drizzle-orm";

const activeSubscriptionStatuses = sql`${subscriptionTable.status} IN ('active', 'trialing', 'completed', 'past_due')`;

export async function getCompanyPlanType(companyId: string): Promise<PlanType> {
	const subscription = await db
		.select({ passId: subscriptionTable.passId })
		.from(subscriptionTable)
		.where(and(eq(subscriptionTable.companyId, companyId), activeSubscriptionStatuses))
		.limit(1);

	if (subscription.length > 0) {
		return getPlanFromPassId(subscription[0].passId);
	}
	return "free";
}

export async function countActiveGiveawaysForExperience(experienceId: string): Promise<number> {
	const [row] = await db
		.select({ n: count() })
		.from(giveawayTable)
		.where(
			and(eq(giveawayTable.experienceId, experienceId), eq(giveawayTable.status, "active")),
		);
	return Number(row?.n ?? 0);
}
