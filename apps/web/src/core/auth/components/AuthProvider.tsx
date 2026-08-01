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

  // Set initial state on first render to match SSR and prevent hydration mismatch
  if (!initialized.current) {
    useAuthStore.setState({ user: initialUser, isLoading: false });
    initialized.current = true;
  }

  useEffect(() => {
    if (initialUser !== undefined) {
      useAuthStore.getState().setUser(initialUser);
    }
  }, [initialUser]);

  return <>{children}</>;
}
