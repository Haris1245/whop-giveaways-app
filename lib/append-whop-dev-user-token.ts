/** Query param the Whop dev proxy adds to the app URL (see lib/whop-user-token.ts on server). */
export const WHOP_DEV_USER_TOKEN_QUERY = "whop-dev-user-token";

/** Read dev JWT from the current browser URL (client components / server actions). */
export function getWhopDevUserTokenFromBrowser(): string | null {
	if (typeof window === "undefined") return null;
	return new URLSearchParams(window.location.search).get(
		WHOP_DEV_USER_TOKEN_QUERY,
	);
}

export function pickWhopDevUserTokenFromRecord(
	record: Record<string, string | string[] | undefined> | undefined,
): string | undefined {
	if (!record) return undefined;
	const raw = record[WHOP_DEV_USER_TOKEN_QUERY];
	if (typeof raw === "string") return raw;
	if (Array.isArray(raw) && typeof raw[0] === "string") return raw[0];
	return undefined;
}

/** Adds `whop-dev-user-token` when you already have the JWT string (e.g. from RSC props). */
export function withWhopDevUserTokenQuery(
	href: string,
	token: string | undefined | null,
): string {
	if (!token) return href;
	const key = `${WHOP_DEV_USER_TOKEN_QUERY}=`;
	if (href.includes(key)) return href;
	const sep = href.includes("?") ? "&" : "?";
	return `${href}${sep}${WHOP_DEV_USER_TOKEN_QUERY}=${encodeURIComponent(token)}`;
}

/**
 * Appends `whop-dev-user-token` from the current page URL to same-origin `/api/*`
 * requests so route handlers can verify the user in local dev (header is often missing).
 */
export function appendWhopDevUserToken(url: string): string {
	if (typeof window === "undefined") return url;
	const token = new URLSearchParams(window.location.search).get(
		WHOP_DEV_USER_TOKEN_QUERY,
	);
	if (!token) return url;

	try {
		const u = new URL(url, window.location.origin);
		if (!u.pathname.startsWith("/api/")) return url;
		if (u.searchParams.has(WHOP_DEV_USER_TOKEN_QUERY)) return url;
		u.searchParams.set(WHOP_DEV_USER_TOKEN_QUERY, token);
		if (u.origin === window.location.origin) {
			return `${u.pathname}${u.search}${u.hash}`;
		}
		return u.toString();
	} catch {
		return url;
	}
}

/** `fetch`, but forwards the dev user JWT query param when present (local Whop iframe). */
export function whopDevAwareFetch(
	input: RequestInfo | URL,
	init?: RequestInit,
): Promise<Response> {
	if (typeof input === "string") {
		return fetch(appendWhopDevUserToken(input), init);
	}
	if (input instanceof URL) {
		return fetch(appendWhopDevUserToken(input.toString()), init);
	}
	if (input instanceof Request) {
		const nextUrl = appendWhopDevUserToken(input.url);
		if (nextUrl === input.url) {
			return fetch(input, init);
		}
		return fetch(new Request(nextUrl, input), init);
	}
	return fetch(input, init);
}
