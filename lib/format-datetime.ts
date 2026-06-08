/** Full date + time in the viewer's local timezone (no timezone label). */
export const GIVEAWAY_DATETIME_FORMAT: Intl.DateTimeFormatOptions = {
	month: "long",
	day: "numeric",
	year: "numeric",
	hour: "numeric",
	minute: "2-digit",
	hour12: true,
};

/** End-time display: omits year when it matches the current year. */
export const GIVEAWAY_END_DATETIME_FORMAT: Intl.DateTimeFormatOptions = {
	month: "long",
	day: "numeric",
	hour: "numeric",
	minute: "2-digit",
	hour12: true,
};

export function formatLocalDateTime(
	iso: string,
	options: Intl.DateTimeFormatOptions = GIVEAWAY_DATETIME_FORMAT,
): string {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return iso;
	const fmt = new Intl.DateTimeFormat(undefined, options);
	if (options === GIVEAWAY_END_DATETIME_FORMAT) {
		const now = new Date();
		const withYear =
			d.getFullYear() !== now.getFullYear()
				? ({ ...options, year: "numeric" } satisfies Intl.DateTimeFormatOptions)
				: options;
		return new Intl.DateTimeFormat(undefined, withYear).format(d);
	}
	return fmt.format(d);
}
