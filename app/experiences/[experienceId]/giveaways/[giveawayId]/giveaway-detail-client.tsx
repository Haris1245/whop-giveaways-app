"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge, Button, Heading, Text } from "frosted-ui";
import { CheckCircle, Clock, Loader2, Ticket, Trophy, Users } from "lucide-react";
import { BackLink } from "@/components/back-link";
import { FormattedDateTime } from "@/components/formatted-datetime";
import { WinnerConfettiOnLoad } from "@/components/winner-confetti";
import { whopDevAwareFetch } from "@/lib/append-whop-dev-user-token";
import { GIVEAWAY_END_DATETIME_FORMAT } from "@/lib/format-datetime";
import type { GiveawayRow } from "../../giveaway-hub-types";
import {
	adminEntrantsButtonLabel,
	closedGiveawayMessage,
	giveawayAcceptsEntries,
	statusTone,
} from "../../giveaway-hub-utils";

type DetailGiveaway = GiveawayRow;

function StatCard({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-lg border border-black/10 bg-white ring-1 ring-black/[0.04] px-3.5 py-3 dark:border-white/[0.08] dark:bg-white/[0.03] dark:ring-white/[0.08]">
			<p className="text-[10px] font-medium uppercase tracking-wider text-gray-600 dark:text-gray-500">
				{label}
			</p>
			<p className="mt-1 text-sm font-semibold leading-snug text-gray-900 dark:text-gray-100">
				{value}
			</p>
		</div>
	);
}

