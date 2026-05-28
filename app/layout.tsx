import React from "react";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "frosted-ui/styles.css";
import { Theme as FrostedTheme } from "frosted-ui";
import { WhopIframeSdkProvider } from "@whop/react/iframe";
import { WhopThemeBootstrapper } from "@/components/whop-theme-bootstrapper";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Whop App",
  description: "My Whop App",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <WhopThemeBootstrapper />
        <WhopIframeSdkProvider>
          <FrostedTheme appearance="inherit">{children}</FrostedTheme>
        </WhopIframeSdkProvider>
      </body>
    </html>
  );
}
