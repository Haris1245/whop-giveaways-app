import React from "react";
import { whopSdk } from "@/lib/whop-sdk";
import { resolveWhopUserTokenForVerification } from "@/lib/whop-user-token";
import { headers } from "next/headers";
import { Button } from "frosted-ui";

export default async function DashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // The headers contains the user token
  const headersList = await headers();

  // The companyId is a path param
  const { companyId } = await params;

  const search = await searchParams;

  // The user token is in the headers (or `whop-dev-user-token` in dev via URL)
  const { userId } = await whopSdk.verifyUserToken(
    resolveWhopUserTokenForVerification(headersList, search),
  );

  const result = await whopSdk.access.checkIfUserHasAccessToCompany({
    userId,
    companyId,
  });

  const user = await whopSdk.users.getUser({ userId });
  const company = await whopSdk.companies.getCompany({ companyId });

  // Either: 'admin' | 'no_access';
  // 'admin' means the user is an admin of the company, such as an owner or moderator
  // 'no_access' means the user is not an authorized member of the company
  const { accessLevel } = result;

  return (
    <div className="flex justify-center items-center h-screen px-8">
      <h1 className="text-xl">
        Hi <strong>{user.name}</strong>, you{" "}
        <strong>{result.hasAccess ? "have" : "do not have"} access</strong> to
        this company. Your access level to this company is:{" "}
        <strong>{accessLevel}</strong>. <br />
        <br />
        Your user ID is <strong>{userId}</strong> and your username is{" "}
        <strong>@{user.username}</strong>.<br />
        <br />
        You are viewing the company: <strong>{company.title}</strong>
      </h1>
    </div>
  );
}
