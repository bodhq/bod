"use client";

import type { ReactNode } from "react";

import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { useAuthStore } from "@/core/auth/store";

// Globální handler pro 401 Unauthorized
const handleAuthError = (error: unknown) => {
  const apiError = error as {
    status?: number;
    response?: { status?: number };
    code?: string;
  } | null;
  if (
    apiError?.status === 401 ||
    apiError?.response?.status === 401 ||
    apiError?.code === "AUTH_UNAUTHENTICATED" ||
    apiError?.code === "AUTH_SESSION_NOT_FOUND"
  ) {
    useAuthStore.getState().setUser(null);
    if (typeof window !== "undefined" && window.location.pathname !== "/login") {
      window.location.href = "/login";
    }
  }
};

function makeQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: handleAuthError,
    }),
    mutationCache: new MutationCache({
      onError: handleAuthError,
    }),
    defaultOptions: {
      queries: {
        // Zamezí zbytečnému refetchi při každém překliknutí okna
        refetchOnWindowFocus: false,
        // Pro SSR (Server-Side Rendering) v Next.js: nastavit staleTime > 0
        // aby nedocházelo k okamžitému refetchi na klientovi po načtení stránky
        staleTime: 60 * 1000,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  if (typeof window === "undefined") {
    // Server: vždy vytváříme nového klienta pro každý request,
    // aby nedošlo k úniku dat mezi různými uživateli
    return makeQueryClient();
  } else {
    // Browser: vytvoříme klienta jen jednou (Singleton)
    // Pokud React přeruší inicializační render, nepřijdeme o něj
    if (!browserQueryClient) browserQueryClient = makeQueryClient();
    return browserQueryClient;
  }
}

export function QueryProvider({ children }: { children: ReactNode }) {
  // Inicializujeme a získáme klienta přesně podle doporučených best-practices pro Next.js App Router
  const queryClient = getQueryClient();

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
