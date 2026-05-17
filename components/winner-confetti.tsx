"use client";

import { useEffect, useRef } from "react";

const STORAGE_PREFIX = "giveaway-wins-confetti";

function winIdsKey(winIds: string[]): string {
	return winIds.slice().sort().join(",");
}

function shouldCelebrate(experienceId: string, winIds: string[]): boolean {
	if (winIds.length === 0) return false;
	try {
		const stored = sessionStorage.getItem(`${STORAGE_PREFIX}-${experienceId}`);
		return stored !== winIdsKey(winIds);
	} catch {
		return true;
	}
}

function markCelebrated(experienceId: string, winIds: string[]) {
	try {
		sessionStorage.setItem(`${STORAGE_PREFIX}-${experienceId}`, winIdsKey(winIds));
	} catch {
		// ignore
	}
}

const WHOP_CONFETTI_COLORS = ["#22c55e", "#4ade80", "#86efac", "#bbf7d0", "#ffffff"];

async function burstConfetti(
	fire: (options: import("canvas-confetti").Options) => void,
) {
	const base = {
		spread: 70,
		startVelocity: 42,
		ticks: 160,
		colors: WHOP_CONFETTI_COLORS,
		disableForReducedMotion: true,
	};
	fire({ ...base, particleCount: 90, origin: { x: 0.2, y: 0.55 } });
	fire({ ...base, particleCount: 90, origin: { x: 0.8, y: 0.55 } });
	await new Promise((r) => setTimeout(r, 180));
	fire({ ...base, particleCount: 70, origin: { x: 0.5, y: 0.4 }, scalar: 1.05 });
}

/** Fires confetti when the user has new win(s) they haven't celebrated this session. */
export function WinnerConfettiOnLoad(props: {
	experienceId: string;
	winIds: string[];
	enabled?: boolean;
}) {
	const enabled = props.enabled ?? true;
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const firedRef = useRef(false);
	const winKey = winIdsKey(props.winIds);

	useEffect(() => {
		if (!enabled || props.winIds.length === 0 || firedRef.current) return;
		if (!shouldCelebrate(props.experienceId, props.winIds)) return;

		firedRef.current = true;

		const timer = window.setTimeout(() => {
			void (async () => {
				const canvas = canvasRef.current;
				if (!canvas) return;

				try {
					const confettiMod = await import("canvas-confetti");
					const confetti = confettiMod.default;
					const fire = confetti.create(canvas, {
						resize: true,
						useWorker: true,
					});
					await burstConfetti(fire);
					markCelebrated(props.experienceId, props.winIds);
				} catch (e) {
					console.warn("[winner-confetti]", e);
					firedRef.current = false;
				}
			})();
		}, 450);

		return () => window.clearTimeout(timer);
	}, [props.experienceId, enabled, winKey]);

	return (
		<canvas
			ref={canvasRef}
			className="pointer-events-none fixed inset-0 z-[99999] h-full w-full"
			aria-hidden
		/>
	);
}
