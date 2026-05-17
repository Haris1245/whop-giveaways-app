"use server";

import { verifyUser } from "@/lib/authentication";
import { whopSdk } from "@/lib/whop-sdk";

export async function createSubscription(
	experienceId: string,
	planId: string,
	whopDevUserToken?: string | null,
) {
	const searchParams =
		whopDevUserToken?.trim() ?
			{ "whop-dev-user-token": whopDevUserToken.trim() }
		:	null;

	await verifyUser(experienceId, "admin", searchParams);

	const checkoutSession = await whopSdk.payments.createCheckoutSession({
		planId,
		metadata: {
			experienceId,
		},
	});

	return checkoutSession;
}