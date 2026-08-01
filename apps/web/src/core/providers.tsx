"use client";

import type { ReactNode } from "react";
import { QueryProvider } from "./query";

/**
 * Centrální obálka pro veškerou infrastrukturní vrstvu aplikace.
 * Místo abychom do root layoutu psali deset různých providerů
 * (QueryProvider, ThemeProvider, ToastProvider), vložíme je všechny sem.
 * Tím udržíme root layout naprosto čistý a bez závislostí.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      {/* V budoucnu zde přibudou: 
          <ThemeProvider>
          <ToastProvider> 
      */}
      {children}
    </QueryProvider>
  );
}
