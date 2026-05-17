import type { NextRequest } from "next/server";

/** Best-effort client IP from proxy headers (Vercel / Cloudflare / nginx). */
export function getClientIp(req: NextRequest): string | null {
	const fwd = req.headers.get("x-forwarded-for");
	if (fwd) {
		const first = fwd.split(",")[0]?.trim();
		if (first) return first.slice(0, 255);
	}
	const realIp = req.headers.get("x-real-ip")?.trim();
	if (realIp) return realIp.slice(0, 255);
	const cf = req.headers.get("cf-connecting-ip")?.trim();
	if (cf) return cf.slice(0, 255);
	return null;
}
