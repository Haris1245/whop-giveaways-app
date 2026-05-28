"use client";

import { useState } from "react";
import { Button, Dialog, Text } from "frosted-ui";
import { Clock, Loader2, Ticket } from "lucide-react";
import { whopDevAwareFetch } from "@/lib/append-whop-dev-user-token";
import type { GiveawayRow } from "./giveaway-hub-types";
import { formatGiveawayEndsReadable } from "./giveaway-hub-utils";

function prizeLabel(g: GiveawayRow): string | null {
	const t = g.rewardText?.trim();
	return t ? t : null;
}

export function JoinGiveawayDialog(props: {
	experienceId: string;
	giveaway: GiveawayRow | null;
	onDismiss: () => void;
	onJoined: () => Promise<void>;
}) {
	const joinTarget = props.giveaway;
	const open = joinTarget !== null;

	const [joinBusy, setJoinBusy] = useState(false);
	const [joinError, setJoinError] = useState<string | null>(null);

	const handleOpenChange = (nextOpen: boolean) => {
		if (!nextOpen) {
			props.onDismiss();
			setJoinError(null);
		}
	};

	const hasEntryRequirements = Boolean(
		joinTarget &&
			(joinTarget.requiredPassId || joinTarget.enforceAccountAge),
	);

	return (
		<Dialog.Root open={open} onOpenChange={handleOpenChange}>
			<Dialog.Content size="3" style={{ maxWidth: 440 }}>
				{joinTarget ? (
					<div className="flex flex-col gap-5 p-1">
						{/* Header */}
						<div className="flex flex-col gap-1.5">
							<Text size="1" weight="medium" className="uppercase tracking-widest text-gray-500">
								Enter giveaway
							</Text>
							<Dialog.Title
								size="5"
								weight="bold"
								className="leading-snug text-gray-950 dark:text-gray-50"
							>
								{joinTarget.title}
							</Dialog.Title>
							<Text size="2" className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
								<Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
								Ends {formatGiveawayEndsReadable(joinTarget.endTime)}
							</Text>
						</div>

						{/* Prize */}
						{(() => {
							const prize = prizeLabel(joinTarget);
							return prize ? (
								<div className="flex flex-col gap-0.5">
									<Text size="1" weight="medium" className="uppercase tracking-widest text-gray-500">
										Prize
									</Text>
									<Text size="4" weight="bold" className="text-gray-950 dark:text-gray-50">
										{prize}
									</Text>
								</div>
							) : null;
						})()}

						{/* Description */}
						{joinTarget.description.trim() ? (
							<Text
								size="2"
								className="leading-relaxed text-gray-700 dark:text-gray-400 whitespace-pre-wrap"
							>
								{joinTarget.description.trim()}
							</Text>
						) : null}

						{/* Requirements */}
						{(joinTarget.requiredPassId || joinTarget.enforceAccountAge) ? (
							<div className="flex flex-col gap-2">
								<Text size="2" weight="medium" className="text-gray-900 dark:text-gray-300">
									Requirements
								</Text>
								<ul className="flex flex-col gap-1.5 pl-4 list-disc marker:text-gray-500 dark:marker:text-gray-600">
									{joinTarget.requiredPassId ? (
										<li>
											<Text size="2" className="text-gray-700 dark:text-gray-400 leading-snug">
												{joinTarget.requiredPassTitle ? (
													<>
														You need an active Whop pass, membership, or product that includes{" "}
														<span className="text-gray-900 dark:text-gray-200">
															&quot;{joinTarget.requiredPassTitle}&quot;
														</span>{" "}
														to enter.
													</>
												) : (
													<>
														You need an active Whop pass, product purchase, or membership (as chosen by
														the creator) to enter.
													</>
												)}
											</Text>
										</li>
									) : null}
									{joinTarget.enforceAccountAge ? (
										<li>
											<Text size="2" className="text-gray-700 dark:text-gray-400 leading-snug">
												Account must be at least {joinTarget.minAccountAgeDays ?? "?"} days old.
											</Text>
										</li>
									) : null}
								</ul>
							</div>
						) : null}

						{/* Fine print */}
						<Text size="1" className="text-gray-600 dark:text-gray-500 leading-relaxed">
							{hasEntryRequirements
								? "By confirming, you're joining the pool of entrants. Make sure you meet all requirements above."
								: "By confirming, you're joining the pool of entrants."}
						</Text>

						{/* Error */}
						{joinError ? (
							<Text size="2" color="red">
								{joinError}
							</Text>
						) : null}

						{/* Actions */}
						<div className="flex justify-end gap-2 border-t border-black/10 pt-4 dark:border-white/10">
							<Button
								type="button"
								variant="surface"
								disabled={joinBusy}
								onClick={() => handleOpenChange(false)}
							>
								Cancel
							</Button>
							<Button
								type="button"
								variant="classic"
								color="orange"
								disabled={joinBusy}
								className="flex items-center gap-2"
								onClick={async () => {
									if (!joinTarget) return;
									setJoinBusy(true);
									setJoinError(null);
									try {
										const res = await whopDevAwareFetch(
											`/api/giveaways/${joinTarget.id}/enter`,
											{
												method: "POST",
												headers: { "Content-Type": "application/json" },
												body: JSON.stringify({ experienceId: props.experienceId }),
											},
										);
										const data = await res.json();
										if (!res.ok) {
											setJoinError(
												typeof data.error === "string" ? data.error : "Could not enter",
											);
											return;
										}
										handleOpenChange(false);
										await props.onJoined();
									} catch {
										setJoinError("Network error. Try again.");
									} finally {
										setJoinBusy(false);
									}
								}}
							>
								{joinBusy ? (
									<>
										<Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
										Entering…
									</>
								) : (
									<>
										<Ticket className="h-4 w-4 shrink-0" aria-hidden />
										Confirm entry
									</>
								)}
							</Button>
						</div>
					</div>
				) : null}
			</Dialog.Content>
		</Dialog.Root>
	);
}