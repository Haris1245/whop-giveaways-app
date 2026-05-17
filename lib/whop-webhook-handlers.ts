import { db } from "@/db";
import { subscriptionTable } from "@/db/schema";
import { whopSdk } from "@/lib/whop-sdk";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

type MembershipPayload = {
	membershipId: string;
	userId: string;
	productId: string;
	companyId: string;
	experienceId: string;
	status: string;
	cancelAtPeriodEnd: boolean;
};

function asRecord(value: unknown): Record<string, unknown> | null {
	if (!value || typeof value !== "object") return null;
	return value as Record<string, unknown>;
}

function readString(...values: unknown[]): string {
	for (const value of values) {
		if (typeof value === "string" && value.trim()) return value.trim();
	}
	return "";
}

function parseMembershipPayload(data: Record<string, unknown>): MembershipPayload | null {
	const user = asRecord(data.user);
	const product = asRecord(data.product);
	const company = asRecord(data.company);
	const metadata = asRecord(data.metadata) ?? {};

	const membershipId = readString(data.id);
	const userId = readString(data.user_id, user?.id);
	const productId = readString(data.product_id, product?.id);
	const companyId = readString(data.company_id, company?.id);
	const experienceId = readString(
		metadata.experienceId,
		metadata.experience_id,
	);
	const status = readString(data.status) || "active";
	const cancelAtPeriodEnd = Boolean(
		data.cancel_at_period_end ?? data.cancelAtPeriodEnd,
	);

	if (!membershipId) return null;
	return {
		membershipId,
		userId,
		productId,
		companyId,
		experienceId,
		status,
		cancelAtPeriodEnd,
	};
}

async function resolveCompanyId(
	payload: MembershipPayload,
): Promise<string | null> {
	if (payload.companyId) return payload.companyId;
	if (!payload.experienceId) return null;

	const experience = await whopSdk.experiences.getExperience({
		experienceId: payload.experienceId,
	});
	if (experience && typeof experience === "object" && "company" in experience) {
		const company = asRecord((experience as { company: unknown }).company);
		return readString(company?.id) || null;
	}
	return null;
}

export async function handleMembershipActivated(
	data: Record<string, unknown>,
): Promise<Response | null> {
	const payload = parseMembershipPayload(data);
	if (!payload) {
		return new NextResponse("Bad Request: invalid membership payload", {
			status: 400,
		});
	}
	if (!payload.userId) {
		return new NextResponse("Bad Request: Missing user_id", { status: 400 });
	}
	if (!payload.experienceId) {
		return new NextResponse("Bad Request: Missing experienceId in metadata", {
			status: 400,
		});
	}

	const companyId = await resolveCompanyId(payload);
	if (!companyId) {
		return new NextResponse("Bad Request: Could not resolve company", {
			status: 400,
		});
	}

	await db.insert(subscriptionTable).values({
		userId: payload.userId,
		companyId,
		status: payload.status,
		membershipId: payload.membershipId,
		passId: payload.productId || "unknown",
	});

	return null;
}

export async function handleMembershipDeactivated(
	data: Record<string, unknown>,
): Promise<Response | null> {
	const membershipId = readString(data.id);
	if (!membershipId) {
		return new NextResponse("Bad Request: Missing membership id", {
			status: 400,
		});
	}

	await db
		.update(subscriptionTable)
		.set({ status: "cancelled" })
		.where(eq(subscriptionTable.membershipId, membershipId));

	return null;
}

export async function handleMembershipCancelAtPeriodEndChanged(
	data: Record<string, unknown>,
): Promise<Response | null> {
	const payload = parseMembershipPayload(data);
	if (!payload?.membershipId) {
		return new NextResponse("Bad Request: Missing membership id", {
			status: 400,
		});
	}

	await db
		.update(subscriptionTable)
		.set({
			status: payload.cancelAtPeriodEnd ? "cancelled" : "completed",
		})
		.where(eq(subscriptionTable.membershipId, payload.membershipId));

	return null;
}
