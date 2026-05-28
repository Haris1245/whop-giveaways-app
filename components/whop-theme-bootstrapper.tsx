"use client";

import { useLayoutEffect } from "react";

function getCookieAppearance(): "light" | "dark" | null {
	const match = document.cookie.match(
		/whop-frosted-theme=appearance:(?<appearance>light|dark)/,
	);
	const appearance = match?.groups?.appearance;
	return appearance === "light" || appearance === "dark" ? appearance : null;
}

function getSystemAppearance(): "light" | "dark" {
	return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyAppearance(appearance: "light" | "dark") {
	const el = document.documentElement;
	el.classList.remove("light", "dark");
	el.classList.add(appearance);
	el.style.colorScheme = appearance;
}

export function WhopThemeBootstrapper() {
	useLayoutEffect(() => {
		applyAppearance(getCookieAppearance() ?? getSystemAppearance());
	}, []);

	return null;
}

