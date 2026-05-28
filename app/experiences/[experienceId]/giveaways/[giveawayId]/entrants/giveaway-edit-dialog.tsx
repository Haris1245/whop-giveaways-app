"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import {
	Accordion,
	Badge,
	Button,
	Dialog,
	Heading,
	ScrollArea,
	Separator,
	Text,
	TextArea,
	TextField,
	Spinner,
	Select,
	Switch,
} from "frosted-ui";
import { useIframeSdk } from "@whop/react/iframe";
import { ImageIcon, Loader2, Pencil, X } from "lucide-react";
import { createSubscription } from "@/app/actions/create-checkout";
import {
	getWhopDevUserTokenFromBrowser,
	whopDevAwareFetch,
	withWhopDevUserTokenQuery,
} from "@/lib/append-whop-dev-user-token";
import { formatCheckoutError } from "@/lib/checkout-errors";
import { plans } from "@/lib/plans";
import type { AccessPassOption } from "../../../giveaway-hub-types";
import { NONE_PASS_VALUE } from "../../../giveaway-hub-types";

function isoToDatetimeLocal(iso: string): string {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return "";
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function rewardSummaryLine(rewardText: string | null): string {
	const tRaw = rewardText?.trim();
	if (!tRaw) return "No prize details saved";
	const tDisplay = tRaw.length > 120 ? `${tRaw.slice(0, 117)}…` : tRaw;
	return tDisplay;
}

export function GiveawayEditDialog(props: {
	experienceId: string;
	whopDevUserToken?: string | null;
	giveawayId: string;
	initialTitle: string;
	initialDescription: string;
	initialCoverImageUrl: string | null;
	initialEndTimeIso: string;
	initialRequiredPassId: string | null;
	initialEnforceIpChecks: boolean;
	initialEnforceAccountAge: boolean;
	initialMinAccountAgeDays: number;
	rewardText: string | null;
}) {
	const router = useRouter();
	const [open, setOpen] = useState(false);

	const [title, setTitle] = useState(props.initialTitle);
	const [description, setDescription] = useState(props.initialDescription);
	const [endTimeLocal, setEndTimeLocal] = useState(() => isoToDatetimeLocal(props.initialEndTimeIso));

	const coverInputRef = React.useRef<HTMLInputElement>(null);
	const [coverFile, setCoverFile] = useState<File | null>(null);
	const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
	const [clearRemoteCover, setClearRemoteCover] = useState(false);

	const [requiredPassId, setRequiredPassId] = useState(
		props.initialRequiredPassId?.trim() ?? "",
	);
	const [passes, setPasses] = useState<AccessPassOption[]>([]);
	const [passesLoading, setPassesLoading] = useState(false);
	const [passesError, setPassesError] = useState<string | null>(null);

	const [enforceIpChecks, setEnforceIpChecks] = useState(props.initialEnforceIpChecks);
	const [enforceAccountAge, setEnforceAccountAge] = useState(props.initialEnforceAccountAge);
	const [minAccountAgeDays, setMinAccountAgeDays] = useState(
		String(props.initialMinAccountAgeDays > 0 ? props.initialMinAccountAgeDays : 7),
	);
	const [securityFeatures, setSecurityFeatures] = useState(false);
	const [upgradingPro, setUpgradingPro] = useState(false);
	const [upgradeError, setUpgradeError] = useState<string | null>(null);

	const [submitting, setSubmitting] = useState(false);
	const [submitError, setSubmitError] = useState<string | null>(null);

	const iframeSdk = useIframeSdk();
	const billingHref = withWhopDevUserTokenQuery(
		`/experiences/${props.experienceId}/billing`,
		props.whopDevUserToken,
	);

	async function handleUpgradeToPro() {
		setUpgradingPro(true);
		setUpgradeError(null);
		try {
			const checkoutSession = await createSubscription(
				props.experienceId,
				plans.pro.planId,
				props.whopDevUserToken ?? getWhopDevUserTokenFromBrowser(),
			);
			const result = await iframeSdk.inAppPurchase(checkoutSession!);
			if (result.status === "ok") {
				setSecurityFeatures(true);
			} else {
				setUpgradeError(formatCheckoutError(result.error));
			}
		} catch (err) {
			setUpgradeError(formatCheckoutError(err, "Could not start checkout."));
		} finally {
			setUpgradingPro(false);
		}
	}

	useEffect(() => {
		if (!open) return;
		setTitle(props.initialTitle);
		setDescription(props.initialDescription);
		setEndTimeLocal(isoToDatetimeLocal(props.initialEndTimeIso));
		setCoverFile(null);
		setCoverPreviewUrl((prev) => {
			if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
			return null;
		});
		if (coverInputRef.current) coverInputRef.current.value = "";
		setClearRemoteCover(false);
		setRequiredPassId(props.initialRequiredPassId?.trim() ?? "");
		setEnforceIpChecks(props.initialEnforceIpChecks);
		setEnforceAccountAge(props.initialEnforceAccountAge);
		setMinAccountAgeDays(
			String(props.initialMinAccountAgeDays > 0 ? props.initialMinAccountAgeDays : 7),
		);
		setSubmitError(null);
		setUpgradeError(null);
	}, [
		open,
		props.initialTitle,
		props.initialDescription,
		props.initialEndTimeIso,
		props.initialRequiredPassId,
		props.initialEnforceIpChecks,
		props.initialEnforceAccountAge,
		props.initialMinAccountAgeDays,
	]);

	useEffect(() => {
		if (!open) return;

		let cancelled = false;

		async function loadPlanLimits() {
			try {
				const res = await whopDevAwareFetch(
					`/api/plan-limits/${encodeURIComponent(props.experienceId)}`,
				);
				const data = await res.json();
				if (!res.ok || cancelled) return;
				const hasSecurity = Boolean(data.securityFeatures);
				setSecurityFeatures(hasSecurity);
				if (!hasSecurity) {
					setEnforceIpChecks(false);
					setEnforceAccountAge(false);
				}
			} catch {
				if (!cancelled) setSecurityFeatures(false);
			}
		}

		async function loadPasses() {
			setPassesLoading(true);
			setPassesError(null);
			try {
				const res = await whopDevAwareFetch(
					`/api/access-passes?experienceId=${encodeURIComponent(props.experienceId)}`,
				);
				const data = await res.json();
				if (!res.ok) {
					if (!cancelled) setPassesError(data.error ?? "Could not load passes");
					if (!cancelled) setPasses([]);
					return;
				}
				if (!cancelled) setPasses((data.passes ?? []) as AccessPassOption[]);
			} catch {
				if (!cancelled) {
					setPassesError("Could not load passes");
					setPasses([]);
				}
			} finally {
				if (!cancelled) setPassesLoading(false);
			}
		}

		void loadPlanLimits();
		void loadPasses();
		return () => {
			cancelled = true;
		};
	}, [open, props.experienceId]);

	const displayedCoverSrc = coverPreviewUrl
		? coverPreviewUrl
		: !clearRemoteCover && props.initialCoverImageUrl?.trim()
			? props.initialCoverImageUrl.trim()
			: null;

	const submitPatch = async (e: React.FormEvent) => {
		e.preventDefault();
		setSubmitting(true);
		setSubmitError(null);

		const minDays = Number.parseInt(minAccountAgeDays, 10) || 0;
		if (enforceAccountAge && minDays < 1) {
			setSubmitError("With minimum account age on, use at least 1 day.");
			setSubmitting(false);
			return;
		}

		const endIso =
			endTimeLocal.trim() !== "" ? new Date(endTimeLocal).toISOString() : "";
		if (!endIso || Number.isNaN(new Date(endIso).getTime())) {
			setSubmitError("Choose a valid end date and time.");
			setSubmitting(false);
			return;
		}

		let resolvedCoverUrl: string | null;
		if (coverFile) {
			const fd = new FormData();
			fd.set("experienceId", props.experienceId);
			fd.set("file", coverFile);
			const up = await whopDevAwareFetch("/api/giveaways/cover", {
				method: "POST",
				body: fd,
			});
			const upData = await up.json();
			if (!up.ok) {
				setSubmitError(upData.error ?? "Cover image upload failed");
				setSubmitting(false);
				return;
			}
			if (typeof upData.url !== "string") {
				setSubmitError("Cover upload did not return a URL.");
				setSubmitting(false);
				return;
			}
			resolvedCoverUrl = upData.url.trim();
		} else if (clearRemoteCover) {
			resolvedCoverUrl = null;
		} else {
			resolvedCoverUrl = props.initialCoverImageUrl?.trim() ?? null;
		}

		try {
			const res = await whopDevAwareFetch(`/api/giveaways/${props.giveawayId}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					experienceId: props.experienceId,
					title: title.trim(),
					description: description.trim(),
					coverImageUrl: resolvedCoverUrl,
					requiredPassId: requiredPassId.trim() === "" ? null : requiredPassId.trim(),
					minAccountAgeDays: enforceAccountAge ? minDays : 0,
					enforceIpChecks,
					enforceAccountAge,
					endTime: endIso,
				}),
			});
			const data = await res.json();
			if (!res.ok) {
				setSubmitError(data.error ?? "Could not save changes");
				setSubmitting(false);
				return;
			}
			setOpen(false);
			router.refresh();
		} catch {
			setSubmitError("Network error — try again.");
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<Dialog.Root
			open={open}
			onOpenChange={(o) => {
				setOpen(o);
				if (!o) setSubmitError(null);
			}}
		>
			<Button variant="soft" color="gray" size="2" type="button" onClick={() => setOpen(true)}>
				<Pencil className="h-3.5 w-3.5 shrink-0" aria-hidden />
				Edit
			</Button>
			<Dialog.Content
				size="4"
				style={{ width: "min(540px, calc(100vw - 2rem))", maxWidth: "none" }}
				className="flex max-h-[min(92vh,calc(100vh-32px))] flex-col gap-0 p-0 !overflow-hidden"
			>
				<form onSubmit={submitPatch} className="flex min-h-0 flex-1 flex-col overflow-hidden">
					<ScrollArea scrollbars="vertical" className="min-h-0 flex-1">
						<div className="flex flex-col gap-5 px-4 py-4">
							<div className="border-b border-black/10 pb-4 pr-8 dark:border-white/10">
								<Dialog.Title className="!mb-2 text-balance">
									Edit giveaway
								</Dialog.Title>
								<Dialog.Description size="2" className="!mb-0 text-gray-700 dark:text-gray-400">
									Adjust how this giveaway looks and behaves — prize details can’t be changed
									here.
								</Dialog.Description>
							</div>
							{submitError ? (
								<Text
									size="2"
									color="red"
									as="div"
									className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5"
								>
									{submitError}
								</Text>
							) : null}

							<section className="flex flex-col gap-3" aria-labelledby="edit-reward-heading">
								<Heading
									as="h3"
									size="4"
									weight="semi-bold"
									id="edit-reward-heading"
									className="text-gray-900 dark:text-gray-100"
								>
									Reward
								</Heading>
								<Text size="1" color="gray">
									Locked after creation — shown to members on the giveaway page.
								</Text>
								<Text size="2" weight="medium" className="text-gray-900 dark:text-gray-50">
									{rewardSummaryLine(props.rewardText)}
								</Text>
							</section>

							<Separator size="4" />

							<section aria-labelledby="overview-heading" className="flex flex-col gap-3">
								<Heading as="h3" size="4" weight="semi-bold" id="overview-heading" className="text-gray-900 dark:text-gray-100">
									Overview
								</Heading>
								<div className="flex flex-col gap-4">
									<div className="flex flex-col gap-2">
										<Text as="label" size="2" weight="medium" htmlFor="edit-g-title">
											Title
										</Text>
										<TextField.Root id="edit-g-title" size="2">
											<TextField.Input
												required
												value={title}
												onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
													setTitle(e.target.value)
												}
												placeholder="Giveaway headline"
											/>
										</TextField.Root>
									</div>
									<div className="flex flex-col gap-2">
										<Text as="label" size="2" weight="medium" htmlFor="edit-g-desc">
											Description
										</Text>
										<TextArea
											id="edit-g-desc"
											required
											value={description}
											onChange={(e) => setDescription(e.target.value)}
											rows={4}
											placeholder="What members see before they enter."
										/>
									</div>
								</div>
							</section>

							<Separator size="4" />

							<section className="flex flex-col gap-3" aria-labelledby="cover-heading">
								<Heading as="h3" size="4" weight="semi-bold" id="cover-heading" className="text-gray-900 dark:text-gray-100">
									Cover
								</Heading>
								<Text size="1" color="gray">
									JPEG · PNG · WebP · GIF · max 5MB
								</Text>
								<input
									ref={coverInputRef}
									type="file"
									accept="image/jpeg,image/png,image/webp,image/gif"
									className="sr-only"
									tabIndex={-1}
									id="edit-g-cover-file"
									aria-label="Upload or replace giveaway cover image"
									onChange={(e) => {
										const f = e.target.files?.[0];
										if (!f) return;
										setCoverFile(f);
										setClearRemoteCover(false);
										setCoverPreviewUrl((prev) => {
											if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
											return URL.createObjectURL(f);
										});
									}}
								/>
								<div className="grid gap-4 sm:grid-cols-[minmax(140px,160px)_1fr] sm:items-start">
									{displayedCoverSrc ? (
										<div className="relative aspect-video w-full max-w-[200px] overflow-hidden rounded-xl border border-black/10 bg-gray-100 dark:border-white/10 dark:bg-gray-950 sm:mx-0 mx-auto">
											<Image
												src={displayedCoverSrc}
												alt=""
												fill
												className="object-cover"
												unoptimized={displayedCoverSrc.startsWith("blob:")}
											/>
										</div>
									) : (
										<button
											type="button"
											onClick={() => coverInputRef.current?.click()}
											className="flex aspect-video max-h-28 max-w-[200px] w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-black/20 bg-black/[0.02] px-3 text-center text-gray-600 transition-colors hover:border-black/30 hover:bg-black/[0.04] hover:text-gray-700 dark:border-white/15 dark:bg-white/[0.02] dark:text-gray-500 dark:hover:border-white/25 dark:hover:bg-white/[0.04] dark:hover:text-gray-400 sm:mx-0 mx-auto"
										>
											<ImageIcon className="h-6 w-6 opacity-50" aria-hidden />
											<Text size="1">No cover</Text>
										</button>
									)}
									<div className="flex min-w-0 flex-col gap-2">
										<div className="flex flex-wrap gap-2">
											<Button
												type="button"
												variant="surface"
												size="2"
												onClick={() => coverInputRef.current?.click()}
											>
												<ImageIcon className="h-4 w-4 shrink-0" aria-hidden />
												{displayedCoverSrc ? "Replace" : "Upload"}
											</Button>
											{displayedCoverSrc ? (
												<Button
													type="button"
													variant="ghost"
													size="2"
													color="gray"
													onClick={() => {
														if (coverPreviewUrl?.startsWith("blob:")) {
															URL.revokeObjectURL(coverPreviewUrl);
														}
														setCoverFile(null);
														setCoverPreviewUrl(null);
														if (coverInputRef.current) coverInputRef.current.value = "";
														setClearRemoteCover(true);
													}}
												>
													<X className="h-4 w-4 shrink-0" aria-hidden />
													Remove
												</Button>
											) : null}
										</div>
										<Text size="1" color="gray">
											Show on giveaway cards in the hub. Leave empty if you prefer the default tile.
										</Text>
									</div>
								</div>
							</section>

							<Separator size="4" />

							<section className="flex flex-col gap-3" aria-labelledby="schedule-heading">
								<Heading as="h3" size="4" weight="semi-bold" id="schedule-heading" className="text-gray-900 dark:text-gray-100">
									Schedule
								</Heading>
								<div className="flex flex-col gap-2">
									<Text as="label" size="2" weight="medium" htmlFor="edit-end">
										Ends at
									</Text>
									<TextField.Root id="edit-end" size="2">
										<TextField.Input
											required
											type="datetime-local"
											value={endTimeLocal}
											onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
												setEndTimeLocal(e.target.value)
											}
										/>
									</TextField.Root>
									<Text size="1" color="gray">
										Local timezone on your device. Members see the countdown from this end time.
									</Text>
								</div>
							</section>

							<Separator size="4" />

							<section className="flex flex-col gap-3" aria-labelledby="access-heading">
								<Heading as="h3" size="4" weight="semi-bold" id="access-heading" className="text-gray-900 dark:text-gray-100">
									Who can enter
								</Heading>
								<Text size="1" color="gray" id="edit-pass-hint">
									Optional Whop pass — or leave open to anyone with hub access.
								</Text>
								{passesLoading ? (
									<div
										className="flex h-12 items-center gap-2 rounded-xl border border-black/10 bg-black/[0.02] px-3 dark:border-white/10 dark:bg-white/[0.03]"
										aria-busy="true"
									>
										<Spinner loading size="1" />
										<Text size="2" color="gray">
											Loading passes…
										</Text>
									</div>
								) : passesError ? (
									<Text size="2" color="amber" as="div">
										{passesError}. Close and reopen this dialog to retry.
									</Text>
								) : (
									<Select.Root
										size="3"
										value={
											requiredPassId.trim() === ""
												? NONE_PASS_VALUE
												: requiredPassId.trim()
										}
										onValueChange={(value) =>
											setRequiredPassId(value === NONE_PASS_VALUE ? "" : value)
										}
									>
										<Select.Trigger
											className="w-full min-w-0"
											variant="surface"
											placeholder="Open to everyone with experience access"
											aria-describedby="edit-pass-hint"
										/>
										<Select.Content position="popper">
											<Select.Item value={NONE_PASS_VALUE}>
												No pass required
											</Select.Item>
											{passes.map((p) => (
												<Select.Item key={p.id} value={p.id}>
													{p.title}
												</Select.Item>
											))}
										</Select.Content>
									</Select.Root>
								)}
							</section>

							<Separator size="4" />

							<section className="pb-0.5" aria-labelledby="edit-security-rules-heading">
								<Accordion.Root type="single" collapsible>
									<Accordion.Item
										value="security"
										className="overflow-hidden rounded-xl border border-black/10 bg-black/[0.02] dark:border-white/10 dark:bg-white/[0.03]"
									>
										<Accordion.Trigger
											id="edit-security-rules-heading"
											className="w-full px-4 py-3 text-left hover:bg-black/[0.03] dark:hover:bg-white/[0.03]"
										>
											<div className="flex w-full items-center justify-between gap-3">
												<Text size="3" weight="semi-bold" className="text-gray-900 dark:text-gray-100">
													Security features
												</Text>
												{!securityFeatures ? (
													<Badge variant="soft" color="gray" size="1" className="shrink-0">
														Pro
													</Badge>
												) : null}
											</div>
										</Accordion.Trigger>
										<Accordion.Content>
											<div className="flex flex-col gap-4 border-t border-black/10 px-4 pb-4 pt-3 dark:border-white/10">
												{!securityFeatures ? (
													<div className="flex flex-col gap-3">
														<Text size="2" color="gray" className="leading-relaxed">
															Duplicate IP checks and minimum Whop account age. Pro is $
															{plans.pro.priceLifetime} lifetime.
														</Text>
														<div className="flex flex-wrap items-center gap-2">
															<Button
																type="button"
																variant="classic"
																color="orange"
																size="2"
																disabled={upgradingPro}
																onClick={() => void handleUpgradeToPro()}
															>
																{upgradingPro ? (
																	<>
																		<Loader2
																			className="h-4 w-4 shrink-0 animate-spin"
																			aria-hidden
																		/>
																		Checkout…
																	</>
																) : (
																	"Upgrade to Pro"
																)}
															</Button>
															<Link
																href={billingHref}
																className="px-2 py-1.5 text-sm text-gray-400 transition-colors hover:text-gray-200"
																onClick={() => setOpen(false)}
															>
																View plans
															</Link>
														</div>
														{upgradeError ? (
															<Text size="1" color="red">
																{upgradeError}
															</Text>
														) : null}
													</div>
												) : (
													<>
														<div className="flex items-center justify-between gap-3">
															<div className="min-w-0 flex flex-col gap-0.5">
																<Text size="2" id="edit-ip-label" weight="medium">
																	Duplicate IP checks
																</Text>
																<Text size="1" color="gray">
																	Block the same IP from entering twice.
																</Text>
															</div>
															<Switch
																checked={enforceIpChecks}
																onCheckedChange={setEnforceIpChecks}
																aria-labelledby="edit-ip-label"
															/>
														</div>
														<div className="flex flex-col gap-3 border-t border-black/10 pt-4 dark:border-white/10">
															<div className="flex items-center justify-between gap-3">
																<div className="min-w-0 flex flex-col gap-0.5">
																	<Text size="2" id="edit-age-enf-label" weight="medium">
																		Minimum Whop account age
																	</Text>
																	<Text size="1" color="gray">
																		Require accounts older than your threshold.
																	</Text>
																</div>
																<Switch
																	checked={enforceAccountAge}
																	onCheckedChange={setEnforceAccountAge}
																	aria-labelledby="edit-age-enf-label"
																/>
															</div>
															<div className="flex flex-col gap-2">
																<Text as="label" size="2" weight="medium" htmlFor="edit-age">
																	Minimum age (days)
																</Text>
																<TextField.Root id="edit-age" size="2">
																	<TextField.Input
																		type="number"
																		min={enforceAccountAge ? 1 : 0}
																		disabled={!enforceAccountAge}
																		value={minAccountAgeDays}
																		onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
																			setMinAccountAgeDays(e.target.value)
																		}
																	/>
																</TextField.Root>
															</div>
														</div>
													</>
												)}
											</div>
										</Accordion.Content>
									</Accordion.Item>
								</Accordion.Root>
							</section>
						</div>
					</ScrollArea>

					<div className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-black/10 px-4 py-3 dark:border-white/10">
						<Text
							size="1"
							color="gray"
							className="order-last w-full sm:order-none sm:w-auto"
						>
							Reward changes aren&apos;t available here yet.
						</Text>
						<div className="ml-auto flex flex-wrap gap-2">
							<Button variant="ghost" color="gray" type="button" disabled={submitting} onClick={() => setOpen(false)}>
								Cancel
							</Button>
							<Button variant="classic" color="orange" type="submit" disabled={submitting}>
								{submitting ? (
									<>
										<Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
										Saving…
									</>
								) : (
									"Save changes"
								)}
							</Button>
						</div>
					</div>
				</form>
			</Dialog.Content>
		</Dialog.Root>
	);
}
