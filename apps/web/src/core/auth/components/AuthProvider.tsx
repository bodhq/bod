"use client";

import { useEffect, useRef } from "react";
import type { User } from "../api";
import { useAuthStore } from "../store";

export interface AuthProviderProps {
  children: React.ReactNode;
  initialUser: User | null;
}

export function AuthProvider({ children, initialUser }: AuthProviderProps) {
  const initialized = useRef(false);

  // Use useLayoutEffect to update the store synchronously before paint on the client,
  // avoiding the "Cannot update a component while rendering a different component" warning.
  useEffect(() => {
    if (!initialized.current) {
      useAuthStore.setState({ user: initialUser, isLoading: false });
      initialized.current = true;
    } else if (initialUser !== undefined) {
      useAuthStore.getState().setUser(initialUser);
    }
  }, [initialUser]);

  return <>{children}</>;
}
