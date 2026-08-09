import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
// TODO: Až Filip dokončí backend a spustíš `pnpm gen:api`, smaž tuto řádku a odkomentuj import z api-clienta
import { getMe, type User } from "./api";

// import { authMeGet as getMe, type UserPublic as User } from '@bod/api-client';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  // Akce
  checkAuth: () => Promise<void>;
  setUser: (user: User | null) => void;
}

export const useAuthStore = create<AuthState>()(
  devtools(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: true, // Na začátku vždy true, než se zeptáme API

      checkAuth: async () => {
        try {
          const user = await getMe();
          set(
            { user, isAuthenticated: !!user, isLoading: false },
            false,
            "auth/checkAuth",
          );
        } catch {
          set(
            { user: null, isAuthenticated: false, isLoading: false },
            false,
            "auth/checkAuthError",
          );
        }
      },

      setUser: (user) =>
        set({ user, isAuthenticated: !!user }, false, "auth/setUser"),
    }),
    { name: "AuthStore" },
  ),
);

// Atomické selektory pro prevenci zbytečných re-renderů
export const useAuthUser = () =>
  useAuthStore(useShallow((state) => state.user));
export const useAuthIsAuthenticated = () =>
  useAuthStore((state) => state.isAuthenticated);
export const useAuthIsLoading = () => useAuthStore((state) => state.isLoading);
export const useAuthActions = () =>
  useAuthStore(
    useShallow((state) => ({
      checkAuth: state.checkAuth,
      setUser: state.setUser,
    })),
  );
