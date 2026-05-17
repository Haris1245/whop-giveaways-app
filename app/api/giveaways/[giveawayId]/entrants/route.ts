import { db } from "@/db";
import { entrantTable, giveawayTable } from "@/db/schema";
import { verifyUser } from "@/lib/authentication";
import { desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

/** Admin-only: list entrants for a giveaway in this experience. */
export async function GET(
	req: NextRequest,
	context: { params: Promise<{ giveawayId: string }> },
) {
	const { giveawayId } = await context.params;
	const experienceId = req.nextUrl.searchParams.get("experienceId");

	if (!experienceId) {
		return NextResponse.json({ error: "Missing experienceId" }, { status: 400 });
	}

	try {
		await verifyUser(experienceId, "admin", req.nextUrl.searchParams);
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : "Forbidden";
		return NextResponse.json({ error: msg }, { status: 403 });
	}

	const giveawayRows = await db
		.select({
			experienceId: giveawayTable.experienceId,
		})
		.from(giveawayTable)
		.where(eq(giveawayTable.id, giveawayId))
		.limit(1);

	const gw = giveawayRows[0];
	if (!gw || gw.experienceId !== experienceId) {
		return NextResponse.json({ error: "Giveaway not found" }, { status: 404 });
	}

	const rows = await db
		.select({
			id: entrantTable.id,
			userId: entrantTable.userId,
			username: entrantTable.username,
			ipAddress: entrantTable.ipAddress,
			enteredAt: entrantTable.createdAt,
		})
		.from(entrantTable)
		.where(eq(entrantTable.giveawayId, giveawayId))
		.orderBy(desc(entrantTable.createdAt));

	const entrants = rows.map((r) => ({
		id: r.id,
		userId: r.userId,
		username: r.username,
		ipAddress: r.ipAddress,
		enteredAt: r.enteredAt.toISOString(),
	}));

	return NextResponse.json({ entrants });
}
