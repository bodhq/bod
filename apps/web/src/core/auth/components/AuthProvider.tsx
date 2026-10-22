"use client";

import type { User } from "../api";

import { useLayoutEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { useAuthStore } from "../store";

export interface AuthProviderProps {
  children: React.ReactNode;
  initialUser: User | null;
}

export function AuthProvider({ children, initialUser }: AuthProviderProps) {
  const initialized = useRef(false);
  const router = useRouter();
  const pathname = usePathname();

  // Use useLayoutEffect to update the store synchronously before paint on the client,
  // avoiding the "Cannot update a component while rendering a different component" warning.
  useLayoutEffect(() => {
    if (!initialized.current) {
      useAuthStore.setState({ user: initialUser, isLoading: false });
      initialized.current = true;
    } else if (initialUser !== undefined) {
      useAuthStore.getState().setUser(initialUser);
    }
  }, [initialUser]);

  useEffect(() => {
    if (initialUser?.must_change_password && pathname !== "/app/settings/security") {
      router.replace("/app/settings/security");
    }
  }, [initialUser?.must_change_password, pathname, router]);

  return <>{children}</>;
}
