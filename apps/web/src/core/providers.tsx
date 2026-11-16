"use client";

import type { ReactNode } from "react";

import { ThemeProvider } from "next-themes";

import { AppearanceProvider } from "./appearance/AppearanceProvider";
import { QueryProvider } from "./query";
import { ConfirmProvider } from "./ui/overlays/ConfirmProvider";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        scriptProps={{
          // Keep the server startup script executable; make client renders a non-executable data block.
          type: typeof window === "undefined" ? "text/javascript" : "application/json",
        }}
      >
        <AppearanceProvider>
          <ConfirmProvider>{children}</ConfirmProvider>
        </AppearanceProvider>
      </ThemeProvider>
    </QueryProvider>
  );
}
