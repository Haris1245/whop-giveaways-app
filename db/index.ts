import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

/** Prepare connection string after Next / dotenv have populated process.env */
function getDatabaseConnectionString(): string {
	const raw = process.env.DATABASE_URL;
	if (raw === undefined || raw.trim() === "") {
		const pgHost = process.env.PGHOST;
		throw new Error(
			[
				"DATABASE_URL is not set or is empty.",
				"Set it in .env.development or .env, then restart the dev server.",
				pgHost
					? `Note: PGHOST is "${pgHost}"; without a valid DATABASE_URL, node-pg may use that hostname and fail DNS (e.g. ENOTFOUND base). Unset PGHOST or fix DATABASE_URL.`
					: "",
			]
				.filter(Boolean)
				.join(" "),
		);
	}

	let s = raw.trim();
	if (
		(s.startsWith('"') && s.endsWith('"')) ||
		(s.startsWith("'") && s.endsWith("'"))
	) {
		s = s.slice(1, -1).trim();
	}
	s = s.replace(/\r/g, "").replace(/\n/g, "").trim();

	if (!s.startsWith("postgres://") && !s.startsWith("postgresql://")) {
		console.warn(
			"[db] DATABASE_URL should start with postgres:// or postgresql:// — check .env formatting.",
		);
	}

	return s;
}

const connectionString = getDatabaseConnectionString();

export const db = drizzle(
	new pg.Pool({
		connectionString,
	}),
);
