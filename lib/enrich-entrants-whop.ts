import { whopSdk } from "@/lib/whop-sdk";

export type EntrantDbRow = {
	id: string;
	userId: string;
	username: string;
	ipAddress: string | null;
	whopAccountCreatedAt: Date | null;
	enteredAt: Date;
};

export type EnrichedEntrant = EntrantDbRow & {
	profilePictureUrl: string | null;
	displayName: string | null;
};

export async function enrichEntrantsWithWhopProfiles(
	entrants: EntrantDbRow[],
): Promise<EnrichedEntrant[]> {
	return Promise.all(
		entrants.map(async (e) => {
			try {
				const profile = await whopSdk.users.getUser({ userId: e.userId });
				if (!profile || ("_error" in profile && profile._error)) {
					return { ...e, profilePictureUrl: null, displayName: null };
				}
				const pic = profile.profilePicture;
				const profilePictureUrl =
					pic &&
					typeof pic === "object" &&
					"sourceUrl" in pic &&
					typeof pic.sourceUrl === "string" &&
					pic.sourceUrl.length > 0
						? pic.sourceUrl
						: null;
				const displayName =
					typeof profile.name === "string" && profile.name.trim().length > 0
						? profile.name.trim()
						: null;
				return { ...e, profilePictureUrl, displayName };
			} catch {
				return { ...e, profilePictureUrl: null, displayName: null };
			}
		}),
	);
}
