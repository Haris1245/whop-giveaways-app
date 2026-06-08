import Link from "next/link";
import { notFound } from "next/navigation";
import type { ComponentProps } from "react";
import {
	pickWhopDevUserTokenFromRecord,
	withWhopDevUserTokenQuery,
} from "@/lib/append-whop-dev-user-token";
import { verifyUser } from "@/lib/authentication";
import { db } from "@/db";
import { entrantTable, giveawayTable } from "@/db/schema";
import { enrichEntrantsWithWhopProfiles } from "@/lib/enrich-entrants-whop";
import { syncPastDueGiveaways } from "@/lib/expire-giveaways";
import type { EnrichedEntrant } from "@/lib/enrich-entrants-whop";
import {
	Avatar,
	Badge,
	Button,
	Code,
	Heading,
	Table,
	Text,
} from "frosted-ui";
import { and, count, desc, eq } from "drizzle-orm";
import { CalendarDays, Clock, Shield, Trophy, Users } from "lucide-react";
import { BackLink } from "@/components/back-link";
import { FormattedDateTime } from "@/components/formatted-datetime";
import { GIVEAWAY_END_DATETIME_FORMAT } from "@/lib/format-datetime";
import { EntrantRowActions } from "./entrant-row-actions";
import { GiveawayEditDialog } from "./giveaway-edit-dialog";
import { WinnerRow } from "./winner-row";

function usernameToInitials(username: string): string {
	const u = username.replace(/^@/, "").trim();
	if (!u) return "?";
	const parts = u.split(/[\s._-]+/).filter(Boolean);
	if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
	return u.slice(0, 2).toUpperCase();
}

function formatUsername(username: string): string {
	const t = username.trim();
	if (!t) return "@unknown";
	return t.startsWith("@") ? t : `@${t}`;
}

function statusVariant(status: string): NonNullable<ComponentProps<typeof Badge>["color"]> {
	switch (status) {
		case "active":    return "green";
		case "drawing":   return "amber";
		case "completed": return "gray";
		case "cancelled": return "red";
		default:          return "gray";
	}
}

function MemberAvatar({ url, username, size = "md" }: { url: string | null; username: string; size?: "sm" | "md" }) {
	const fzSize = size === "sm" ? "2" : "3";
	const handle = username.replace(/^@/, "").trim();
	return (
		<Avatar
			size={fzSize}
			color="gray"
			src={url ?? undefined}
			alt=""
			referrerPolicy="no-referrer"
			fallback={handle.length > 0 ? handle : usernameToInitials(username)}
		/>
	);
}

const ENTRANTS_PAGE_SIZE = 20;

function parsePageParam(raw: string | string[] | undefined): number {
	const str = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : undefined;
	const n = str ? Number.parseInt(str, 10) : 1;
	if (!Number.isFinite(n) || n < 1) return 1;
	return n;
}

function StatItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
	return (
		<div className="flex items-center gap-3">
			<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-black/5 text-gray-600 dark:bg-white/6 dark:text-gray-400">
				{icon}
			</div>
			<div>
				<p className="text-[11px] font-medium uppercase tracking-wider text-gray-600 dark:text-gray-400">
					{label}
				</p>
				<p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{value}</p>
			</div>
		</div>
	);
}

