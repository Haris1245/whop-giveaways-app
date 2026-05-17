import { db } from "@/db";
import { entrantTable, giveawayTable } from "@/db/schema";
import { verifyUser } from "@/lib/authentication";
import {
	countActiveGiveawaysForExperience,
	getCompanyPlanType,
} from "@/lib/plan-access";
import { ensureGiveawayExpiryScheduler } from "@/lib/giveaway-expiry-scheduler";
import { syncPastDueGiveaways } from "@/lib/expire-giveaways";
import { getPlanLimits, normalizeSecurityForPlan } from "@/lib/plans";
import { whopSdk } from "@/lib/whop-sdk";
import { and, count, desc, eq, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

function parseBool(raw: unknown, defaultValue: boolean): boolean {
	if (typeof raw === "boolean") return raw;
	if (raw === "true" || raw === 1) return true;
	if (raw === "false" || raw === 0) return false;
	return defaultValue;
}

export async function GET(req: NextRequest) {
	const experienceId = req.nextUrl.searchParams.get("experienceId");
	if (!experienceId) {
		return NextResponse.json({ error: "Missing experienceId" }, { status: 400 });
	}

	try {
		const { userId } = await verifyUser(experienceId, undefined, req.nextUrl.searchParams);

		ensureGiveawayExpiryScheduler();
		await syncPastDueGiveaways(experienceId);

		const rows = await db
			.select()
			.from(giveawayTable)
			.where(eq(giveawayTable.experienceId, experienceId))
			.orderBy(desc(giveawayTable.createdAt));

		const ids = rows.map((r) => r.id);
		if (ids.length === 0) {
			return NextResponse.json({ giveaways: [] });
		}

		const countRows = await db
			.select({
				giveawayId: entrantTable.giveawayId,
				n: count(),
			})
			.from(entrantTable)
			.where(inArray(entrantTable.giveawayId, ids))
			.groupBy(entrantTable.giveawayId);

		const countById = new Map(countRows.map((c) => [c.giveawayId, Number(c.n)]));

		const enteredRows = await db
			.select({ giveawayId: entrantTable.giveawayId })
			.from(entrantTable)
			.where(and(eq(entrantTable.userId, userId), inArray(entrantTable.giveawayId, ids)));

		const enteredSet = new Set(enteredRows.map((r) => r.giveawayId));

		const passTitleById = new Map<string, string>();
		const needsPassTitles = rows.some((r) => r.requiredPassId != null && r.requiredPassId !== "");
		if (needsPassTitles) {
			try {
				const experience = await whopSdk.experiences.listAccessPassesForExperience({
					experienceId,
				});
				for (const p of experience?.accessPasses ?? []) {
					if (typeof p.id === "string" && p.id !== "") {
						const title = typeof p.title === "string" && p.title.trim() !== "" ? p.title.trim() : null;
						passTitleById.set(p.id, title ?? p.id);
					}
				}
			} catch {
				// Pass title is optional UI; list still succeeds.
			}
		}

		const giveaways = rows.map((row) => {
			const passId = row.requiredPassId;
			const requiredPassTitle =
				passId != null && passId !== "" ? passTitleById.get(passId) ?? null : null;
			return {
				...row,
				entrantCount: countById.get(row.id) ?? 0,
				entered: enteredSet.has(row.id),
				requiredPassTitle,
				isWinner:
					row.status === "completed" &&
					row.winnerUserId != null &&
					row.winnerUserId === userId,
			};
		});

		return NextResponse.json({ giveaways });
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : "Unauthorized";
		const status =
			msg.includes("does not have access") || msg.includes("no_access") ? 403 : 401;
		return NextResponse.json({ error: msg }, { status });
	}
}

export async function POST(req: NextRequest) {
	let body: Record<string, unknown>;
	try {
		body = await req.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
	}

	const experienceId = typeof body.experienceId === "string" ? body.experienceId : null;
	if (!experienceId) {
		return NextResponse.json({ error: "Missing experienceId" }, { status: 400 });
	}

	try {
		await verifyUser(experienceId, "admin", req.nextUrl.searchParams);
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : "Forbidden";
		return NextResponse.json({ error: msg }, { status: 403 });
	}

	const title = typeof body.title === "string" ? body.title.trim() : "";
	const description =
		typeof body.description === "string" ? body.description.trim() : "";
	const rewardText =
		typeof body.rewardText === "string" ? body.rewardText.trim() : undefined;
	const requiredPassId =
		typeof body.requiredPassId === "string" && body.requiredPassId.trim() !== ""
			? body.requiredPassId.trim()
			: null;
	const minAccountAgeDays =
		typeof body.minAccountAgeDays === "number" && Number.isFinite(body.minAccountAgeDays)
			? Math.max(0, Math.floor(body.minAccountAgeDays))
			: 0;

	const enforceIpChecks = parseBool(body.enforceIpChecks, false);
	const enforceAccountAge = parseBool(body.enforceAccountAge, false);

	const coverImageUrlRaw = body.coverImageUrl;
	let coverImageUrl: string | null = null;
	if (typeof coverImageUrlRaw === "string" && coverImageUrlRaw.trim() !== "") {
		coverImageUrl = coverImageUrlRaw.trim();
	}

	if (!title || !description) {
		return NextResponse.json(
			{ error: "title and description are required" },
			{ status: 400 },
		);
	}

	const endRaw = body.endTime;
	let endTime: Date | null = null;
	if (typeof endRaw === "string" && endRaw.trim() !== "") {
		endTime = new Date(endRaw);
	}
	if (!endTime || Number.isNaN(endTime.getTime())) {
		return NextResponse.json({ error: "Valid endTime (ISO datetime) required" }, { status: 400 });
	}

	if (rewardText == null || rewardText.length === 0) {
		return NextResponse.json({ error: "rewardText is required" }, { status: 400 });
	}

	if (enforceAccountAge && minAccountAgeDays < 1) {
		return NextResponse.json(
			{
				error:
					"When minimum account age is enabled, set days to at least 1.",
			},
			{ status: 400 },
		);
	}

	let companyId: string;
	try {
		const experience = await whopSdk.experiences.getExperience({ experienceId });
		if (!experience?.company?.id) {
			return NextResponse.json(
				{ error: "Could not resolve company for experience" },
				{ status: 404 },
			);
		}
		companyId = experience.company.id;
	} catch {
		return NextResponse.json({ error: "Could not load experience" }, { status: 502 });
	}

	const planType = await getCompanyPlanType(companyId);
	const limits = getPlanLimits(planType);

	if (limits.maxConcurrentActiveGiveaways != null) {
		const activeCount = await countActiveGiveawaysForExperience(experienceId);
		if (activeCount >= limits.maxConcurrentActiveGiveaways) {
			return NextResponse.json(
				{
					error:
						"Free plan allows one active giveaway at a time. End or complete your current giveaway, or upgrade to Pro.",
				},
				{ status: 403 },
			);
		}
	}

	const security = normalizeSecurityForPlan(
		planType,
		enforceIpChecks,
		enforceAccountAge,
		minAccountAgeDays,
	);

	if (security.enforceAccountAge && security.minAccountAgeDays < 1) {
		return NextResponse.json(
			{
				error:
					"When minimum account age is enabled, set days to at least 1.",
			},
			{ status: 400 },
		);
	}

	const insert = await db
		.insert(giveawayTable)
		.values({
			experienceId,
			companyId,
			title,
			description,
			coverImageUrl,
			rewardText,
			requiredPassId,
			minAccountAgeDays: security.minAccountAgeDays,
			enforceIpChecks: security.enforceIpChecks,
			enforceAccountAge: security.enforceAccountAge,
			status: "active",
			endTime,
			updatedAt: new Date(),
		})
		.returning();

	const created = insert[0];
	if (!created) {
		return NextResponse.json({ error: "Insert failed" }, { status: 500 });
	}

	return NextResponse.json({ giveaway: created }, { status: 201 });
}
