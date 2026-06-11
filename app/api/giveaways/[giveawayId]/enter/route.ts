import { db } from "@/db";
import { entrantTable, giveawayTable } from "@/db/schema";
import { verifyUser } from "@/lib/authentication";
import { getCompanyPlanType } from "@/lib/plan-access";
import { getPlanLimits } from "@/lib/plans";
import { getClientIp } from "@/lib/request-ip";
import { whopSdk } from "@/lib/whop-sdk";
import { and, count, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

function accountAgeDays(createdAtUnix: number): number {
	const ms = createdAtUnix > 10_000_000_000 ? createdAtUnix : createdAtUnix * 1000;
	return (Date.now() - ms) / (86_400 * 1000);
}

export async function POST(
	req: NextRequest,
	context: { params: Promise<{ giveawayId: string }> },
) {
	const { giveawayId } = await context.params;

	let body: { experienceId?: string };
	try {
		body = await req.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
	}

	const experienceId =
		typeof body.experienceId === "string" ? body.experienceId.trim() : "";
	if (!experienceId) {
		return NextResponse.json({ error: "Missing experienceId" }, { status: 400 });
	}

	let userId: string;
	try {
		const v = await verifyUser(experienceId, undefined, req.nextUrl.searchParams);
		if (v.accessLevel === "admin") {
			return NextResponse.json(
				{ error: "Giveaway admins cannot enter giveaways they manage." },
				{ status: 403 },
			);
		}
		userId = v.userId;
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : "Unauthorized";
		const status =
			msg.includes("does not have access") || msg.includes("no_access") ? 403 : 401;
		return NextResponse.json({ error: msg }, { status });
	}

	const rows = await db
		.select()
		.from(giveawayTable)
		.where(eq(giveawayTable.id, giveawayId))
		.limit(1);

	const giveaway = rows[0];
	if (!giveaway || giveaway.experienceId !== experienceId) {
		return NextResponse.json({ error: "Giveaway not found" }, { status: 404 });
	}

	if (giveaway.status !== "active") {
		return NextResponse.json(
			{ error: "This giveaway is not accepting entries." },
			{ status: 400 },
		);
	}

	const endMs = new Date(giveaway.endTime).getTime();
	if (Number.isNaN(endMs) || endMs <= Date.now()) {
		return NextResponse.json({ error: "This giveaway has ended." }, { status: 400 });
	}

	const ip = getClientIp(req);

	const planType = await getCompanyPlanType(giveaway.companyId);
	const limits = getPlanLimits(planType);
	if (limits.maxMembersPerGiveaway != null) {
		const [entrantAgg] = await db
			.select({ n: count() })
			.from(entrantTable)
			.where(eq(entrantTable.giveawayId, giveawayId));
		if (Number(entrantAgg?.n ?? 0) >= limits.maxMembersPerGiveaway) {
			return NextResponse.json(
				{
					error: `This giveaway is full (${limits.maxMembersPerGiveaway} entrants max on the free plan).`,
				},
				{ status: 403 },
			);
		}
	}

	let username = "member";
	let accountCreatedAt: Date | null = null;

	try {
		const profile = await whopSdk.users.getUser({ userId });
		if (profile?.username) username = profile.username;
		if (typeof profile?.createdAt === "number") {
			const ageDays = accountAgeDays(profile.createdAt);
			accountCreatedAt = new Date(
				profile.createdAt > 10_000_000_000
					? profile.createdAt
					: profile.createdAt * 1000,
			);
			if (giveaway.enforceAccountAge) {
				const minDays = giveaway.minAccountAgeDays ?? 0;
				if (minDays >= 1 && ageDays + 1e-9 < minDays) {
					return NextResponse.json(
						{
							error: `Your Whop account must be at least ${minDays} days old to enter.`,
						},
						{ status: 403 },
					);
				}
			}
		} else if (giveaway.enforceAccountAge) {
			return NextResponse.json(
				{ error: "Could not verify account age for this giveaway." },
				{ status: 503 },
			);
		}
	} catch {
		if (giveaway.enforceAccountAge) {
			return NextResponse.json(
				{ error: "Could not load your profile to verify account age." },
				{ status: 503 },
			);
		}
	}

	if (giveaway.enforceIpChecks) {
		if (!ip) {
			return NextResponse.json(
				{
					error:
						"We could not detect your IP (required for this giveaway). Try another network or disable VPN extensions.",
				},
				{ status: 400 },
			);
		}
		const dupIp = await db
			.select({ id: entrantTable.id })
			.from(entrantTable)
			.where(
				and(eq(entrantTable.giveawayId, giveawayId), eq(entrantTable.ipAddress, ip)),
			)
			.limit(1);
		if (dupIp.length > 0) {
			return NextResponse.json(
				{
					error:
						"Someone already entered this giveaway from this IP address.",
				},
				{ status: 409 },
			);
		}
	}

	try {
		await db.insert(entrantTable).values({
			giveawayId,
			userId,
			username,
			ipAddress: ip,
			whopAccountCreatedAt: accountCreatedAt,
		});
	} catch (e: unknown) {
		const code = postgresErrorCode(e);
		if (code === "23505") {
			return NextResponse.json(
				{ error: "You're already entered in this giveaway." },
				{ status: 409 },
			);
		}
		console.error("[giveaways/enter]", e);
		return NextResponse.json({ error: "Could not save your entry." }, { status: 500 });
	}

	const [agg] = await db
		.select({ n: count() })
		.from(entrantTable)
		.where(eq(entrantTable.giveawayId, giveawayId));

	return NextResponse.json(
		{
			ok: true,
			entrantCount: Number(agg?.n ?? 0),
		},
		{ status: 201 },
	);
}

function postgresErrorCode(e: unknown): string | undefined {
	if (typeof e !== "object" || e === null) return undefined;
	const err = e as Record<string, unknown>;
	if (typeof err.code === "string") return err.code;
	const cause = err.cause;
	if (typeof cause === "object" && cause !== null && "code" in cause) {
		const c = (cause as { code?: unknown }).code;
		return typeof c === "string" ? c : undefined;
	}
	return undefined;
}
