"use client";
import React, { useState, useEffect } from "react";
import { Card, Text, Button, Badge } from "frosted-ui";
import { useIframeSdk } from "@whop/react/iframe";
import { createSubscription } from "@/app/actions/create-checkout";
import { plans as planIds } from "@/lib/plans";
import {
	getWhopDevUserTokenFromBrowser,
	whopDevAwareFetch,
} from "@/lib/append-whop-dev-user-token";
import { formatCheckoutError } from "@/lib/checkout-errors";

const checkoutPlans = {
	free: { planId: null },
	pro: { planId: planIds.pro.planId },
};

const BillingForm = ({
	experienceId,
	whopDevUserToken,
}: {
	experienceId: string;
	whopDevUserToken?: string | null;
}) => {
	const iframeSdk = useIframeSdk();
	const [recieptId, setRecieptId] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [currentPlan, setCurrentPlan] = useState<string>("free");

	useEffect(() => {
		const fetchCurrentPlan = async () => {
			try {
				const response = await whopDevAwareFetch(
					`/api/plan-limits/${experienceId}`,
				);
				if (response.ok) {
					const data = await response.json();
					setCurrentPlan(data.planType);
				}
			} catch (err) {
				console.error("Failed to fetch current plan:", err);
			}
		};

		void fetchCurrentPlan();
	}, [experienceId]);

	async function handlePurchase(planId: string) {
		try {
			const checkoutSession = await createSubscription(
				experienceId,
				planId,
				whopDevUserToken ?? getWhopDevUserTokenFromBrowser(),
			);
			const result = await iframeSdk.inAppPurchase(checkoutSession!);
			if (result.status === "ok") {
				setRecieptId(result.data.receiptId);
				setError(null);
				setCurrentPlan("pro");
			} else {
				setRecieptId(null);
				setError(formatCheckoutError(result.error));
			}
		} catch (err) {
			setRecieptId(null);
			setError(formatCheckoutError(err));
			console.error(err);
		}
	}

	const planDetails = {
		free: {
			name: "Free",
			price: "$0/forever",
			description: "Run a single giveaway for your community",
			features: [
				{ text: "1 active giveaway at a time", available: true },
				{ text: "Up to 25 entrants per giveaway", available: true },
				{ text: "Security features (IP & account age)", available: false },
				{ text: "Unlimited concurrent giveaways", available: false },
				{ text: "Unlimited entrants per giveaway", available: false },
			],
			popular: false,
		},
		pro: {
			name: "Pro",
			price: "$25/lifetime",
			description: "Full giveaways toolkit for growing communities",
			features: [
				{ text: "Unlimited active giveaways", available: true },
				{ text: "Unlimited entrants per giveaway", available: true },
				{ text: "Security features (IP & account age)", available: true },
				{ text: "Duplicate IP checks", available: true },
				{ text: "Minimum Whop account age rules", available: true },
			],
			popular: true,
		},
	};

	return (
		<div className="flex flex-col items-center rounded-2xl border border-white/10 bg-slate-50 px-4 py-12">
			<div className="mb-12 flex flex-col items-center justify-center gap-4 text-center">
				<Text size="9" weight="bold" className=" text-slate-900">
				Choose your plan
				</Text>
				<Text
					size="4"
					color="gray"
					className="mx-auto max-w-2xl leading-relaxed"
				>
					Upgrade to Pro for unlimited giveaways, entrants, and security tools.
				</Text>
			</div>

			{error ? (
				<Text size="2" color="red" className="mb-4">
					{error}
				</Text>
			) : null}
			{recieptId ? (
				<Text size="2" color="green" className="mb-4">
					Thanks — your Pro purchase is processing.
				</Text>
			) : null}

			<div className="mx-auto grid w-full max-w-3xl grid-cols-1 items-stretch justify-center gap-6 sm:grid-cols-2">
				{Object.entries(checkoutPlans).map(([key, plan]) => {
					const details = planDetails[key as keyof typeof planDetails];

					return (
						<div key={key} className="relative flex-1">
							<Card
								variant="surface"
								className="relative h-full overflow-hidden border-0 transition-all duration-300 hover:shadow-2xl"
							>
								<div className="relative flex h-full flex-col gap-3 p-8">
									{details.popular ? (
										<div className="absolute -top-1 left-1/2 z-10 -translate-x-1/2 transform">
											<Badge variant="soft" color="orange" size="2">
												Popular
											</Badge>
										</div>
									) : null}
									<div className="mb-2 text-start">
										<Text
											size="6"
											weight="bold"
											className="mb-2 text-slate-900"
										>
											{details.name}
										</Text>

										<div className="mb-3 flex items-baseline justify-start gap-1">
											<Text size="9" weight="bold" className="text-slate-900">
												${details.price.match(/\d+\.?\d*/)?.[0]}
											</Text>
											<Text size="4" color="gray" className="font-medium">
												{details.price.includes("lifetime")
													? " lifetime"
													: details.price.includes("month")
														? "/month"
														: "/forever"}
											</Text>
										</div>

										<Text
											size="3"
											color="gray"
											className="max-w-xs leading-relaxed"
										>
											{details.description}
										</Text>
									</div>
									<Button
										variant="classic"
										color="orange"
										size="3"
										disabled={key === currentPlan}
										onClick={() => plan.planId && handlePurchase(plan.planId)}
									>
										{key === currentPlan
											? "Current plan"
											: key === "pro"
												? "Upgrade to Pro"
												: "Free plan"}
									</Button>
									<div className="flex-1 space-y-4">
										{details.features.map((feature, index) => (
											<div key={index} className="flex items-start gap-3">
												<div
													className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full ${
														feature.available
															? "bg-green-100 text-green-600"
															: "bg-red-100 text-red-600"
													}`}
												>
													{feature.available ? (
														<svg
															className="h-3 w-3"
															fill="none"
															stroke="currentColor"
															viewBox="0 0 24 24"
														>
															<path
																strokeLinecap="round"
																strokeLinejoin="round"
																strokeWidth={3}
																d="M5 13l4 4L19 7"
															/>
														</svg>
													) : (
														<svg
															className="h-3 w-3"
															fill="none"
															stroke="currentColor"
															viewBox="0 0 24 24"
														>
															<path
																strokeLinecap="round"
																strokeLinejoin="round"
																strokeWidth={3}
																d="M6 18L18 6M6 6l12 12"
															/>
														</svg>
													)}
												</div>
												<Text
													size="3"
													className={`leading-relaxed ${
														feature.available
															? "text-slate-700"
															: "text-slate-400 line-through"
													}`}
												>
													{feature.text}
												</Text>
											</div>
										))}
									</div>
								</div>
							</Card>
						</div>
					);
				})}
			</div>
		</div>
	);
};

export default BillingForm;
