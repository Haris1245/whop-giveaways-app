import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
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

type GlobalDb = typeof globalThis & {
	__giveawayPgPool?: pg.Pool;
	__giveawayDrizzle?: NodePgDatabase;
};

function getPool(): pg.Pool {
	const g = globalThis as GlobalDb;
	if (!g.__giveawayPgPool) {
		g.__giveawayPgPool = new pg.Pool({
			connectionString: getDatabaseConnectionString(),
			max: 10,
			idleTimeoutMillis: 30_000,
			connectionTimeoutMillis: 10_000,
		});
		g.__giveawayPgPool.on("error", (err) => {
			console.error("[db] idle pool client error:", err);
		});
	}
	return g.__giveawayPgPool;
}

function getDrizzle(): NodePgDatabase {
	const g = globalThis as GlobalDb;
	if (!g.__giveawayDrizzle) {
		g.__giveawayDrizzle = drizzle(getPool());
	}
	return g.__giveawayDrizzle;
}

/** Lazy singleton — avoids connecting before env is ready and survives Next.js hot reload. */
export const db = new Proxy({} as NodePgDatabase, {
	get(_target, prop, receiver) {
		const instance = getDrizzle();
		const value = Reflect.get(instance, prop, receiver);
		if (typeof value === "function") {
			return value.bind(instance);
		}
		return value;
	},
});

export function formatDbError(error: unknown): string {
	if (error instanceof Error) {
		const cause = error.cause;
		if (cause instanceof Error) {
			return `${error.message} — ${cause.message}`;
		}
		return error.message;
	}
	return String(error);
}
