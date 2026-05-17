import "server-only";

const WHOP_USER_TOKEN_HEADER = "x-whop-user-token";
/** Query param the Whop dev proxy appends in local development */
const WHOP_DEV_USER_TOKEN_QUERY = "whop-dev-user-token";

function pickDevTokenFromRecord(
	record: Record<string, string | string[] | undefined>,
): string | undefined {
	const raw = record[WHOP_DEV_USER_TOKEN_QUERY];
	if (typeof raw === "string") return raw;
	if (Array.isArray(raw) && typeof raw[0] === "string") return raw[0];
	return undefined;
}

/**
 * Resolve the JWT string or Headers for Whop SDK `verifyUserToken`.
 * In development, accepts `whop-dev-user-token` from the URL when the header
 * is missing (RSC / flight requests do not always receive the proxy header).
 */
export function resolveWhopUserTokenForVerification(
	headersList: Headers,
	searchParams?: URLSearchParams | Record<string, string | string[] | undefined> | null,
): Headers | string {
	const fromHeader = headersList.get(WHOP_USER_TOKEN_HEADER);
	if (fromHeader) return fromHeader;

	if (process.env.NODE_ENV !== "development" || searchParams == null) {
		return headersList;
	}

	let fromQuery: string | undefined;
	if (typeof (searchParams as URLSearchParams).get === "function") {
		fromQuery =
			(searchParams as URLSearchParams).get(WHOP_DEV_USER_TOKEN_QUERY) ??
			undefined;
	} else {
		fromQuery = pickDevTokenFromRecord(
			searchParams as Record<string, string | string[] | undefined>,
		);
	}

	return fromQuery ?? headersList;
}
