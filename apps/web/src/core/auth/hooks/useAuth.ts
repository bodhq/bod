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
      // Mock API expects a specific structure now (Contract)
      return await apiLogin({ body: { username, password } });
    },
    onSuccess: (userData) => {
      setUser(userData);
      // TODO: Při napojení na skutečný backend by měl backend posílat "HttpOnly" cookie pomocí hlavičky Set-Cookie.
      // Frontend by se o nastavování cookie vůbec neměl starat z bezpečnostních důvodů. Pro mock to ale simulujeme:
      document.cookie = "bod_session=fake_cookie; path=/";

      // Invalidate queries that might depend on auth
      queryClient.invalidateQueries();

      // Spustíme full-screen překryv (pro případný loading dat na serveru)
      useAuthStore.getState().setTransitioning(true);

      // Počkáme 400ms na dokončení fade-in animace opony (TransitionOverlay),
      // aby nedošlo k probliknutí obsahu načtené aplikace
      setTimeout(() => {
        router.push("/app");
      }, 400);
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
      // TODO: Stejně jako u loginu, opravdový backend smaže cookie sám instrukcí v response hlavičce.
      document.cookie =
        "bod_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
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
