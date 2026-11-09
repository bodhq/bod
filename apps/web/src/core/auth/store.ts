import type { User } from "./api";

import { create } from "zustand";

interface AuthState {
  user: User | null;
  sessionVersion: number;
  setUser: (user: User | null) => void;
  setSessionUser: (user: User | null) => void;
}

export function hasSameAuthContext(previous: User | null, next: User | null): boolean {
  const previousPermissions = previous?.permissions ?? [];
  const nextPermissions = next?.permissions ?? [];
  return (
    previous?.id === next?.id &&
    previous?.active_role === next?.active_role &&
    previousPermissions.length === nextPermissions.length &&
    previousPermissions.every((permission) => nextPermissions.includes(permission))
  );
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  sessionVersion: 0,
  setUser: (user) =>
    set((state) => ({
      user,
      sessionVersion: state.sessionVersion + Number(!hasSameAuthContext(state.user, user)),
    })),
  // A new login is a new session even when it belongs to the same account and role.
  setSessionUser: (user) => set((state) => ({ user, sessionVersion: state.sessionVersion + 1 })),
}));

export const useAuthUser = () => useAuthStore((state) => state.user);
