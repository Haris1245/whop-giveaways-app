import { makeWebhookValidator } from "@whop/api";

const TIMESTAMP_TOLERANCE_SEC = 300;

export type WhopWebhookEvent = {
	/** Normalized snake_case event name, e.g. `membership_activated` */
	type: string;
	data: Record<string, unknown>;
	apiVersion: "v1" | "v5";
};

function getWebhookSecret(): string {
	const secret = process.env.WHOP_WEBHOOK_SECRET?.trim();
	if (!secret) throw new Error("WHOP_WEBHOOK_SECRET is not configured");
	return secret;
}

/** Maps dot/camel variants to snake_case dashboard event names. */
export function normalizeWhopWebhookType(raw: string): string {
	return raw
		.trim()
		.replace(/([a-z0-9])([A-Z])/g, "$1_$2")
		.toLowerCase()
		.replace(/\./g, "_")
		.replace(/-/g, "_");
}

function getSigningKeyMaterial(secret: string): Buffer {
	if (secret.startsWith("whsec_")) {
		return Buffer.from(secret.slice(6), "base64");
	}
	return Buffer.from(secret, "utf8");
}

function parseSignatureHeader(header: string): Array<{ version: string; signature: string }> {
	return header
		.split(/\s+/)
		.map((part) => part.trim())
		.filter(Boolean)
		.map((part) => {
			const comma = part.indexOf(",");
			if (comma === -1) return null;
			return {
				version: part.slice(0, comma),
				signature: part.slice(comma + 1),
			};
		})
		.filter((x): x is { version: string; signature: string } => x !== null);
}

async function verifyV1StandardWebhook(
	body: string,
	headers: Headers,
): Promise<WhopWebhookEvent> {
	const msgId = headers.get("webhook-id");
	const timestamp = headers.get("webhook-timestamp");
	const signatureHeader = headers.get("webhook-signature");

	if (!msgId || !timestamp || !signatureHeader) {
		throw new Error("Missing Standard Webhooks headers");
	}

	const ts = Number.parseInt(timestamp, 10);
	const now = Math.round(Date.now() / 1000);
	if (Number.isNaN(ts) || Math.abs(now - ts) > TIMESTAMP_TOLERANCE_SEC) {
		throw new Error("Invalid webhook timestamp");
	}

	const keyMaterial = getSigningKeyMaterial(getWebhookSecret());
	const signedContent = `${msgId}.${timestamp}.${body}`;
	const key = await crypto.subtle.importKey(
		"raw",
		keyMaterial,
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const mac = await crypto.subtle.sign(
		"HMAC",
		key,
		new TextEncoder().encode(signedContent),
	);
	const expected = Buffer.from(mac).toString("base64");

	const signatures = parseSignatureHeader(signatureHeader);
	const valid = signatures.some(
		({ version, signature }) => version === "v1" && signature === expected,
	);
	if (!valid) {
		throw new Error("Webhook signature mismatch");
	}

	const parsed = JSON.parse(body) as {
		type?: string;
		action?: string;
		data?: unknown;
	};
	const rawType = parsed.type ?? parsed.action;
	if (!rawType || typeof rawType !== "string") {
		throw new Error("Invalid webhook payload: missing type");
	}
	if (!parsed.data || typeof parsed.data !== "object" || parsed.data === null) {
		throw new Error("Invalid webhook payload: missing data");
	}

	return {
		type: normalizeWhopWebhookType(rawType),
		data: parsed.data as Record<string, unknown>,
		apiVersion: "v1",
	};
}

const legacyValidate = makeWebhookValidator({
	webhookSecret: process.env.WHOP_WEBHOOK_SECRET ?? "fallback",
});

/**
 * Verifies Whop webhooks (v1 Standard Webhooks or legacy v5) and returns a normalized event.
 */
export async function unwrapWhopWebhook(request: Request): Promise<WhopWebhookEvent> {
	const body = await request.text();
	const headers = request.headers;

	if (headers.get("webhook-id")) {
		return verifyV1StandardWebhook(body, headers);
	}

	let parsed: { api_version?: string; type?: string; action?: string };
	try {
		parsed = JSON.parse(body) as { api_version?: string; type?: string; action?: string };
	} catch {
		throw new Error("Invalid JSON webhook body");
	}

	if (parsed.api_version === "v5" && parsed.action) {
		const legacyReq = new Request(request.url, {
			method: request.method,
			headers: request.headers,
			body,
		});
		const legacy = await legacyValidate(legacyReq);
		return {
			type: normalizeWhopWebhookType(legacy.action),
			data: legacy.data as unknown as Record<string, unknown>,
			apiVersion: "v5",
		};
	}

	if (parsed.type) {
		return verifyV1StandardWebhook(body, headers);
	}

	throw new Error("Unrecognized webhook format");
}
