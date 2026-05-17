import { pickWhopDevUserTokenFromRecord } from "@/lib/append-whop-dev-user-token";
import { verifyUser } from "@/lib/authentication";
import { whopSdk } from "@/lib/whop-sdk";
import { resolveWhopUserTokenForVerification } from "@/lib/whop-user-token";
import { headers } from "next/headers";
import { Text } from "frosted-ui";
import BillingPageClient from "./billing-page-client";

export default async function BillingPage({
	params,
	searchParams,
}: {
	params: Promise<{ experienceId: string }>;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	const headersList = await headers();
	const { experienceId } = await params;
	const search = await searchParams;

	try {
		await whopSdk.verifyUserToken(
			resolveWhopUserTokenForVerification(headersList, search),
		);
	} catch {
		return (
			<div className="flex min-h-screen items-center justify-center bg-gray-900 px-6">
				<div className="max-w-md text-center">
					<Text size="4" className="text-gray-200">
						Sign in through Whop to manage billing.
					</Text>
					{process.env.NODE_ENV === "development" ? (
						<Text size="2" color="gray" className="mt-3 leading-relaxed">
							In local dev, open this app inside the whop.com iframe with the dev
							proxy enabled so your user token is forwarded.
						</Text>
					) : null}
				</div>
			</div>
		);
	}

	try {
		await verifyUser(experienceId, "admin", search);
	} catch {
		return (
			<div className="flex min-h-screen items-center justify-center bg-gray-900 px-6">
				<Text size="4" className="text-center text-gray-300">
					You need admin access to this experience to manage billing.
				</Text>
			</div>
		);
	}

	return (
		<BillingPageClient
			experienceId={experienceId}
			whopDevUserToken={pickWhopDevUserTokenFromRecord(search)}
		/>
	);
}
