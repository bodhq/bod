"use client";

import type { ReactNode } from "react";

import { ThemeProvider } from "next-themes";

import { AppearanceProvider } from "./appearance/AppearanceProvider";
import { QueryProvider } from "./query";
import { ConfirmProvider } from "./ui/overlays/ConfirmProvider";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <AppearanceProvider>
          <ConfirmProvider>{children}</ConfirmProvider>
        </AppearanceProvider>
      </ThemeProvider>
    </QueryProvider>
  );
}
