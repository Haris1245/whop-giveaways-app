"use client";

import Image from "next/image";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import {
	Accordion,
	Badge,
	Button,
	Card,
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
import { ImageIcon, Loader2, X } from "lucide-react";
import { createSubscription } from "@/app/actions/create-checkout";
import {
	getWhopDevUserTokenFromBrowser,
	whopDevAwareFetch,
	withWhopDevUserTokenQuery,
} from "@/lib/append-whop-dev-user-token";
import { formatCheckoutError } from "@/lib/checkout-errors";
import { plans } from "@/lib/plans";
import type { AccessPassOption } from "./giveaway-hub-types";
import { NONE_PASS_VALUE } from "./giveaway-hub-types";

export function CreateGiveawayDialog(props: {
	experienceId: string;
	whopDevUserToken?: string | null;
	trigger: React.ReactNode;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onCreated: () => Promise<void>;
}) {
	const [submitting, setSubmitting] = useState(false);
	const [submitError, setSubmitError] = useState<string | null>(null);

	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [coverFile, setCoverFile] = useState<File | null>(null);
	const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
	const coverInputRef = React.useRef<HTMLInputElement>(null);
	const [rewardText, setRewardText] = useState("");
	const [requiredPassId, setRequiredPassId] = useState("");
	const [passes, setPasses] = useState<AccessPassOption[]>([]);
	const [passesLoading, setPassesLoading] = useState(false);
	const [passesError, setPassesError] = useState<string | null>(null);
	const [enforceIpChecks, setEnforceIpChecks] = useState(false);
	const [enforceAccountAge, setEnforceAccountAge] = useState(false);
	const [minAccountAgeDays, setMinAccountAgeDays] = useState("7");
	const [endTimeLocal, setEndTimeLocal] = useState("");
	const [securityFeatures, setSecurityFeatures] = useState(false);
	const [atGiveawayLimit, setAtGiveawayLimit] = useState(false);
	const [upgradingPro, setUpgradingPro] = useState(false);
	const [upgradeError, setUpgradeError] = useState<string | null>(null);
	const iframeSdk = useIframeSdk();
	const billingHref = withWhopDevUserTokenQuery(
		`/experiences/${props.experienceId}/billing`,
		props.whopDevUserToken,
	);

	const resetForm = () => {
		if (coverPreviewUrl?.startsWith("blob:")) {
			URL.revokeObjectURL(coverPreviewUrl);
		}
		setTitle("");
		setDescription("");
		setCoverFile(null);
		setCoverPreviewUrl(null);
		if (coverInputRef.current) coverInputRef.current.value = "";
		setRewardText("");
		setRequiredPassId("");
		setPassesError(null);
		setEnforceIpChecks(false);
		setEnforceAccountAge(false);
		setMinAccountAgeDays("7");
		setEndTimeLocal("");
		setSubmitError(null);
		setUpgradeError(null);
	};

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
				setAtGiveawayLimit(false);
			} else {
				setUpgradeError(formatCheckoutError(result.error));
			}
		} catch (err) {
			setUpgradeError(
				formatCheckoutError(err, "Could not start checkout."),
			);
		} finally {
			setUpgradingPro(false);
		}
	}

	useEffect(() => {
		if (!props.open) return;

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
				const maxConcurrent = data.maxConcurrentActiveGiveaways;
				const activeCount = Number(data.activeGiveawayCount ?? 0);
				setAtGiveawayLimit(
					maxConcurrent != null && activeCount >= maxConcurrent,
				);
			} catch {
				if (!cancelled) {
					setSecurityFeatures(false);
					setAtGiveawayLimit(false);
				}
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
					if (!cancelled) {
						setPassesError(data.error ?? "Could not load passes");
						setPasses([]);
					}
					return;
				}
				if (!cancelled) {
					setPasses((data.passes ?? []) as AccessPassOption[]);
				}
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
	}, [props.open, props.experienceId]);

	const submitCreate = async (e: React.FormEvent) => {
		e.preventDefault();
		if (atGiveawayLimit) {
			setSubmitError(
				"Free plan allows one active giveaway. End your current one or upgrade to Pro.",
			);
			return;
		}
		setSubmitting(true);
		setSubmitError(null);

		const minDays = Number.parseInt(minAccountAgeDays, 10) || 0;
		if (enforceAccountAge && minDays < 1) {
			setSubmitError("With account age checks on, set minimum days to at least 1.");
			setSubmitting(false);
			return;
		}

		const endIso =
			endTimeLocal.trim() !== "" ? new Date(endTimeLocal).toISOString() : "";

		let coverImageUrl: string | undefined;
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
			if (typeof upData.url === "string") {
				coverImageUrl = upData.url;
			}
		}

		if (coverFile && !coverImageUrl) {
			setSubmitError("Cover image upload did not return a URL.");
			setSubmitting(false);
			return;
		}

		try {
			const res = await whopDevAwareFetch("/api/giveaways", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					experienceId: props.experienceId,
					title,
					description,
					coverImageUrl,
					rewardText,
					requiredPassId: requiredPassId.trim() || undefined,
					minAccountAgeDays: enforceAccountAge ? minDays : 0,
					enforceIpChecks,
					enforceAccountAge,
					endTime: endIso,
				}),
			});
			const data = await res.json();
			if (!res.ok) {
				setSubmitError(data.error ?? "Could not create giveaway");
				setSubmitting(false);
				return;
			}
			props.onOpenChange(false);
			resetForm();
			await props.onCreated();
		} catch {
			setSubmitError("Network error — try again.");
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<Dialog.Root
			open={props.open}
			onOpenChange={(o) => {
				props.onOpenChange(o);
				if (!o) resetForm();
			}}
		>
			<Dialog.Trigger>{props.trigger}</Dialog.Trigger>
			<Dialog.Content
				size="4"
				style={{ width: "min(540px, calc(100vw - 2rem))", maxWidth: "none" }}
				className="flex max-h-[min(92vh,calc(100vh-32px))] flex-col gap-0 p-0 !overflow-hidden"
			>
				<form onSubmit={submitCreate} className="flex min-h-0 flex-1 flex-col overflow-hidden">
					<ScrollArea scrollbars="vertical" className="min-h-0 flex-1">
						<div className="flex flex-col gap-5 px-4 py-4">
							<div className="border-b border-white/[0.06] pb-4 pr-8">
								<Dialog.Title className="!mb-2 text-balance">
									Create giveaway
								</Dialog.Title>
								<Dialog.Description size="2" className="!mb-0 text-gray-400">
									Set prize details, schedule, and optional rules — members enter from the
									giveaway cards below.
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

							<section className="flex flex-col gap-3" aria-labelledby="create-overview-heading">
								<Heading
									as="h3"
									size="4"
									weight="semi-bold"
									id="create-overview-heading"
									className="text-gray-100"
								>
									Overview
								</Heading>
								<div className="flex flex-col gap-4">
									<div className="flex flex-col gap-2">
										<Text as="label" size="2" weight="medium" htmlFor="g-title">
											Title
										</Text>
										<TextField.Root id="g-title" size="2">
											<TextField.Input
												required
												value={title}
												onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
												placeholder="e.g. $100 Discord Nitro"
											/>
										</TextField.Root>
									</div>
									<div className="flex flex-col gap-2">
										<Text as="label" size="2" weight="medium" htmlFor="g-desc">
											Description
										</Text>
										<TextArea
											id="g-desc"
											required
											value={description}
											onChange={(e) => setDescription(e.target.value)}
											placeholder="What they win and how winners are notified"
											rows={4}
										/>
									</div>
								</div>
							</section>

							<Separator size="4" />

							<section className="flex flex-col gap-3" aria-labelledby="create-cover-heading">
								<Heading
									as="h3"
									size="4"
									weight="semi-bold"
									id="create-cover-heading"
									className="text-gray-100"
								>
									Cover
								</Heading>
								<Text size="1" color="gray" id="g-cover-hint">
									JPEG · PNG · WebP · GIF · max 5MB
								</Text>
								<input
									ref={coverInputRef}
									type="file"
									accept="image/jpeg,image/png,image/webp,image/gif"
									className="sr-only"
									tabIndex={-1}
									id="g-cover-file"
									aria-label="Upload giveaway cover image"
									aria-describedby="g-cover-hint"
									onChange={(e) => {
										const f = e.target.files?.[0];
										if (!f) return;
										setCoverFile(f);
										setCoverPreviewUrl((prev) => {
											if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
											return URL.createObjectURL(f);
										});
									}}
								/>
								<div className="grid gap-4 sm:grid-cols-[minmax(140px,160px)_1fr] sm:items-start">
									{coverPreviewUrl ? (
										<div className="relative aspect-video w-full max-w-[200px] overflow-hidden rounded-xl border border-white/10 bg-gray-950 sm:mx-0 mx-auto">
											<Image
												src={coverPreviewUrl}
												alt=""
												fill
												className="object-cover"
												unoptimized
											/>
										</div>
									) : (
										<button
											type="button"
											onClick={() => coverInputRef.current?.click()}
											className="flex aspect-video max-h-28 max-w-[200px] w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-3 text-center text-gray-500 transition-colors hover:border-white/25 hover:bg-white/[0.04] hover:text-gray-400 sm:mx-0 mx-auto"
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
												{coverPreviewUrl ? "Replace" : "Upload"}
											</Button>
											{coverPreviewUrl ? (
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
													}}
												>
													<X className="h-4 w-4 shrink-0" aria-hidden />
													Remove
												</Button>
											) : null}
										</div>
										<Text size="1" color="gray">
											Optional image for giveaway cards. Leave blank to use the default tile.
										</Text>
									</div>
								</div>
							</section>

							<Separator size="4" />

							<section className="flex flex-col gap-3" aria-labelledby="create-reward-heading">
								<Heading
									as="h3"
									size="4"
									weight="semi-bold"
									id="create-reward-heading"
									className="text-gray-100"
								>
									Reward
								</Heading>
								<div className="flex flex-col gap-2">
									<Text as="label" size="2" weight="medium" htmlFor="g-reward-text">
										Prize details
									</Text>
									<TextArea
										id="g-reward-text"
										required
										value={rewardText}
										onChange={(e) => setRewardText(e.target.value)}
										placeholder="What they win — license instructions, link, discount code, etc."
										rows={3}
									/>
								</div>
							</section>

							<Separator size="4" />

							<section className="flex flex-col gap-3" aria-labelledby="create-schedule-heading">
								<Heading
									as="h3"
									size="4"
									weight="semi-bold"
									id="create-schedule-heading"
									className="text-gray-100"
								>
									Schedule
								</Heading>
								<div className="flex flex-col gap-2">
									<Text as="label" size="2" weight="medium" htmlFor="g-end">
										Ends at
									</Text>
									<TextField.Root id="g-end" size="2">
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

							<section className="flex flex-col gap-3" aria-labelledby="create-access-heading">
								<Heading
									as="h3"
									size="4"
									weight="semi-bold"
									id="create-access-heading"
									className="text-gray-100"
								>
									Who can enter
								</Heading>
								<Text size="1" color="gray" id="g-pass-hint">
									Optional Whop pass — or leave open to anyone with hub access.
								</Text>
								{passesLoading ? (
									<div
										className="flex h-12 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3"
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
										value={requiredPassId.trim() === "" ? NONE_PASS_VALUE : requiredPassId.trim()}
										onValueChange={(value) =>
											setRequiredPassId(value === NONE_PASS_VALUE ? "" : value)
										}
									>
										<Select.Trigger
											className="w-full min-w-0"
											variant="surface"
											placeholder="Open to everyone with experience access"
											aria-describedby="g-pass-hint"
										/>
										<Select.Content position="popper">
											<Select.Item value={NONE_PASS_VALUE}>No pass required</Select.Item>
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

							<section className="pb-0.5" aria-labelledby="create-security-rules-heading">
								<Accordion.Root type="single" collapsible>
									<Accordion.Item
										value="security"
										className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]"
									>
										<Accordion.Trigger
											id="create-security-rules-heading"
											className="w-full px-4 py-3 text-left hover:bg-white/[0.03]"
										>
											<div className="flex w-full items-center justify-between gap-3">
												<Text size="3" weight="semi-bold" className="text-gray-100">
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
											<div className="flex flex-col gap-4 border-t border-white/[0.06] px-4 pb-4 pt-3">
												{!securityFeatures ? (
													<div className="flex flex-col gap-3">
														<Text size="2" color="gray" className="leading-relaxed">
															Duplicate IP checks and minimum Whop account age. Pro is $
															{plans.pro.priceMonthly}/month.
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
																onClick={() => props.onOpenChange(false)}
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
																<Text size="2" id="g-ip-label" weight="medium">
																	Duplicate IP checks
																</Text>
																<Text size="1" color="gray">
																	Block the same IP from entering twice.
																</Text>
															</div>
															<Switch
																checked={enforceIpChecks}
																onCheckedChange={setEnforceIpChecks}
																aria-labelledby="g-ip-label"
															/>
														</div>
														<div className="flex flex-col gap-3 border-t border-white/[0.06] pt-4">
															<div className="flex items-center justify-between gap-3">
																<div className="min-w-0 flex flex-col gap-0.5">
																	<Text size="2" id="g-age-enf-label" weight="medium">
																		Minimum Whop account age
																	</Text>
																	<Text size="1" color="gray">
																		Require accounts older than your threshold.
																	</Text>
																</div>
																<Switch
																	checked={enforceAccountAge}
																	onCheckedChange={setEnforceAccountAge}
																	aria-labelledby="g-age-enf-label"
																/>
															</div>
															<div className="flex flex-col gap-2">
																<Text as="label" size="2" weight="medium" htmlFor="g-age">
																	Minimum age (days)
																</Text>
																<TextField.Root id="g-age" size="2">
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

					<div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-white/[0.06] px-4 py-3">
						<Button
							variant="ghost"
							color="gray"
							type="button"
							disabled={submitting}
							onClick={() => props.onOpenChange(false)}
						>
							Cancel
						</Button>
						<Button
							variant="classic"
							color="orange"
							type="submit"
							disabled={submitting || atGiveawayLimit}
						>
							{submitting ? (
								<>
									<Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
									Saving…
								</>
							) : (
								"Create"
							)}
						</Button>
					</div>
				</form>
			</Dialog.Content>
		</Dialog.Root>
	);
}
