import { notFound } from "next/navigation";
import {
	pickWhopDevUserTokenFromRecord,
	withWhopDevUserTokenQuery,
} from "@/lib/append-whop-dev-user-token";
import { verifyUser } from "@/lib/authentication";
import { loadGiveawayDetail } from "@/lib/load-giveaway-detail";
import { GiveawayDetailClient } from "./giveaway-detail-client";

export default async function GiveawayDetailPage({
	params,
	searchParams,
}: {
	params: Promise<{ experienceId: string; giveawayId: string }>;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	const { experienceId, giveawayId } = await params;
	const search = await searchParams;

	if (
		!experienceId ||
		typeof experienceId !== "string" ||
		experienceId.includes("[object Object]")
	) {
		notFound();
	}

	const { userId, accessLevel } = await verifyUser(experienceId, undefined, search);
	const giveaway = await loadGiveawayDetail(experienceId, giveawayId, userId);
	if (!giveaway) notFound();

	const whopDevUserToken = pickWhopDevUserTokenFromRecord(search);
	const hubHref = withWhopDevUserTokenQuery(
		`/experiences/${experienceId}`,
		whopDevUserToken,
	);
	const entrantsHref =
		accessLevel === "admin"
			? withWhopDevUserTokenQuery(
					`/experiences/${experienceId}/giveaways/${giveawayId}/entrants`,
					whopDevUserToken,
				)
			: null;

	return (
		<GiveawayDetailClient
			experienceId={experienceId}
			giveaway={giveaway}
			access={accessLevel}
			hubHref={hubHref}
			entrantsHref={entrantsHref}
		/>
	);
}
