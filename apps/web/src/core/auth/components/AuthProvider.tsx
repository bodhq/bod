"use client";

import type { User } from "../api";

import { useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { Fragment, useEffect, useLayoutEffect } from "react";

import { refreshAuthUser } from "../session";
import { hasSameAuthContext, useAuthStore, useAuthUser } from "../store";

export interface AuthProviderProps {
  children: React.ReactNode;
  initialUser: User | null;
}

export function AuthProvider({ children, initialUser }: AuthProviderProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthUser();
  const sessionVersion = useAuthStore((state) => state.sessionVersion);

  useLayoutEffect(() => {
    if (!hasSameAuthContext(useAuthStore.getState().user, initialUser)) queryClient.clear();
    useAuthStore.getState().setUser(initialUser);
  }, [initialUser, queryClient]);

  // SSR skips renewal; this browser request can receive the refreshed session cookie.
  useEffect(() => {
    if (!initialUser) return;
    const controller = new AbortController();
    void refreshAuthUser(queryClient, { signal: controller.signal })
      .then(({ user, applied }) => {
        if (!controller.signal.aborted && applied && !user)
          router.replace("/login?error=unauthorized");
      })
      .catch(() => {
        // A network failure or cancellation leaves the last confirmed user intact.
      });
    return () => controller.abort();
  }, [initialUser, queryClient, router]);

  useEffect(() => {
    if (user?.must_change_password && pathname !== "/app/settings/security") {
      router.replace("/app/settings/security");
    }
  }, [user?.must_change_password, pathname, router]);

  return <Fragment key={sessionVersion}>{children}</Fragment>;
}
