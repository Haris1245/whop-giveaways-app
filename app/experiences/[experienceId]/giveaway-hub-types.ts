export const NONE_PASS_VALUE = "__none__";

export type AccessPassOption = {
	id: string;
	title: string;
	route: string;
	verified: boolean;
};

export type GiveawayRow = {
	id: string;
	experienceId: string;
	title: string;
	description: string;
	coverImageUrl: string | null;
	rewardText: string | null;
	requiredPassId?: string | null;
	/** Resolved from Whop when listing giveaways; may be null if unavailable. */
	requiredPassTitle?: string | null;
	status: "active" | "drawing" | "completed" | "cancelled";
	endTime: string;
	createdAt: string;
	enforceIpChecks?: boolean;
	enforceAccountAge?: boolean;
	minAccountAgeDays?: number | null;
	entrantCount?: number;
	entered?: boolean;
	/** True when the current user won this completed giveaway. */
	isWinner?: boolean;
};
