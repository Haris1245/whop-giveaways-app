"use client";

import type { ReactNode } from "react";
import { DropdownMenu, IconButton } from "frosted-ui";
import { MessageSquare, MoreHorizontal, Trash2 } from "lucide-react";
import { whopMessageHref } from "@/lib/whop-message-href";

/** Frosted menu items use `justify-between`; keep icon + label one flex unit so spacing is consistent. */
function MenuRow({ children }: { children: ReactNode }) {
	return (
		<span className="inline-flex min-w-0 items-center gap-2 [&_svg]:shrink-0">{children}</span>
	);
}

export function EntrantRowActions({
	username,
	onDelete,
}: {
	username: string;
	onDelete?: () => void;
}) {
	const profileHref = whopMessageHref(username);

	return (
		<DropdownMenu.Root>
			<DropdownMenu.Trigger>
				<IconButton
					variant="ghost"
					color="gray"
					size="2"
					aria-label={`Actions for ${username}`}
				>
					<MoreHorizontal />
				</IconButton>
			</DropdownMenu.Trigger>
			<DropdownMenu.Content variant="solid" size="2" align="end" sideOffset={6}>
				<DropdownMenu.Item
					disabled={!profileHref}
					onSelect={(e) => {
						e.preventDefault();
						if (profileHref) window.open(profileHref, "_blank", "noopener,noreferrer");
					}}
				>
					<MenuRow>
						<MessageSquare className="h-4 w-4 opacity-80" aria-hidden />
						Message
					</MenuRow>
				</DropdownMenu.Item>

				<DropdownMenu.Separator />

				<DropdownMenu.Item
					color="danger"
					onSelect={(e) => {
						e.preventDefault();
						onDelete?.();
					}}
				>
					<MenuRow>
						<Trash2 className="h-4 w-4 opacity-90" aria-hidden />
						Remove entrant
					</MenuRow>
				</DropdownMenu.Item>
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	);
}
