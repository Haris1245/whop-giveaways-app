/** Opens Whop profile / DM flow for a member (same as entrants row "Message"). */
export function whopMessageHref(username: string): string | undefined {
	const handle = username.trim().replace(/^@/, "");
	if (!handle) return undefined;
	return `https://whop.com/@${encodeURIComponent(handle)}`;
}
