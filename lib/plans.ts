export type PlanType = "free" | "pro";

export const plans = {
	pro: {
		passId: "prod_uupeFhjx4EABm",
		planId: "plan_SXJjzpqD2tpoB",
		priceMonthly: 11.99,
	},
} as const;

export const planLimits = {
	free: {
		maxMembersPerGiveaway: 25,
		maxConcurrentActiveGiveaways: 1,
		securityFeatures: false,
	},
	pro: {
		maxMembersPerGiveaway: null as number | null,
		maxConcurrentActiveGiveaways: null as number | null,
		securityFeatures: true,
	},
} satisfies Record<
	PlanType,
	{
		maxMembersPerGiveaway: number | null;
		maxConcurrentActiveGiveaways: number | null;
		securityFeatures: boolean;
	}
>;

export function getPlanFromPassId(passId: string): PlanType {
	if (passId === plans.pro.passId) return "pro";
	return "free";
}

export function getPlanLimits(planType: PlanType) {
	return planLimits[planType];
}

/** Strip security flags when the plan does not include them. */
export function normalizeSecurityForPlan(
	planType: PlanType,
	enforceIpChecks: boolean,
	enforceAccountAge: boolean,
	minAccountAgeDays: number,
) {
	if (!planLimits[planType].securityFeatures) {
		return {
			enforceIpChecks: false,
			enforceAccountAge: false,
			minAccountAgeDays: 0,
		};
	}
	return {
		enforceIpChecks,
		enforceAccountAge,
		minAccountAgeDays: enforceAccountAge ? minAccountAgeDays : 0,
	};
}
