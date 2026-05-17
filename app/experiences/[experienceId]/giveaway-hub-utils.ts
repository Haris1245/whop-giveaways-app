import type { ComponentProps } from "react";
import { Badge } from "frosted-ui";
import type { GiveawayRow } from "./giveaway-hub-types";

/** Full spelled-out date + time + local timezone abbreviation. */
export function formatGiveawayEndsReadable(iso: string): string {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return iso;
	return new Intl.DateTimeFormat(undefined, {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	}).format(d);
}

export function statusTone(
	status: GiveawayRow["status"],
): ComponentProps<typeof Badge>["color"] {
	switch (status) {
		case "active":
			return "green";
		case "drawing":
			return "amber";
		case "completed":
			return "gray";
		case "cancelled":
			return "red";
		default:
			return "gray";
	}
}

export function giveawayAcceptsEntries(g: GiveawayRow): boolean {
	if (g.status !== "active") return false;
	const end = new Date(g.endTime).getTime();
	return !Number.isNaN(end) && end > Date.now();
}

export function adminEntrantsButtonLabel(
	g: GiveawayRow,
	variant: "button" | "menu" = "button",
): string {
	if (g.status === "completed") return "View the winner";
	return variant === "menu" ? "View entrants" : "Manage entrants";
}

export function closedGiveawayMessage(status: GiveawayRow["status"], forAdmin = false): string {
	if (status === "completed") {
		return forAdmin
			? "Giveaway ended. Reach out to the winner with next steps."
			: "Giveaway ended.";
	}
	if (status === "cancelled") return "Giveaway cancelled";
	return "Entries closed";
}
