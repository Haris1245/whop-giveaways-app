import React from "react";
import { pickWhopDevUserTokenFromRecord } from "@/lib/append-whop-dev-user-token";
import { whopSdk } from "@/lib/whop-sdk";
import { resolveWhopUserTokenForVerification } from "@/lib/whop-user-token";
import { headers } from "next/headers";
import { syncPastDueGiveaways } from "@/lib/expire-giveaways";
import { ensureGiveawayExpiryScheduler } from "@/lib/giveaway-expiry-scheduler";
import GiveawayExperience from "./giveaway-experience";

export default async function ExperiencePage({
  params,
  searchParams,
}: {
  params: Promise<{ experienceId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // The headers contains the user token
  const headersList = await headers();

  // The experienceId is a path param
  const { experienceId } = await params;

  // Validate experienceId is a proper string
  if (
    !experienceId ||
    typeof experienceId !== "string" ||
    experienceId.includes("[object Object]") ||
    experienceId.includes("%5Bobject%20Object%5D")
  ) {
    return (
      <div className="flex justify-center items-center h-screen px-8">
        <h1 className="text-xl text-center text-red-600">
          Invalid experience ID. Please check the URL.
        </h1>
      </div>
    );
  }

  const search = await searchParams;

  // The user token is in the headers (or `whop-dev-user-token` in dev via URL)
  const { userId } = await whopSdk.verifyUserToken(
    resolveWhopUserTokenForVerification(headersList, search),
  );

  const result = await whopSdk.access.checkIfUserHasAccessToExperience({
    userId,
    experienceId,
  });
  if (!result.hasAccess) {
    return (
      <div className="flex justify-center items-center h-screen px-8">
        <h1 className="text-xl text-center">
          You do not have access to this experience.
        </h1>
      </div>
    );
  }

  ensureGiveawayExpiryScheduler();
  await syncPastDueGiveaways(experienceId);

  return (
    <GiveawayExperience
      experienceId={experienceId}
      access={result.accessLevel}
      whopDevUserToken={pickWhopDevUserTokenFromRecord(search)}
    />
  );
}
