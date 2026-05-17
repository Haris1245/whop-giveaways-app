"use client";

import Link from "next/link";
import { Button, IconButton } from "frosted-ui";
import { ArrowLeft } from "lucide-react";
import type { ComponentProps } from "react";

export function BackLink({
	href,
	label,
	variant = "surface",
	className,
	showLabel = false,
}: {
	href: string;
	label: string;
	variant?: ComponentProps<typeof IconButton>["variant"];
	className?: string;
	showLabel?: boolean;
}) {
	if (showLabel) {
		return (
			<Button asChild variant="soft" color="gray" size="2" className={className}>
				<Link href={href} className="inline-flex items-center gap-2">
					<ArrowLeft className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
					{label}
				</Link>
			</Button>
		);
	}

	return (
		<IconButton
			variant={variant}
			color="gray"
			size="2"
			asChild
			className={className}
		>
			<Link href={href} aria-label={label}>
				<ArrowLeft className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
			</Link>
		</IconButton>
	);
}
