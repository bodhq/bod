import type { Metadata } from "next";

import localFont from "next/font/local";
import NextTopLoader from "nextjs-toploader";

import { AppProviders } from "@/core/providers";
import { Toaster } from "@/core/ui/feedback/toast/Toaster";

import "./globals.css";

const jakarta = localFont({
  src: "../../public/fonts/plus-jakarta-sans.ttf",
  weight: "200 800",
  style: "normal",
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: "bod",
  description: "Modulární školní informační systém.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="cs" className={`h-full antialiased ${jakarta.variable}`} suppressHydrationWarning>
      <body className="flex min-h-full flex-col">
        <NextTopLoader
          color="var(--color-primary)"
          initialPosition={0.08}
          crawlSpeed={200}
          height={3}
          crawl={true}
          showSpinner={false}
          easing="ease"
          speed={200}
        />
        <AppProviders>
          {children}
          <Toaster />
        </AppProviders>
      </body>
    </html>
  );
}
