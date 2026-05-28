"use client";

import { Avatar, Badge, Button, Text } from "frosted-ui";
import { MessageSquare, Trophy } from "lucide-react";
import { whopMessageHref } from "@/lib/whop-message-href";

function usernameToInitials(username: string): string {
	const u = username.replace(/^@/, "").trim();
	if (!u) return "?";
	const parts = u.split(/[\s._-]+/).filter(Boolean);
	if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
	return u.slice(0, 2).toUpperCase();
}

function formatUsername(username: string): string {
	const t = username.trim();
	if (!t) return "@unknown";
	return t.startsWith("@") ? t : `@${t}`;
}

export function WinnerRow(props: {
	username: string;
	displayName: string | null;
	profilePictureUrl: string | null;
	pickedAtLabel: string;
}) {
	const chatHref = whopMessageHref(props.username);
	const handle = props.username.replace(/^@/, "").trim();

	return (
		<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
			<div className="flex min-w-0 items-center gap-3">
				<Avatar
					size="3"
					color="gray"
					src={props.profilePictureUrl ?? undefined}
					alt=""
					referrerPolicy="no-referrer"
					fallback={handle.length > 0 ? handle : usernameToInitials(props.username)}
				/>
				<div className="min-w-0">
					<div className="flex flex-wrap items-center gap-2">
						<Text as="p" size="3" weight="medium" className="truncate text-gray-900 dark:text-gray-50">
							{formatUsername(props.username)}
						</Text>
						<Badge variant="soft" color="green" size="1" className="shrink-0 capitalize">
							<Trophy className="mr-1 inline h-3 w-3 opacity-80" aria-hidden />
							Winner
						</Badge>
					</div>
					{props.displayName ? (
						<Text as="p" size="2" color="gray" className="mt-0.5 truncate">
							{props.displayName}
						</Text>
					) : null}
					<Text as="p" size="1" color="gray" className="mt-1">
						Drawn {props.pickedAtLabel}
					</Text>
				</div>
			</div>

			{chatHref ? (
				<Button asChild variant="surface" size="2" className="w-full shrink-0 sm:w-auto">
					<a
						href={chatHref}
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex items-center justify-center gap-2"
					>
						<MessageSquare className="h-4 w-4 shrink-0" aria-hidden />
						Chat with winner
					</a>
				</Button>
			) : (
				<Button variant="surface" size="2" type="button" disabled className="w-full shrink-0 sm:w-auto">
					<MessageSquare className="h-4 w-4 shrink-0 opacity-50" aria-hidden />
					Chat unavailable
				</Button>
			)}
		</div>
	);
}