export function GiveawayDetailClient(props: {
	experienceId: string;
	giveaway: DetailGiveaway;
	access: "admin" | "customer" | "no_access";
	hubHref: string;
	entrantsHref: string | null;
}) {
	const router = useRouter();
	const isAdmin = props.access === "admin";
	const g = props.giveaway;
	const [entered, setEntered] = useState(Boolean(g.entered));
	const [joinBusy, setJoinBusy] = useState(false);
	const [joinError, setJoinError] = useState<string | null>(null);

	const prize = g.rewardText?.trim() || null;
	const acceptsEntries = giveawayAcceptsEntries(g);
	const isWinner = Boolean(g.isWinner) && !isAdmin;

	async function handleEnter() {
		setJoinBusy(true);
		setJoinError(null);
		try {
			const res = await whopDevAwareFetch(`/api/giveaways/${g.id}/enter`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ experienceId: props.experienceId }),
			});
			const data = await res.json();
			if (!res.ok) {
				setJoinError(typeof data.error === "string" ? data.error : "Could not enter");
				return;
			}
			setEntered(true);
			router.refresh();
		} catch {
			setJoinError("Network error. Try again.");
		} finally {
			setJoinBusy(false);
		}
	}

	return (
		<div className="flex min-h-screen flex-col bg-white text-gray-900 dark:bg-[#0d0d0f] dark:text-gray-100">
			{isWinner ? (
				<WinnerConfettiOnLoad experienceId={props.experienceId} winIds={[g.id]} />
			) : null}
			<main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-6 md:px-6 md:py-8">
				<div className="mb-6">
					<BackLink href={props.hubHref} label="All giveaways" />
				</div>
				<div className="mx-auto flex w-full max-w-[920px] flex-col gap-8 lg:flex-row lg:items-start lg:justify-center lg:gap-10">
					<div className="flex w-full shrink-0 flex-col gap-4 lg:max-w-[520px]">
						<div className="relative aspect-video w-full overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-950">
							{g.coverImageUrl ? (
								<Image
									src={g.coverImageUrl}
									alt=""
									fill
									className="object-cover"
									unoptimized
									sizes="(max-width: 1024px) 100vw, 520px"
									priority
								/>
							) : (
								<div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-violet-100 via-gray-50 to-white dark:from-violet-950/40 dark:via-gray-900 dark:to-gray-950">
									<Ticket className="h-12 w-12 text-black/15 dark:text-white/15" aria-hidden />
								</div>
							)}
							<Badge
								color={statusTone(g.status)}
								size="2"
								className="absolute right-3 top-3 z-10 capitalize"
							>
								{g.status}
							</Badge>
						</div>

						<Heading
							as="h1"
							size="8"
							weight="bold"
							className="text-balance leading-tight tracking-tight text-gray-900 dark:text-white"
						>
							{g.title}
						</Heading>

						{g.description.trim() ? (
							<Text
								size="3"
								className="whitespace-pre-wrap leading-relaxed text-gray-700 dark:text-gray-400"
							>
								{g.description.trim()}
							</Text>
						) : null}
					</div>

					<aside className="w-full shrink-0 lg:w-[360px] lg:sticky lg:top-6 lg:self-start">
						<div className="flex flex-col gap-5 rounded-2xl border border-black/15 bg-white ring-1 ring-black/[0.05] p-5 shadow-lg shadow-black/5 dark:border-white/[0.08] dark:bg-[#111114] dark:ring-white/[0.08] dark:shadow-black/25 md:p-6">
							<div className="flex items-start gap-3 rounded-lg border border-black/10 bg-white ring-1 ring-black/[0.04] px-3.5 py-3 dark:border-white/[0.08] dark:bg-white/[0.03] dark:ring-white/[0.08]">
								<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-black/[0.05] text-gray-600 dark:bg-white/[0.06] dark:text-gray-400">
									<Clock className="h-4 w-4" aria-hidden />
								</div>
								<div className="min-w-0">
									<p className="text-[10px] font-medium uppercase tracking-wider text-gray-600 dark:text-gray-500">
										Ends
									</p>
									<p className="mt-0.5 text-sm font-medium text-gray-900 dark:text-gray-100">
										<FormattedDateTime iso={g.endTime} options={GIVEAWAY_END_DATETIME_FORMAT} />
									</p>
								</div>
							</div>

							<div className={`grid gap-3 ${prize ? "grid-cols-2" : "grid-cols-1"}`}>
								{prize ? <StatCard label="Prize" value={prize} /> : null}
								<StatCard label="Entrants" value={(g.entrantCount ?? 0).toLocaleString()} />
							</div>

						{g.enforceAccountAge && (
							<div className="flex flex-col gap-2.5 border-t border-black/10 pt-5 dark:border-white/[0.06]">
								<p className="text-[10px] font-medium uppercase tracking-wider text-gray-600 dark:text-gray-500">
									Requirements
								</p>
								<Text size="2" color="gray">
									Account must be at least {g.minAccountAgeDays ?? "?"} days old.
								</Text>
							</div>
						)}

							{joinError ? (
								<Text size="2" color="red">
									{joinError}
								</Text>
							) : null}

							<div className="border-t border-black/10 pt-5 dark:border-white/[0.06]">
								<div className="flex flex-col gap-3">
									{isAdmin ? (
										<>
											{props.entrantsHref ? (
												<Link href={props.entrantsHref} className="w-full">
													<Button variant="classic" color="orange" size="2" type="button" className="w-full">
														{g.status === "completed" ? (
															<Trophy className="h-4 w-4 shrink-0" aria-hidden />
														) : (
															<Users className="h-4 w-4 shrink-0" aria-hidden />
														)}
														{adminEntrantsButtonLabel(g)}
													</Button>
												</Link>
											) : null}
											{acceptsEntries ? (
												<Text size="2" color="gray" className="leading-relaxed">
													Admins can&apos;t enter giveaways they manage. Members can join from this page.
												</Text>
											) : (
												<Text size="2" color="gray" className="w-full text-center leading-relaxed">
													{closedGiveawayMessage(g.status, true)}
												</Text>
											)}
										</>
									) : acceptsEntries ? (
										entered ? (
											<Button disabled variant="surface" size="2" type="button" className="w-full cursor-default">
												<CheckCircle className="h-4 w-4 shrink-0 text-green-400" aria-hidden />
												You&apos;re entered
											</Button>
										) : (
											<Button
												variant="classic"
												color="orange"
												size="2"
												type="button"
												disabled={joinBusy}
												onClick={() => void handleEnter()}
												className="w-full"
											>
												{joinBusy ? (
													<>
														<Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
														Entering…
													</>
												) : (
													<>
														<Ticket className="h-4 w-4 shrink-0" aria-hidden />
														Enter giveaway
													</>
												)}
											</Button>
										)
									) : isWinner ? (
										<div className="flex flex-col gap-2">
											<Button
												disabled
												variant="surface"
												size="2"
												type="button"
												className="w-full cursor-default border border-emerald-500/25 bg-emerald-500/10 text-emerald-100"
											>
												<Trophy className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
												You won this giveaway
											</Button>
											<Text size="2" color="gray" className="text-center leading-relaxed">
												The admin will reach out to you with next steps.
											</Text>
										</div>
									) : (
										<div className="flex flex-col gap-2">
											<Button
												disabled
												variant="surface"
												size="2"
												type="button"
												className="w-full cursor-default"
											>
												{g.status === "completed" ? "You lost" : closedGiveawayMessage(g.status)}
											</Button>
											{g.status === "completed" ? (
												<Text size="2" color="gray" className="text-center leading-relaxed">
													{closedGiveawayMessage(g.status)}
												</Text>
											) : null}
										</div>
									)}
								</div>
							</div>
						</div>
					</aside>
				</div>
			</main>
		</div>
	);
}
