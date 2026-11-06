"use client";

import type { ReactNode } from "react";

import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { isUnauthenticated } from "@/core/api/api-errors";
import { useAuthStore } from "@/core/auth/store";

// Globální handler pro 401 Unauthorized
const handleAuthError = (error: unknown, queryClient: QueryClient) => {
  if (isUnauthenticated(error)) {
    queryClient.clear();
    useAuthStore.getState().setSessionUser(null);
    if (typeof window !== "undefined" && window.location.pathname !== "/login") {
      window.location.href = "/login";
    }
  }
};

function makeQueryClient() {
  const mutationVersions = new WeakMap<object, number>();
  const queryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: (error) => handleAuthError(error, queryClient),
    }),
    mutationCache: new MutationCache({
      onMutate: (_variables, mutation) => {
        mutationVersions.set(mutation, useAuthStore.getState().sessionVersion);
      },
      onError: (error, _variables, _context, mutation) => {
        if (mutationVersions.get(mutation) === useAuthStore.getState().sessionVersion) {
          handleAuthError(error, queryClient);
        }
      },
      onSettled: (_data, _error, _variables, _context, mutation) => {
        mutationVersions.delete(mutation);
      },
    }),
    defaultOptions: {
      queries: {
        retry: (failures, error) => {
          const status = (error as { status?: number }).status;
          return (
            !isUnauthenticated(error) && !(status && status >= 400 && status < 500) && failures < 2
          );
        },
        // Zamezí zbytečnému refetchi při každém překliknutí okna
        refetchOnWindowFocus: false,
        // Pro SSR (Server-Side Rendering) v Next.js: nastavit staleTime > 0
        // aby nedocházelo k okamžitému refetchi na klientovi po načtení stránky
        staleTime: 60 * 1000,
      },
    },
  });
  return queryClient;
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
