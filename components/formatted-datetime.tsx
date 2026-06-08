"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import {
	formatLocalDateTime,
	GIVEAWAY_DATETIME_FORMAT,
} from "@/lib/format-datetime";

function useIsClient(): boolean {
	return useSyncExternalStore(
		() => () => {},
		() => true,
		() => false,
	);
}

type FormattedDateTimeProps = {
	iso: string | null | undefined;
	fallback?: ReactNode;
	options?: Intl.DateTimeFormatOptions;
	className?: string;
};

/** Renders an ISO timestamp in the viewer's local timezone (client-only). */
export function FormattedDateTime({
	iso,
	fallback = "—",
	options = GIVEAWAY_DATETIME_FORMAT,
	className,
}: FormattedDateTimeProps) {
	const isClient = useIsClient();

	if (!iso) {
		return fallback ? <span className={className}>{fallback}</span> : null;
	}

	const label = isClient ? formatLocalDateTime(iso, options) : null;

	return (
		<time dateTime={iso} className={className} suppressHydrationWarning>
			{label ?? "…"}
		</time>
	);
}
