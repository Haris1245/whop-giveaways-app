import { redirect } from "next/navigation";

/** Legacy route — billing lives at `/billing`. */
export default async function AdminBillingRedirect({
	params,
	searchParams,
}: {
	params: Promise<{ experienceId: string }>;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	const { experienceId } = await params;
	const search = await searchParams;

	const qs = new URLSearchParams();
	for (const [key, value] of Object.entries(search)) {
		if (typeof value === "string") qs.set(key, value);
		else if (Array.isArray(value) && typeof value[0] === "string") {
			qs.set(key, value[0]);
		}
	}

	const query = qs.toString();
	redirect(
		`/experiences/${experienceId}/billing${query ? `?${query}` : ""}`,
	);
}
