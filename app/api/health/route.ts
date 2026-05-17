import { ensureGiveawayExpiryScheduler } from "@/lib/giveaway-expiry-scheduler";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
	ensureGiveawayExpiryScheduler();
	return NextResponse.json({ ok: true });
}
