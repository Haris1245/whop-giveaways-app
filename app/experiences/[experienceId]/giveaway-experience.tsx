"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Card, Heading, Spinner, Text } from "frosted-ui";
import { Gift, Plus } from "lucide-react";
import { WinnerConfettiOnLoad } from "@/components/winner-confetti";
import { whopDevAwareFetch, withWhopDevUserTokenQuery } from "@/lib/append-whop-dev-user-token";
import { CreateGiveawayDialog } from "./create-giveaway-dialog";
import { GiveawayHubCard } from "./giveaway-hub-card";
import type { GiveawayRow } from "./giveaway-hub-types";

export interface GiveawayExperienceProps {
	experienceId: string;
	access: "admin" | "customer" | "no_access";
	whopDevUserToken?: string | null;
}

export default function GiveawayExperience({
	experienceId,
	access,
	whopDevUserToken,
}: GiveawayExperienceProps) {
	const [giveaways, setGiveaways] = useState<GiveawayRow[]>([]);
	const [loading, setLoading] = useState(true);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [dialogOpen, setDialogOpen] = useState(false);
	const [atGiveawayLimit, setAtGiveawayLimit] = useState(false);

	const billingHref = useMemo(
		() => withWhopDevUserTokenQuery(`/experiences/${experienceId}/billing`, whopDevUserToken),
		[experienceId, whopDevUserToken],
	);

	const giveawayDetailHref = useCallback(
		(giveawayId: string) =>
			withWhopDevUserTokenQuery(
				`/experiences/${experienceId}/giveaways/${giveawayId}`,
				whopDevUserToken,
			),
		[experienceId, whopDevUserToken],
	);

	const entrantsPageHref = useCallback(
		(giveawayId: string) =>
			withWhopDevUserTokenQuery(
				`/experiences/${experienceId}/giveaways/${giveawayId}/entrants`,
				whopDevUserToken,
			),
		[experienceId, whopDevUserToken],
	);

	const winIds = useMemo(
		() => giveaways.filter((g) => g.isWinner).map((g) => g.id),
		[giveaways],
	);

	const refresh = useCallback(async () => {
		setLoading(true);
		setLoadError(null);
		try {
			const res = await whopDevAwareFetch(
				`/api/giveaways?experienceId=${encodeURIComponent(experienceId)}`,
			);
			const data = await res.json();
			if (!res.ok) {
				setLoadError(data.error ?? "Failed to load giveaways");
				setGiveaways([]);
				return;
			}
			setGiveaways((data.giveaways ?? []) as GiveawayRow[]);
		} catch {
			setLoadError("Failed to load giveaways");
			setGiveaways([]);
		} finally {
			setLoading(false);
		}
	}, [experienceId]);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	useEffect(() => {
		if (access !== "admin") return;
		let cancelled = false;
		async function loadPlanLimits() {
			try {
				const res = await whopDevAwareFetch(
					`/api/plan-limits/${encodeURIComponent(experienceId)}`,
				);
				const data = await res.json();
				if (!res.ok || cancelled) return;
				const maxConcurrent = data.maxConcurrentActiveGiveaways;
				const activeCount = Number(data.activeGiveawayCount ?? 0);
				setAtGiveawayLimit(
					maxConcurrent != null && activeCount >= maxConcurrent,
				);
			} catch {
				if (!cancelled) setAtGiveawayLimit(false);
			}
		}
		void loadPlanLimits();
		return () => {
			cancelled = true;
		};
	}, [experienceId, access, giveaways]);

	return (
		<div className="flex min-h-screen flex-col bg-gray-900 text-gray-100">
			<WinnerConfettiOnLoad
				experienceId={experienceId}
				winIds={winIds}
				enabled={access !== "admin" && !loading}
			/>
			<header className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-700 bg-gray-800 px-4 py-4 md:px-8">
				<Heading as="h1" size="5" weight="bold" className="text-white">
					Giveaways
				</Heading>
				<div className="flex flex-wrap items-center justify-end gap-3">
					{access === "admin" && (
						<>
							<Link href={billingHref} className="shrink-0">
								<Button variant="surface" size="2" type="button">
									Billing
								</Button>
							</Link>
							<CreateGiveawayDialog
								experienceId={experienceId}
								whopDevUserToken={whopDevUserToken}
								open={dialogOpen}
								onOpenChange={setDialogOpen}
								onCreated={refresh}
								trigger={
									<Button
										variant="classic"
										color="orange"
										size="2"
										type="button"
										disabled={atGiveawayLimit}
										title={
											atGiveawayLimit
												? "Free plan: one active giveaway. Upgrade to Pro for more."
												: undefined
										}
									>
										<Plus className="h-4 w-4 shrink-0" aria-hidden />
										New giveaway
									</Button>
								}
							/>
						</>
					)}
				</div>
			</header>

			<main className="flex flex-1 flex-col p-4 md:p-8">
				{loading ? (
					<div className="flex h-48 items-center justify-center">
						<Spinner loading size="3" />
					</div>
				) : loadError ? (
					<Card variant="surface" className="max-w-lg border-red-500/20 bg-red-500/10 p-6">
						<Text size="3" color="red">
							{loadError}
						</Text>
					</Card>
				) : giveaways.length === 0 ? (
					<div className="flex flex-1 flex-col items-center justify-center px-6 py-16">
						<div className="flex w-full max-w-sm flex-col items-stretch gap-6 text-center">
							<div className="flex justify-center">
								<div
									className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.06] ring-1 ring-white/[0.08]"
									aria-hidden
								>
									<Gift className="h-7 w-7 text-gray-400" strokeWidth={1.5} />
								</div>
							</div>
							<div className="flex flex-col gap-2">
								<Heading as="h2" size="5" weight="bold" className="text-balance text-white">
									No giveaways yet
								</Heading>
								<Text size="3" color="gray" className="text-pretty leading-relaxed">
									{access === "admin"
										? "When you publish one, it will show up here for members."
										: "Nothing to join right now. Check back later."}
								</Text>
							</div>
							{access === "admin" ? (
								<Button
									variant="classic"
									color="orange"
									type="button"
									size="3"
									className="w-full"
									disabled={atGiveawayLimit}
									title={
										atGiveawayLimit
											? "Free plan: one active giveaway. Upgrade to Pro for more."
											: undefined
									}
									onClick={() => setDialogOpen(true)}
								>
									<Plus className="h-4 w-4 shrink-0" aria-hidden />
									New giveaway
								</Button>
							) : null}
						</div>
					</div>
				) : (
					<ul className="mx-auto grid max-w-6xl gap-5 sm:grid-cols-2 lg:grid-cols-3">
						{giveaways.map((g) => (
							<li key={g.id}>
								<GiveawayHubCard
									experienceId={experienceId}
									giveaway={g}
									access={access}
									detailHref={giveawayDetailHref(g.id)}
									entrantsHref={entrantsPageHref(g.id)}
									onDeleted={refresh}
								/>
							</li>
						))}
					</ul>
				)}
			</main>
		</div>
	);
}
