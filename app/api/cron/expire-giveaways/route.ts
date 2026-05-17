import { formatDbError } from "@/db";
import { expireAllPastDueGiveaways } from "@/lib/expire-giveaways";
import { ensureGiveawayExpiryScheduler } from "@/lib/giveaway-expiry-scheduler";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest): boolean {
	const secret = process.env.CRON_SECRET?.trim();
	if (!secret) return false;
	return request.headers.get("authorization") === `Bearer ${secret}`;
}

/** Manual or Railway cron trigger — ends all past-due giveaways. */
export async function GET(request: NextRequest): Promise<Response> {
	if (!isAuthorized(request)) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	ensureGiveawayExpiryScheduler();

	try {
		const result = await expireAllPastDueGiveaways();
		return NextResponse.json({ ok: true, ...result });
	} catch (e) {
		console.error("[cron/expire-giveaways]", formatDbError(e));
		return NextResponse.json(
			{ ok: false, error: formatDbError(e) },
			{ status: 500 },
		);
	}
}
