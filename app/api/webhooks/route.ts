import { waitUntil } from "@vercel/functions";
import { makeWebhookValidator } from "@whop/api";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { subscriptionTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { whopSdk } from "@/lib/whop-sdk";

const validateWebhook = makeWebhookValidator({
	webhookSecret: process.env.WHOP_WEBHOOK_SECRET ?? "fallback",
});

export async function POST(request: NextRequest): Promise<Response> {
	try {
		// Validate the webhook to ensure it's from Whop
		let webhookData;
		try {
			webhookData = await validateWebhook(request);
		} catch (validationError) {
			console.error("Webhook validation failed:", validationError);
			// Return 401 for invalid webhooks to prevent retries
			return new NextResponse("Unauthorized", { status: 401 });
		}

		// Handle the webhook event
		switch (webhookData.action) {
			case "membership.went_valid":
				try {
					const {id: membershipId, product_id,metadata, status, user_id} = webhookData.data
					if (!user_id) {
						console.error("Missing user_id in membership.went_valid webhook");
						return new NextResponse("Bad Request: Missing user_id", { status: 400 });
					}
					if (!metadata?.experienceId) {
						console.error("Missing experienceId in membership.went_valid webhook");
						return new NextResponse("Bad Request: Missing experienceId", { status: 400 });
					}
					const experienceId = metadata.experienceId
					const experience = await whopSdk.experiences.getExperience({  experienceId: experienceId as string })
					await db.insert(subscriptionTable).values({
						userId: user_id,	
						companyId: experience.company.id,
						status: status,
						membershipId: membershipId,
						passId: product_id,
					})
				} catch (dbError) {
					console.error("Database error in membership.went_valid:", dbError);
					return new NextResponse("Internal Server Error", { status: 500 });
				}
				break;

			case "membership.went_invalid":
				try {
					const {id: invalidMembershipId} = webhookData.data
					await db.update(subscriptionTable).set({
						status: "cancelled",
					}).where(eq(subscriptionTable.membershipId, invalidMembershipId))
				} catch (dbError) {
					console.error("Database error in membership.went_invalid:", dbError);
					return new NextResponse("Internal Server Error", { status: 500 });
				}
				break;

			case "membership.cancel_at_period_end_changed":
				try {
					const {id: cancelMembershipId, cancel_at_period_end} = webhookData.data
					await db.update(subscriptionTable).set({
						status: cancel_at_period_end ? "cancelled" : "completed",
					}).where(eq(subscriptionTable.membershipId, cancelMembershipId))
				} catch (dbError) {
					console.error("Database error in membership.cancel_at_period_end_changed:", dbError);
					return new NextResponse("Internal Server Error", { status: 500 });
				}
				break;

			default:
				console.warn(`Unhandled webhook action: ${webhookData.action}`);
				// Return 200 for unhandled actions to acknowledge receipt
				return new NextResponse("OK", { status: 200 });
		}

		// Make sure to return a 2xx status code quickly. Otherwise the webhook will be retried.
		return new NextResponse("OK", { status: 200 });
	} catch (error) {
		console.error("Unexpected error in webhook handler:", error);
		// Return 500 for unexpected errors
		return new NextResponse("Internal Server Error", { status: 500 });
	}
}