export default async function GiveawayEntrantsPage({
	params,
	searchParams,
}: {
	params: Promise<{ experienceId: string; giveawayId: string }>;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	const { experienceId, giveawayId } = await params;
	const search = await searchParams;

	if (!experienceId || typeof experienceId !== "string" || experienceId.includes("[object Object]")) {
		notFound();
	}

	let forbiddenMessage: string | null = null;
	try {
		await verifyUser(experienceId, "admin", search);
	} catch (e: unknown) {
		forbiddenMessage = e instanceof Error ? e.message : "Access denied";
	}

	const giveawaysHref = withWhopDevUserTokenQuery(
		`/experiences/${experienceId}`,
		pickWhopDevUserTokenFromRecord(search),
	);

	if (forbiddenMessage) {
		return (
			<div className="flex min-h-screen flex-col bg-white text-gray-900 dark:bg-[#0d0d0f] dark:text-gray-100">
				<header className="border-b border-black/10 bg-white px-6 py-6 dark:border-white/10 dark:bg-[#111114]">
					<BackLink href={giveawaysHref} label="All giveaways" />
				</header>
				<div className="flex flex-1 items-center justify-center p-6">
					<div className="w-full max-w-sm rounded-2xl border border-black/10 bg-white p-8 dark:border-white/10 dark:bg-[#111114]">
						<div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10">
							<Shield className="h-5 w-5 text-red-400" />
						</div>
						<p className="text-base font-semibold text-gray-900 dark:text-white">Admin only</p>
						<p className="mt-1.5 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
							{forbiddenMessage}
						</p>
					</div>
				</div>
			</div>
		);
	}

	const whopDevUserToken = pickWhopDevUserTokenFromRecord(search);
	const entrantsListPath = `/experiences/${experienceId}/giveaways/${giveawayId}/entrants`;

	await syncPastDueGiveaways(experienceId, { giveawayId });

	function entrantsPageHref(nextPage: number): string {
		const q = nextPage <= 1 ? "" : `?page=${nextPage}`;
		return withWhopDevUserTokenQuery(`${entrantsListPath}${q}`, whopDevUserToken);
	}

	const gwRows = await db
		.select({
			title: giveawayTable.title,
			description: giveawayTable.description,
			status: giveawayTable.status,
			winnerUserId: giveawayTable.winnerUserId,
			winnerPickedAt: giveawayTable.winnerPickedAt,
			giveawayExperienceId: giveawayTable.experienceId,
			createdAt: giveawayTable.createdAt,
			endTime: giveawayTable.endTime,
			coverImageUrl: giveawayTable.coverImageUrl,
			requiredPassId: giveawayTable.requiredPassId,
			enforceIpChecks: giveawayTable.enforceIpChecks,
			enforceAccountAge: giveawayTable.enforceAccountAge,
			minAccountAgeDays: giveawayTable.minAccountAgeDays,
			rewardText: giveawayTable.rewardText,
		})
		.from(giveawayTable)
		.where(eq(giveawayTable.id, giveawayId))
		.limit(1);

	const gw = gwRows[0];
	if (!gw || gw.giveawayExperienceId !== experienceId) notFound();

	const [{ value: totalEntrantsCt }] = await db
		.select({ value: count() })
		.from(entrantTable)
		.where(eq(entrantTable.giveawayId, giveawayId));

	const totalEntrants = Number(totalEntrantsCt ?? 0);
	const totalPages = Math.max(1, Math.ceil(totalEntrants / ENTRANTS_PAGE_SIZE));
	let page = parsePageParam(search.page);
	if (totalEntrants > 0) {
		page = Math.min(page, totalPages);
	}

	const entrantRows = await db
		.select({
			id: entrantTable.id,
			userId: entrantTable.userId,
			username: entrantTable.username,
			ipAddress: entrantTable.ipAddress,
			whopAccountCreatedAt: entrantTable.whopAccountCreatedAt,
			enteredAt: entrantTable.createdAt,
		})
		.from(entrantTable)
		.where(eq(entrantTable.giveawayId, giveawayId))
		.orderBy(desc(entrantTable.createdAt))
		.limit(ENTRANTS_PAGE_SIZE)
		.offset(Math.max(0, (page - 1) * ENTRANTS_PAGE_SIZE));

	const entrants = entrantRows.length > 0 ? await enrichEntrantsWithWhopProfiles(entrantRows) : [];

	let winnerMember: EnrichedEntrant | null = null;

	if (gw.winnerUserId) {
		const winnerRows = await db
			.select({
				id: entrantTable.id,
				userId: entrantTable.userId,
				username: entrantTable.username,
				ipAddress: entrantTable.ipAddress,
				whopAccountCreatedAt: entrantTable.whopAccountCreatedAt,
				enteredAt: entrantTable.createdAt,
			})
			.from(entrantTable)
			.where(and(eq(entrantTable.giveawayId, giveawayId), eq(entrantTable.userId, gw.winnerUserId)))
			.limit(1);
		const w = winnerRows[0];
		if (w) {
			winnerMember = (await enrichEntrantsWithWhopProfiles([w]))[0] ?? null;
		}
	}

	if (gw.winnerUserId && !winnerMember) {
		const [fromProfile] = await enrichEntrantsWithWhopProfiles([{
			id: `winner-${gw.winnerUserId}`,
			userId: gw.winnerUserId,
			username: gw.winnerUserId,
			ipAddress: null,
			whopAccountCreatedAt: null,
			enteredAt: gw.winnerPickedAt ?? new Date(),
		}]);
		winnerMember = fromProfile ?? null;
	}

	return (
		<div className="flex min-h-screen flex-col bg-white text-gray-900 dark:bg-[#0d0d0f] dark:text-gray-100">
			{/* ── Header ── */}
			<header className="border-b border-black/10 bg-white dark:border-white/10 dark:bg-[#111114]">
				<div className="mx-auto max-w-5xl px-6 pb-8 pt-6">
					<div className="mb-8">
						<BackLink href={giveawaysHref} label="All giveaways" />
					</div>
					<div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-4">
						<Heading
							as="h1"
							size="9"
							weight="bold"
							trim="start"
							highContrast
							className="min-w-0 max-w-[min(100%,40rem)] text-balance !leading-[1.05] !tracking-[-0.03em]"
						>
							{gw.title}
						</Heading>
						<div className="flex shrink-0 flex-wrap items-center gap-2">
							<GiveawayEditDialog
								experienceId={experienceId}
								whopDevUserToken={whopDevUserToken}
								giveawayId={giveawayId}
								initialTitle={gw.title}
								initialDescription={gw.description}
								initialCoverImageUrl={gw.coverImageUrl}
								initialEndTimeIso={(gw.endTime ?? new Date(0)).toISOString()}
								initialRequiredPassId={gw.requiredPassId ?? null}
								initialEnforceIpChecks={gw.enforceIpChecks}
								initialEnforceAccountAge={gw.enforceAccountAge}
								initialMinAccountAgeDays={gw.minAccountAgeDays ?? 0}
								rewardText={gw.rewardText}
							/>
							<Badge color={statusVariant(gw.status)} size="2" className="-translate-y-px capitalize">
								{gw.status}
							</Badge>
						</div>
					</div>

					{/* Stat bar */}
					<div className="mt-6 flex flex-wrap gap-6 border-t border-black/10 pt-6 dark:border-white/10">
						<StatItem
							icon={<Clock className="h-4 w-4" />}
							label="Ends"
							value={
								<FormattedDateTime
									iso={(gw.endTime ?? new Date(0)).toISOString()}
									options={GIVEAWAY_END_DATETIME_FORMAT}
								/>
							}
						/>
						<StatItem icon={<Users className="h-4 w-4" />} label="Entrants" value={String(totalEntrants)} />
						<StatItem icon={<Trophy className="h-4 w-4" />} label="Winner" value={gw.winnerUserId ? "Drawn" : "Not drawn yet"} />
						{gw.createdAt ? (
							<StatItem
								icon={<CalendarDays className="h-4 w-4" />}
								label="Created"
								value={<FormattedDateTime iso={gw.createdAt.toISOString()} />}
							/>
						) : null}
					</div>
				</div>
			</header>

			{/* ── Main ── */}
			<main className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-6 py-6">
				{/* Winner */}
				<section className="mb-6 space-y-3">
					<div>
						<Heading as="h2" size="4" weight="semi-bold">
							Winner
						</Heading>
						<Text as="p" size="1" color="gray" className="mt-1">
							Chosen at random when the giveaway is drawn.
						</Text>
					</div>
					{gw.winnerUserId && winnerMember ? (
						<WinnerRow
							username={winnerMember.username}
							displayName={winnerMember.displayName}
							profilePictureUrl={winnerMember.profilePictureUrl}
							pickedAtIso={gw.winnerPickedAt?.toISOString() ?? null}
						/>
					) : gw.winnerUserId ? (
						<div className="py-2">
							<Text as="p" size="2" color="gray">
								Winner profile unavailable
							</Text>
							<Code size="1" variant="ghost" color="gray" className="mt-2 block font-mono">
								{gw.winnerUserId}
							</Code>
							<Text as="p" size="1" color="gray" className="mt-2">
								Drawn <FormattedDateTime iso={gw.winnerPickedAt?.toISOString()} />
							</Text>
						</div>
					) : (
						<Text as="p" size="2" color="gray">
							No winner yet — one entrant is picked at random when the giveaway ends.
						</Text>
					)}
				</section>

				{/* Entrants */}
				<section className="space-y-3">
					{totalEntrants === 0 ? (
						<div className="flex flex-col items-center py-10 text-center">
							<div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-black/5 dark:bg-white/5">
								<Users className="h-5 w-5 text-gray-500 dark:text-gray-400" aria-hidden />
							</div>
							<Heading as="h2" size="4" weight="semi-bold">
								Entrants
							</Heading>
							<Text as="p" size="2" color="gray" align="center" className="mt-2 max-w-xs">
								No entrants yet — entries appear once members join from your giveaways hub.
							</Text>
						</div>
					) : (
						<>
							<div>
								<Heading as="h2" size="4" weight="semi-bold">
									Entrants
								</Heading>
								<Text as="p" size="1" color="gray" className="mt-1">
									Everyone who entered this giveaway.
								</Text>
							</div>
							<div className="overflow-x-auto">
								<Table.Root variant="surface" size="2" className="min-w-[700px]">
									<Table.Table className="w-full">
										<Table.Header>
											<Table.Row align="center">
												<Table.ColumnHeaderCell width={48}>#</Table.ColumnHeaderCell>
												<Table.ColumnHeaderCell>Member</Table.ColumnHeaderCell>
												<Table.ColumnHeaderCell className="hidden md:table-cell">
													User ID
												</Table.ColumnHeaderCell>
												<Table.ColumnHeaderCell className="hidden lg:table-cell">
													<span className="inline-flex items-center gap-1">
														<Clock className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
														Whop joined
													</span>
												</Table.ColumnHeaderCell>
												<Table.ColumnHeaderCell>Entered</Table.ColumnHeaderCell>
												
												<Table.ColumnHeaderCell justify="end">
													<span className="sr-only">Actions</span>
												</Table.ColumnHeaderCell>
											</Table.Row>
										</Table.Header>
										<Table.Body>
											{entrants.map((e, index) => {
												const rank = (page - 1) * ENTRANTS_PAGE_SIZE + index + 1;
												const isWinner = e.userId === gw.winnerUserId;
												return (
													<Table.Row
														align="center"
														key={e.id}
														className={
															isWinner
																? "bg-emerald-500/10 dark:bg-emerald-500/[0.07]"
																: undefined
														}
													>
														<Table.Cell width={48} justify="center" className="tabular-nums">
															<Text as="span" size="2" color="gray">
																{rank}
															</Text>
														</Table.Cell>
														<Table.Cell className="min-w-0">
															<div className="flex min-w-0 items-center gap-3">
																<MemberAvatar
																	url={e.profilePictureUrl}
																	username={e.username}
																	size="sm"
																/>
																<div className="flex min-w-0 flex-col gap-0.5 py-px">
																	<Text
																		as="span"
																		size="2"
																		weight="medium"
																		trim="end"
																		className="inline-flex max-w-full items-center gap-1.5"
																	>
																		<span className="min-w-0 truncate">
																			{formatUsername(e.username)}
																		</span>
																		{isWinner ? (
																			<Trophy
																				className="h-3.5 w-3.5 shrink-0 text-emerald-400"
																				aria-label="Winner"
																			/>
																		) : null}
																	</Text>
																	{e.displayName ? (
																		<Text
																			as="span"
																			size="1"
																			color="gray"
																			trim="end"
																			className="block truncate"
																		>
																			{e.displayName}
																		</Text>
																	) : null}
																</div>
															</div>
														</Table.Cell>
														<Table.Cell className="hidden md:table-cell">
															<Code
																size="1"
																variant="ghost"
																color="gray"
																title={e.userId}
																className="block max-w-[160px] truncate font-mono"
															>
																{e.userId}
															</Code>
														</Table.Cell>
														<Table.Cell className="hidden whitespace-nowrap lg:table-cell">
															<Text as="span" size="2" color="gray">
																<FormattedDateTime iso={e.whopAccountCreatedAt?.toISOString()} />
															</Text>
														</Table.Cell>
														<Table.Cell className="whitespace-nowrap">
															<Text as="span" size="2" color="gray">
																<FormattedDateTime iso={e.enteredAt.toISOString()} />
															</Text>
														</Table.Cell>
														
														<Table.Cell justify="end">
															<EntrantRowActions username={e.username} />
														</Table.Cell>
													</Table.Row>
												);
											})}
										</Table.Body>
									</Table.Table>
									<Table.BottomBar className="pt-5">
										<div className="flex w-full min-w-[min-content] flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
											<Text size="2" color="gray">
												Showing {(page - 1) * ENTRANTS_PAGE_SIZE + 1}–
												{Math.min(page * ENTRANTS_PAGE_SIZE, totalEntrants)} of {totalEntrants}{" "}
												{totalEntrants === 1 ? "entrant" : "entrants"}
											</Text>
											<div className="flex flex-wrap items-center gap-2">
												{page <= 1 ? (
													<Button type="button" variant="soft" color="gray" disabled>
														Previous
													</Button>
												) : (
													<Button variant="soft" color="gray" asChild>
														<Link href={entrantsPageHref(page - 1)} prefetch={false}>
															Previous
														</Link>
													</Button>
												)}
												<Text as="span" size="2" color="gray" className="px-2 tabular-nums">
													Page {page} of {totalPages}
												</Text>
												{page >= totalPages ? (
													<Button type="button" variant="soft" color="gray" disabled>
														Next
													</Button>
												) : (
													<Button variant="soft" color="gray" asChild>
														<Link href={entrantsPageHref(page + 1)} prefetch={false}>
															Next
														</Link>
													</Button>
												)}
											</div>
										</div>
									</Table.BottomBar>
								</Table.Root>
							</div>
						</>
					)}
				</section>

			</main>
		</div>
	);
}
