import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import NextTopLoader from "nextjs-toploader";
import "./globals.css";
import { AppProviders } from "@/core/providers";
import { TransitionOverlay } from "@/core/ui/TransitionOverlay";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-sans",
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
    <html lang="cs" className={`h-full antialiased ${jakarta.variable}`}>
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
          shadow="0 0 10px var(--color-primary),0 0 5px var(--color-primary)"
        />
        <AppProviders>
          <TransitionOverlay />
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
