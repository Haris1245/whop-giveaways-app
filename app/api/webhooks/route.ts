import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
	handleMembershipActivated,
	handleMembershipCancelAtPeriodEndChanged,
	handleMembershipDeactivated,
} from "@/lib/whop-webhook-handlers";
import { unwrapWhopWebhook } from "@/lib/whop-webhook";

/** v1 dashboard + legacy v5 aliases for membership subscription tracking */
const MEMBERSHIP_ACTIVATED = new Set([
	"membership_activated",
	"membership_went_valid",
	"app_membership_went_valid",
]);

const MEMBERSHIP_DEACTIVATED = new Set([
	"membership_deactivated",
	"membership_went_invalid",
	"app_membership_went_invalid",
]);

const MEMBERSHIP_CANCEL_AT_PERIOD_END_CHANGED = new Set([
	"membership_cancel_at_period_end_changed",
	"app_membership_cancel_at_period_end_changed",
]);

/** Acknowledged v1 events with no app-specific handler yet */
const ACKNOWLEDGED_EVENTS = new Set([
	"invoice_created",
	"invoice_marked_uncollectible",
	"invoice_paid",
	"invoice_past_due",
	"invoice_voided",
	"entry_created",
	"entry_approved",
	"entry_denied",
	"entry_deleted",
	"setup_intent_requires_action",
	"setup_intent_succeeded",
	"setup_intent_canceled",
	"withdrawal_created",
	"withdrawal_updated",
	"course_lesson_interaction_completed",
	"payout_method_created",
	"verification_succeeded",
	"payout_account_status_updated",
	"resolution_center_case_created",
	"resolution_center_case_updated",
	"resolution_center_case_decided",
	"payment_created",
	"payment_succeeded",
	"payment_failed",
	"payment_pending",
	"dispute_created",
	"dispute_updated",
	"refund_created",
	"refund_updated",
	"dispute_alert_created",
	"membership_experience_claimed",
	"membership_metadata_updated",
	"payment_affiliate_reward_created",
	"app_payment_succeeded",
	"app_payment_failed",
	"app_payment_pending",
	"resolution_created",
	"resolution_updated",
	"resolution_decided",
]);

export async function POST(request: NextRequest): Promise<Response> {
	try {
		let event;
		try {
			event = await unwrapWhopWebhook(request);
		} catch (validationError) {
			console.error("Webhook validation failed:", validationError);
			return new NextResponse("Unauthorized", { status: 401 });
		}

		const { type, data } = event;

		if (MEMBERSHIP_ACTIVATED.has(type)) {
			try {
				const errorResponse = await handleMembershipActivated(data);
				if (errorResponse) return errorResponse;
			} catch (dbError) {
				console.error(`Database error in ${type}:`, dbError);
				return new NextResponse("Internal Server Error", { status: 500 });
			}
		} else if (MEMBERSHIP_DEACTIVATED.has(type)) {
			try {
				const errorResponse = await handleMembershipDeactivated(data);
				if (errorResponse) return errorResponse;
			} catch (dbError) {
				console.error(`Database error in ${type}:`, dbError);
				return new NextResponse("Internal Server Error", { status: 500 });
			}
		} else if (MEMBERSHIP_CANCEL_AT_PERIOD_END_CHANGED.has(type)) {
			try {
				const errorResponse =
					await handleMembershipCancelAtPeriodEndChanged(data);
				if (errorResponse) return errorResponse;
			} catch (dbError) {
				console.error(`Database error in ${type}:`, dbError);
				return new NextResponse("Internal Server Error", { status: 500 });
			}
		} else if (ACKNOWLEDGED_EVENTS.has(type)) {
			// Received and verified; no business logic for this app yet.
		} else {
			console.warn(`Unhandled webhook event: ${type} (api ${event.apiVersion})`);
		}

		return new NextResponse("OK", { status: 200 });
	} catch (error) {
		console.error("Unexpected error in webhook handler:", error);
		return new NextResponse("Internal Server Error", { status: 500 });
	}
}
