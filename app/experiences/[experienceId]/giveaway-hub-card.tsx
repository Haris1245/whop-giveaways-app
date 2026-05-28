"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { AlertDialog, Badge, Button, DropdownMenu, Heading, IconButton, Text } from "frosted-ui";
import { CheckCircle, Gift, Loader2, MoreHorizontal, Ticket, Trash2, Trophy, Users } from "lucide-react";
import { whopDevAwareFetch } from "@/lib/append-whop-dev-user-token";
import type { GiveawayRow } from "./giveaway-hub-types";
import {
	adminEntrantsButtonLabel,
	closedGiveawayMessage,
	formatGiveawayEndsReadable,
	giveawayAcceptsEntries,
} from "./giveaway-hub-utils";

type GiveawayHubCardGiveaway = GiveawayRow & {
	requiredPassTitle?: string | null;
};

function MenuRow({ children }: { children: ReactNode }) {
	return (
		<span className="inline-flex min-w-0 items-center gap-2 [&_svg]:shrink-0">
			{children}
		</span>
	);
}

export function GiveawayHubCard(props: {
	experienceId: string;
	giveaway: GiveawayHubCardGiveaway;
	access: "admin" | "customer" | "no_access";
	detailHref: string;
	entrantsHref: string;
	onDeleted?: () => void;
}) {
	const isAdmin = props.access === "admin";
	const g = props.giveaway;
	const isWinner = Boolean(g.isWinner) && !isAdmin;
	const entrantCount = g.entrantCount ?? 0;
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [deleteBusy, setDeleteBusy] = useState(false);
	const [deleteError, setDeleteError] = useState<string | null>(null);

	async function handleDeleteConfirm() {
		setDeleteBusy(true);
		setDeleteError(null);
		try {
			const res = await whopDevAwareFetch(
				`/api/giveaways/${g.id}?experienceId=${encodeURIComponent(props.experienceId)}`,
				{ method: "DELETE" },
			);
			const data = await res.json().catch(() => ({}));
			if (!res.ok) {
				setDeleteError(
					typeof data.error === "string" ? data.error : "Could not delete giveaway",
				);
				return;
			}
			setDeleteOpen(false);
			props.onDeleted?.();
		} catch {
			setDeleteError("Network error. Try again.");
		} finally {
			setDeleteBusy(false);
		}
	}

	return (
		<div
			className={`group flex h-full flex-col overflow-hidden rounded-2xl border bg-white ring-1 ring-black/[0.06] transition-colors duration-200 hover:bg-gray-50 dark:bg-white/[0.03] dark:ring-white/[0.08] dark:hover:bg-white/[0.05] ${
				isWinner
					? "border-emerald-600/35 hover:border-emerald-600/50 dark:border-emerald-500/35 dark:hover:border-emerald-500/45"
					: "border-black/10 hover:border-black/15 dark:border-white/10 dark:hover:border-white/[0.16]"
			}`}
		>
			<Link
				href={props.detailHref}
				className="relative block aspect-video w-full overflow-hidden bg-gray-100 dark:bg-gray-950"
			>
				{g.coverImageUrl ? (
					<Image
						src={g.coverImageUrl}
						alt=""
						fill
						className="object-cover"
						unoptimized
						sizes="(max-width: 768px) 100vw, 33vw"
					/>
				) : (
					<div className="flex h-full items-center justify-center bg-gradient-to-br from-violet-100 via-gray-50 to-white dark:from-violet-950/40 dark:via-gray-900 dark:to-gray-950">
						<Gift className="h-10 w-10 text-black/20 dark:text-white/20" aria-hidden />
					</div>
				)}
				<div
					className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-black/5 to-black/20"
					aria-hidden
				/>
				{/* Status badge — neutral glass, no loud accent fills */}
				<span className="absolute right-2.5 top-2.5 z-10 rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-medium capitalize tracking-tight text-white/90 ring-1 ring-white/15 backdrop-blur-md">
					{g.status}
				</span>
			</Link>

			{/* Body */}
			<div className="flex flex-1 flex-col gap-0 p-5">
				<div className="flex items-start gap-1">
					<Heading
						as="h3"
						size="4"
						weight="bold"
						className="min-w-0 flex-1 leading-tight text-gray-950 dark:text-gray-50 line-clamp-2"
					>
						<Link
							href={props.detailHref}
							className="transition-colors hover:text-black dark:hover:text-white"
						>
							{g.title}
						</Link>
					</Heading>

					{props.access === "admin" ? (
						<DropdownMenu.Root>
							<DropdownMenu.Trigger className="-m-1 shrink-0 self-start [&:focus-visible]:outline-none">
								<IconButton
									variant="ghost"
									color="gray"
									size="2"
									className="-mr-1"
									type="button"
									aria-label={`Actions for ${g.title}`}
								>
									<MoreHorizontal className="h-4 w-4" aria-hidden />
								</IconButton>
							</DropdownMenu.Trigger>
							<DropdownMenu.Content variant="solid" size="2" align="end" sideOffset={6}>
								<DropdownMenu.Item asChild>
									<Link href={props.detailHref} prefetch={false}>
										<MenuRow>
											<Ticket className="h-4 w-4 opacity-80" aria-hidden />
											View giveaway
										</MenuRow>
									</Link>
								</DropdownMenu.Item>
								<DropdownMenu.Item asChild>
									<Link href={props.entrantsHref} prefetch={false}>
										<MenuRow>
											<Users className="h-4 w-4 opacity-80" aria-hidden />
											{adminEntrantsButtonLabel(g, "menu")}
										</MenuRow>
									</Link>
								</DropdownMenu.Item>
								<DropdownMenu.Separator />
								<DropdownMenu.Item
									color="red"
									onSelect={(e) => {
										e.preventDefault();
										setDeleteError(null);
										setDeleteOpen(true);
									}}
								>
									<MenuRow>
										<Trash2 className="h-4 w-4 opacity-80" aria-hidden />
										Delete giveaway
									</MenuRow>
								</DropdownMenu.Item>
							</DropdownMenu.Content>
						</DropdownMenu.Root>
					) : null}
				</div>

				<p className="mt-2 line-clamp-2 text-[13.5px] leading-relaxed text-gray-600 dark:text-gray-400">
					{g.description}
				</p>

				{g.requiredPassId ? (
					<div className="mt-4 mb-4 max-w-full">
						<Badge
							variant="soft"
							color="gray"
							size="1"
							className="inline-flex max-w-full items-center gap-1.5 py-1 pl-1.5 pr-2.5 font-normal normal-case tracking-normal"
						>
							<Ticket className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
							<span className="truncate">
								{g.requiredPassTitle ?? "Pass or membership required"}
							</span>
						</Badge>
					</div>
				) : null}

				{/* Footer */}
				<div className="mt-auto flex flex-col gap-3 border-t border-black/10 pt-3.5 dark:border-white/[0.08]">
					{/* Meta row */}
					<div className="flex items-center justify-between">
						<div className="flex flex-col gap-0.5">
							<span className="text-[10.5px] font-medium uppercase tracking-widest text-black/40 dark:text-white/30">
								Ends
							</span>
							<span className="text-[13px] font-medium text-gray-700 dark:text-gray-300">
								{formatGiveawayEndsReadable(g.endTime)}
							</span>
						</div>
						<div className="h-7 w-px bg-black/[0.08] dark:bg-white/[0.08]" aria-hidden />
						<div className="flex flex-col items-end gap-0.5">
							<span className="text-[10.5px] font-medium uppercase tracking-widest text-black/40 dark:text-white/30">
								Entrants
							</span>
							<span className="tabular-nums text-[13px] font-medium text-gray-700 dark:text-gray-300">
								{entrantCount.toLocaleString()}
							</span>
						</div>
					</div>

					{isAdmin ? (
						<div className="flex flex-col gap-2">
							<Button asChild variant="surface" size="2" className="w-full">
								<Link
									href={props.entrantsHref}
									className="inline-flex w-full items-center justify-center gap-2"
								>
									{g.status === "completed" ? (
										<Trophy className="h-4 w-4 shrink-0" aria-hidden />
									) : (
										<Users className="h-4 w-4 shrink-0" aria-hidden />
									)}
									{adminEntrantsButtonLabel(g)}
								</Link>
							</Button>
							{giveawayAcceptsEntries(g) ? (
								<Text size="1" color="gray" className="text-center leading-snug">
									Admins can&apos;t enter giveaways they manage.
								</Text>
							) : null}
						</div>
					) : giveawayAcceptsEntries(g) ? (
						g.entered ? (
							<Button asChild variant="surface" size="2" className="w-full">
								<Link
									href={props.detailHref}
									className="inline-flex w-full items-center justify-center gap-2"
								>
									<CheckCircle className="h-4 w-4 shrink-0" aria-hidden />
									You&apos;re entered
								</Link>
							</Button>
						) : (
							<Button asChild variant="classic" color="orange" size="2" className="w-full">
								<Link
									href={props.detailHref}
									className="inline-flex w-full items-center justify-center gap-2"
								>
									<Ticket className="h-4 w-4 shrink-0" aria-hidden />
									Enter giveaway
								</Link>
							</Button>
						)
					) : isWinner ? (
						<Button asChild variant="classic" color="green" size="2" className="w-full">
							<Link
								href={props.detailHref}
								className="inline-flex w-full items-center justify-center gap-2"
							>
								<Trophy className="h-4 w-4 shrink-0" aria-hidden />
								You won
							</Link>
						</Button>
					) : g.status === "completed" ? (
						<Button asChild variant="surface" size="2" className="w-full">
							<Link
								href={props.detailHref}
								className="inline-flex w-full items-center justify-center gap-2"
							>
								You lost
							</Link>
						</Button>
					) : (
						<Button asChild variant="surface" size="2" className="w-full">
							<Link
								href={props.detailHref}
								className="inline-flex w-full items-center justify-center gap-2"
							>
								{closedGiveawayMessage(g.status)}
							</Link>
						</Button>
					)}
				</div>
			</div>
			{props.access === "admin" ? (
				<AlertDialog.Root
					open={deleteOpen}
					onOpenChange={(open) => {
						if (deleteBusy && !open) return;
						setDeleteOpen(open);
						if (!open) setDeleteError(null);
					}}
				>
					<AlertDialog.Content size="2" style={{ maxWidth: 420 }}>
						<AlertDialog.Title>Delete giveaway?</AlertDialog.Title>
						<AlertDialog.Description>
							<span className="font-medium text-gray-200">{g.title}</span> and all{" "}
							{entrantCount.toLocaleString()} entrant{entrantCount === 1 ? "" : "s"} will be
							permanently removed. This cannot be undone.
						</AlertDialog.Description>
						{deleteError ? (
							<Text size="2" color="red" className="mt-3">
								{deleteError}
							</Text>
						) : null}
						<div className="mt-5 flex flex-wrap justify-end gap-2">
							<AlertDialog.Cancel>
								<Button variant="soft" color="gray" size="2" type="button" disabled={deleteBusy}>
									Cancel
								</Button>
							</AlertDialog.Cancel>
							<Button
								variant="classic"
								color="red"
								size="2"
								type="button"
								disabled={deleteBusy}
								onClick={() => void handleDeleteConfirm()}
							>
								{deleteBusy ? (
									<>
										<Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
										Deleting…
									</>
								) : (
									"Delete giveaway"
								)}
							</Button>
						</div>
					</AlertDialog.Content>
				</AlertDialog.Root>
			) : null}
		</div>
	);
}