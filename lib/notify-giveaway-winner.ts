import { whopSdk } from "@/lib/whop-sdk";

function isWhopSdkError(
	value: unknown,
): value is { _error: Error | unknown } {
	return (
		typeof value === "object" &&
		value !== null &&
		"_error" in value &&
		Boolean((value as { _error?: unknown })._error)
	);
}

function getAgentUserId(): string | null {
	const id = process.env.NEXT_PUBLIC_WHOP_AGENT_USER_ID?.trim();
	return id || null;
}

async function sendDirectMessage(input: {
	companyId: string;
	toUserIdOrUsername: string;
	message: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
	const agentUserId = getAgentUserId();
	if (!agentUserId) {
		return { ok: false, error: "agent_user_not_configured" };
	}

	if (input.toUserIdOrUsername === agentUserId) {
		return { ok: true };
	}

	try {
		const result = await whopSdk
			.withCompany(input.companyId)
			.messages.sendDirectMessageToUser({
				toUserIdOrUsername: input.toUserIdOrUsername,
				message: input.message,
			});

		if (isWhopSdkError(result)) {
			const err = result._error;
			const msg = err instanceof Error ? err.message : "Whop API error";
			return { ok: false, error: msg };
		}

		return { ok: true };
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : "Failed to send DM";
		return { ok: false, error: msg };
	}
}

async function listCompanyAdminUserIds(companyId: string): Promise<string[]> {
	try {
		const company = await whopSdk
			.withCompany(companyId)
			.companies.listAuthorizedUsers({ companyId });

		if (!company || isWhopSdkError(company)) return [];

		const agentUserId = getAgentUserId();
		const ids = new Set<string>();
		for (const user of company.authorizedUsers ?? []) {
			if (!user.userId) continue;
			if (agentUserId && user.userId === agentUserId) continue;
			ids.add(user.userId);
		}
		return [...ids];
	} catch (e: unknown) {
		console.error("[notify-giveaway-winner] listAuthorizedUsers failed", e);
		return [];
	}
}

async function winnerDisplayLabel(winnerUserId: string): Promise<string> {
	try {
		const profile = await whopSdk.users.getUser({ userId: winnerUserId });
		if (profile && !isWhopSdkError(profile)) {
			const username = profile.username?.trim();
			if (username) return `@${username.replace(/^@/, "")}`;
			const name = profile.name?.trim();
			if (name) return name;
		}
	} catch {
		// fall through to user id
	}
	return winnerUserId;
}

export function buildGiveawayWinnerMessage(input: {
	title: string;
	rewardText?: string | null;
}): string {
	const title = input.title.trim() || "the giveaway";
	const prize = input.rewardText?.trim();
	const lines = [
		"Congratulations — you won!",
		"",
		`You were selected as the winner of "${title}".`,
	];
	if (prize) {
		lines.push("", `Prize: ${prize}`);
	}
	lines.push("", "The creator may follow up with next steps. Reply here if you have questions.");
	return lines.join("\n");
}

export function buildGiveawayAdminDrawnMessage(input: {
	title: string;
	rewardText?: string | null;
	winnerLabel: string | null;
	entrantCount: number;
}): string {
	const title = input.title.trim() || "Your giveaway";
	const lines = [`"${title}" has ended.`];

	if (input.winnerLabel) {
		lines.push("", `Winner: ${input.winnerLabel}`);
		if (input.entrantCount > 0) {
			lines.push(
				`Picked at random from ${input.entrantCount.toLocaleString()} entrant${input.entrantCount === 1 ? "" : "s"}.`,
			);
		}
	} else {
		lines.push("", "No winner was drawn — there were no entrants.");
	}

	const prize = input.rewardText?.trim();
	if (prize) {
		lines.push("", `Prize: ${prize}`);
	}

	lines.push("", "Open your giveaways app to view entrants and message the winner.");
	return lines.join("\n");
}

export type NotifyGiveawayCompletedResult = {
	winnerNotified: boolean;
	adminsNotified: number;
	errors: string[];
};

/** DMs the winner (if any) and all company authorized users when a giveaway is drawn. */
export async function notifyGiveawayCompleted(input: {
	companyId: string;
	title: string;
	rewardText?: string | null;
	winnerUserId: string | null;
	entrantCount: number;
}): Promise<NotifyGiveawayCompletedResult> {
	const errors: string[] = [];
	let winnerNotified = false;
	let adminsNotified = 0;

	if (!getAgentUserId()) {
		console.warn(
			"[notify-giveaway-winner] NEXT_PUBLIC_WHOP_AGENT_USER_ID is not set; skipping DMs",
		);
		return { winnerNotified: false, adminsNotified: 0, errors: ["agent_user_not_configured"] };
	}

	if (input.winnerUserId) {
		const winnerResult = await sendDirectMessage({
			companyId: input.companyId,
			toUserIdOrUsername: input.winnerUserId,
			message: buildGiveawayWinnerMessage({
				title: input.title,
				rewardText: input.rewardText,
			}),
		});
		winnerNotified = winnerResult.ok;
		if (!winnerResult.ok) {
			errors.push(`winner: ${winnerResult.error}`);
			console.error("[notify-giveaway-winner] winner DM failed:", winnerResult.error);
		}
	}

	const winnerLabel = input.winnerUserId
		? await winnerDisplayLabel(input.winnerUserId)
		: null;
	const adminMessage = buildGiveawayAdminDrawnMessage({
		title: input.title,
		rewardText: input.rewardText,
		winnerLabel,
		entrantCount: input.entrantCount,
	});

	const adminUserIds = await listCompanyAdminUserIds(input.companyId);
	for (const adminUserId of adminUserIds) {
		const adminResult = await sendDirectMessage({
			companyId: input.companyId,
			toUserIdOrUsername: adminUserId,
			message: adminMessage,
		});
		if (adminResult.ok) {
			adminsNotified += 1;
		} else {
			errors.push(`admin ${adminUserId}: ${adminResult.error}`);
			console.warn(
				`[notify-giveaway-winner] admin DM failed for ${adminUserId}:`,
				adminResult.error,
			);
		}
	}

	if (adminUserIds.length === 0) {
		console.warn(
			`[notify-giveaway-winner] No authorized users found for company ${input.companyId}`,
		);
	}

	return { winnerNotified, adminsNotified, errors };
}

/** @deprecated Use notifyGiveawayCompleted */
export async function notifyGiveawayWinner(input: {
	winnerUserId: string;
	companyId: string;
	title: string;
	rewardText?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
	const result = await notifyGiveawayCompleted({
		companyId: input.companyId,
		title: input.title,
		rewardText: input.rewardText,
		winnerUserId: input.winnerUserId,
		entrantCount: 1,
	});
	if (result.errors.length > 0 && !result.winnerNotified) {
		return { ok: false, error: result.errors[0] ?? "notify_failed" };
	}
	return { ok: true };
}
