import { verifyUser } from "@/lib/authentication";
import { whopSdk } from "@/lib/whop-sdk";
import { NextRequest, NextResponse } from "next/server";

/** Access passes tied to this Whop experience (for giveaway eligibility picker). */
export async function GET(req: NextRequest) {
	const experienceId = req.nextUrl.searchParams.get("experienceId");

	if (!experienceId) {
		return NextResponse.json({ error: "Missing experienceId" }, { status: 400 });
	}

	try {
		await verifyUser(experienceId, undefined, req.nextUrl.searchParams);
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : "Unauthorized";
		return NextResponse.json({ error: msg }, { status: 401 });
	}

	try {
		const experience = await whopSdk.experiences.listAccessPassesForExperience({
			experienceId,
		});

		const raw = experience?.accessPasses ?? [];
		const passes = raw.map((p) => ({
			id: p.id,
			title: p.title,
			route: p.route,
			verified: p.verified,
		}));

		return NextResponse.json({ passes }, { status: 200 });
	} catch (err) {
		console.error("[access-passes]", err);
		return NextResponse.json(
			{ error: "Could not load access passes from Whop" },
			{ status: 502 },
		);
	}
}
