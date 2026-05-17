import { whopSdk } from "@/lib/whop-sdk";
import { resolveWhopUserTokenForVerification } from "@/lib/whop-user-token";
import { headers } from "next/headers";
import { cache } from "react";

export const verifyUser = cache(
	async (
		experienceId: string,
		level?: "admin",
		searchParams?: URLSearchParams | Record<
			string,
			string | string[] | undefined
		> | null,
	) => {
		// Validate experienceId is a proper string
		if (!experienceId || typeof experienceId !== 'string' || experienceId === '[object Object]') {
			throw new Error("Invalid experience ID provided");
		}

		const headersList = await headers();
		const tokenInput = resolveWhopUserTokenForVerification(
			headersList,
			searchParams,
		);
		const { userId } = await whopSdk.verifyUserToken(tokenInput);

		const { accessLevel } =
			await whopSdk.access.checkIfUserHasAccessToExperience({
				userId,
				experienceId,
			});

		if (level && accessLevel !== level) {
			throw new Error("User must be an admin to access this page");
		}
		if (accessLevel === "no_access") {
			throw new Error("User does not have access to experience");
		}

		return { userId, accessLevel };
	},
);