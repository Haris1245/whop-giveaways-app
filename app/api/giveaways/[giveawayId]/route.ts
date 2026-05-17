import { db } from "@/db";
import { giveawayTable } from "@/db/schema";
import { verifyUser } from "@/lib/authentication";
import { getCompanyPlanType } from "@/lib/plan-access";
import { normalizeSecurityForPlan } from "@/lib/plans";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

function parseBool(raw: unknown, defaultValue: boolean): boolean {
	if (typeof raw === "boolean") return raw;
	if (raw === "true" || raw === 1) return true;
	if (raw === "false" || raw === 0) return false;
	return defaultValue;
}

export async function PATCH(
	req: NextRequest,
	ctx: { params: Promise<{ giveawayId: string }> },
) {
	const { giveawayId } = await ctx.params;

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

	for (const k of ["rewardText"] as const) {
		if (k in body) {
			return NextResponse.json(
				{ error: "Reward fields cannot be changed via this endpoint" },
				{ status: 400 },
			);
		}
	}

	try {
		await verifyUser(experienceId, "admin", req.nextUrl.searchParams);
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : "Forbidden";
		return NextResponse.json({ error: msg }, { status: 403 });
	}

	const existingRows = await db
		.select({
			id: giveawayTable.id,
			experienceId: giveawayTable.experienceId,
			companyId: giveawayTable.companyId,
		})
		.from(giveawayTable)
		.where(and(eq(giveawayTable.id, giveawayId), eq(giveawayTable.experienceId, experienceId)))
		.limit(1);

	if (!existingRows[0]) {
		return NextResponse.json({ error: "Giveaway not found" }, { status: 404 });
	}

	const title = typeof body.title === "string" ? body.title.trim() : "";
	const description =
		typeof body.description === "string" ? body.description.trim() : "";

	if (!title || !description) {
		return NextResponse.json(
			{ error: "title and description cannot be empty" },
			{ status: 400 },
		);
	}

	let coverImageUrl: string | null;
	if (body.coverImageUrl === null || body.coverImageUrl === "") {
		coverImageUrl = null;
	} else if (typeof body.coverImageUrl === "string" && body.coverImageUrl.trim() !== "") {
		coverImageUrl = body.coverImageUrl.trim();
	} else {
		return NextResponse.json(
			{ error: "coverImageUrl must be null or a non-empty string" },
			{ status: 400 },
		);
	}

	const enforceIpChecks = parseBool(body.enforceIpChecks, false);
	const enforceAccountAge = parseBool(body.enforceAccountAge, false);
	const minAccountAgeDaysRaw =
		typeof body.minAccountAgeDays === "number" && Number.isFinite(body.minAccountAgeDays)
			? Math.max(0, Math.floor(body.minAccountAgeDays))
			: 0;
	const minAccountAgeDays = enforceAccountAge ? minAccountAgeDaysRaw : 0;

	if (enforceAccountAge && minAccountAgeDays < 1) {
		return NextResponse.json(
			{
				error:
					"When minimum account age is enabled, set days to at least 1.",
			},
			{ status: 400 },
		);
	}

	if (!Object.prototype.hasOwnProperty.call(body, "requiredPassId")) {
		return NextResponse.json({ error: "Missing requiredPassId (use null to clear)" }, { status: 400 });
	}

	let requiredPassId: string | null;
	if (body.requiredPassId === null) {
		requiredPassId = null;
	} else if (typeof body.requiredPassId === "string") {
		const trimmed = body.requiredPassId.trim();
		requiredPassId = trimmed !== "" ? trimmed : null;
	} else {
		return NextResponse.json({ error: "requiredPassId must be a string or null" }, { status: 400 });
	}

	const endRaw = body.endTime;
	if (typeof endRaw !== "string" || endRaw.trim() === "") {
		return NextResponse.json({ error: "Valid endTime (ISO datetime string) required" }, { status: 400 });
	}
	const endTime = new Date(endRaw);
	if (Number.isNaN(endTime.getTime())) {
		return NextResponse.json({ error: "Valid endTime (ISO datetime string) required" }, { status: 400 });
	}

	const planType = await getCompanyPlanType(existingRows[0].companyId);
	const security = normalizeSecurityForPlan(
		planType,
		enforceIpChecks,
		enforceAccountAge,
		minAccountAgeDays,
	);

	const updated = await db
		.update(giveawayTable)
		.set({
			title,
			description,
			coverImageUrl,
			endTime,
			requiredPassId,
			minAccountAgeDays: security.minAccountAgeDays,
			enforceIpChecks: security.enforceIpChecks,
			enforceAccountAge: security.enforceAccountAge,
			updatedAt: new Date(),
		})
		.where(eq(giveawayTable.id, giveawayId))
		.returning();

	const row = updated[0];
	if (!row) {
		return NextResponse.json({ error: "Update failed" }, { status: 500 });
	}

	return NextResponse.json({ giveaway: row }, { status: 200 });
}

export async function DELETE(
	req: NextRequest,
	ctx: { params: Promise<{ giveawayId: string }> },
) {
	const { giveawayId } = await ctx.params;
	const experienceId = req.nextUrl.searchParams.get("experienceId")?.trim() ?? "";
	if (!experienceId) {
		return NextResponse.json({ error: "Missing experienceId" }, { status: 400 });
	}

	try {
		await verifyUser(experienceId, "admin", req.nextUrl.searchParams);
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : "Forbidden";
		return NextResponse.json({ error: msg }, { status: 403 });
	}

	const deleted = await db
		.delete(giveawayTable)
		.where(
			and(eq(giveawayTable.id, giveawayId), eq(giveawayTable.experienceId, experienceId)),
		)
		.returning({ id: giveawayTable.id });

	if (!deleted[0]) {
		return NextResponse.json({ error: "Giveaway not found" }, { status: 404 });
	}

	return NextResponse.json({ ok: true }, { status: 200 });
}
