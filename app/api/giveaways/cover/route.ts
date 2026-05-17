import { verifyUser } from "@/lib/authentication";
import { uploadToR2 } from "@/lib/r2";
import { NextRequest, NextResponse } from "next/server";

const MAX_BYTES = 5 * 1024 * 1024;

const ALLOWED: Record<string, string> = {
	"image/jpeg": ".jpg",
	"image/png": ".png",
	"image/webp": ".webp",
	"image/gif": ".gif",
};

export async function POST(req: NextRequest) {
	if (
		!process.env.R2_BUCKET_NAME ||
		!process.env.R2_PUBLIC_URL ||
		!process.env.R2_ACCESS_KEY_ID ||
		!process.env.R2_SECRET_ACCESS_KEY
	) {
		return NextResponse.json(
			{
				error:
					"Image uploads are not configured. Set R2_BUCKET_NAME, R2_PUBLIC_URL, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY.",
			},
			{ status: 503 },
		);
	}

	let formData: FormData;
	try {
		formData = await req.formData();
	} catch {
		return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
	}

	const experienceId = formData.get("experienceId");
	const file = formData.get("file");

	if (typeof experienceId !== "string" || experienceId.trim() === "") {
		return NextResponse.json({ error: "Missing experienceId" }, { status: 400 });
	}

	if (!(file instanceof File)) {
		return NextResponse.json({ error: "Missing file" }, { status: 400 });
	}

	if (file.size === 0) {
		return NextResponse.json({ error: "Empty file" }, { status: 400 });
	}

	if (file.size > MAX_BYTES) {
		return NextResponse.json(
			{ error: "Image must be 5MB or smaller" },
			{ status: 400 },
		);
	}

	const ext = ALLOWED[file.type];
	if (!ext) {
		return NextResponse.json(
			{ error: "Use JPEG, PNG, WebP, or GIF." },
			{ status: 400 },
		);
	}

	try {
		await verifyUser(experienceId, "admin", req.nextUrl.searchParams);
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : "Forbidden";
		return NextResponse.json({ error: msg }, { status: 403 });
	}

	const id = crypto.randomUUID();
	const key = `giveaway-covers/${experienceId}/${id}${ext}`;

	try {
		const url = await uploadToR2(file, key);
		return NextResponse.json({ url }, { status: 201 });
	} catch (err) {
		console.error("[giveaways/cover]", err);
		return NextResponse.json(
			{ error: "Upload failed. Check R2 credentials and bucket." },
			{ status: 500 },
		);
	}
}
