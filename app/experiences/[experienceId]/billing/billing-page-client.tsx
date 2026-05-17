"use client";

import { BackLink } from "@/components/back-link";
import { withWhopDevUserTokenQuery } from "@/lib/append-whop-dev-user-token";
import BillingForm from "./billing-form";

export default function BillingPageClient({
	experienceId,
	whopDevUserToken,
}: {
	experienceId: string;
	whopDevUserToken?: string | null;
}) {
	const hubHref = withWhopDevUserTokenQuery(
		`/experiences/${experienceId}`,
		whopDevUserToken,
	);

	return (
		<div className="min-h-screen bg-gray-900 p-4 text-gray-100 md:p-8">
			<BackLink href={hubHref} label="Back to giveaways" />

			<div className="mx-auto mt-8 max-w-4xl">
				<BillingForm
					experienceId={experienceId}
					whopDevUserToken={whopDevUserToken}
				/>
			</div>
		</div>
	);
}
