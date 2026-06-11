export type GiveawayRow = {
	id: string;
	experienceId: string;
	title: string;
	description: string;
	coverImageUrl: string | null;
	rewardText: string | null;
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
