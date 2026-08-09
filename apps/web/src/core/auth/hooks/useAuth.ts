import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Logger } from "@/core/logger";
import { login as apiLogin, logout as apiLogout } from "../api";
import { useAuthStore } from "../store";

/**
 * VRSTVA 2: LOGIKA (Hooks)
 * Tento hook abstrahuje veškerou asynchronní logiku od UI komponent.
 * UI komponenta nesmí vědět, jak probíhá login, jen zavolá `login(email, password)`.
 */
export function useAuth() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isAuthenticated, isLoading, setUser } = useAuthStore();

  const [error, setError] = useState<string | null>(null);

  // TanStack Query Mutation pro Login
  const loginMutation = useMutation({
    mutationFn: async ({
      username,
      password,
    }: {
      username: string;
      password: string;
    }) => {
      // Backend očekává email
      return await apiLogin({ body: { email: username, password } } as any);
    },
    onSuccess: (userData) => {
      setUser(userData);

      // Invalidate queries that might depend on auth
      queryClient.invalidateQueries();

      router.push("/app");
    },
    onError: (err: Error) => {
      setError(err.message || "Neočekávaná chyba při přihlašování.");
    },
  });

  // TanStack Query Mutation pro Logout
  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiLogout();
    },
    onSuccess: () => {
      setUser(null);
      queryClient.clear(); // Smažeme celou cache při odhlášení
      router.push("/login");
    },
    onError: (err) => {
      Logger.error("Chyba při odhlašování", err);
    },
  });

  const login = (username: string, pass: string) => {
    setError(null);
    loginMutation.mutate({ username, password: pass });
  };

  const logout = () => {
    logoutMutation.mutate();
  };

  const loginAsync = async (username: string, pass: string) => {
    setError(null);
    return loginMutation.mutateAsync({ username, password: pass });
  };

  const logoutAsync = async () => {
    return logoutMutation.mutateAsync();
  };

  return {
    user,
    isAuthenticated,
    isLoading, // Globální načítání při startu aplikace (nyní přes server komponenty)
    isPending: loginMutation.isPending || logoutMutation.isPending,
    error,
    login,
    loginAsync,
    logout,
    logoutAsync,
  };
}
