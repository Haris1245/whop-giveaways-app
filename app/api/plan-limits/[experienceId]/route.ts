import { whopSdk } from "@/lib/whop-sdk";
import {
	getPlanLimits,
	plans,
	type PlanType,
} from "@/lib/plans";
import {
	countActiveGiveawaysForExperience,
	getCompanyPlanType,
} from "@/lib/plan-access";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
	_request: NextRequest,
	context: { params: Promise<{ experienceId: string }> },
) {
	try {
		const { experienceId } = await context.params;

		if (!experienceId) {
			return NextResponse.json({ error: "Missing experienceId" }, { status: 400 });
		}

		const experience = await whopSdk.experiences.getExperience({ experienceId });
		if (!experience?.company?.id) {
			return NextResponse.json(
				{ error: "Experience not found or missing companyId" },
				{ status: 404 },
			);
		}

		const companyId = experience.company.id;
		const planType: PlanType = await getCompanyPlanType(companyId);
		const limits = getPlanLimits(planType);
		const activeGiveawayCount = await countActiveGiveawaysForExperience(experienceId);

		return NextResponse.json({
			planType,
			maxMembersPerGiveaway: limits.maxMembersPerGiveaway,
			maxConcurrentActiveGiveaways: limits.maxConcurrentActiveGiveaways,
			securityFeatures: limits.securityFeatures,
			activeGiveawayCount,
			proPriceMonthly: plans.pro.priceMonthly,
			proPlanId: plans.pro.planId,
		});
	} catch (error) {
		console.error("Error fetching plan limits:", error);
		return NextResponse.json(
			{ error: "Failed to fetch plan limits" },
			{ status: 500 },
		);
	}
}
