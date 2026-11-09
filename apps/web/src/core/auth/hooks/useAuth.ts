import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { isUnauthenticated } from "@/core/api/api-errors";
import { toast } from "@/core/ui/feedback/toast";

import { login as apiLogin, logout as apiLogout } from "../api";
import { replaceAuthUser } from "../session";
import { useAuthStore } from "../store";

export function useAuth() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const version = () => useAuthStore.getState().sessionVersion;

  const loginMutation = useMutation({
    onMutate: version,
    mutationFn: ({ username, password }: { username: string; password: string }) =>
      apiLogin(username, password),
    onSuccess: async (user, _variables, startedVersion) => {
      if (!(await replaceAuthUser(queryClient, user, startedVersion))) return;
      router.replace("/app");
      router.refresh();
    },
    onError: (err: Error, _variables, startedVersion) => {
      if (version() !== startedVersion) return;
      setError(err.message || "Neočekávaná chyba při přihlašování.");
    },
  });

  const logoutMutation = useMutation({
    onMutate: version,
    mutationFn: async () => {
      try {
        await apiLogout();
      } catch (error) {
        if (!isUnauthenticated(error)) throw error;
      }
    },
    onSuccess: async (_data, _variables, startedVersion) => {
      if (!(await replaceAuthUser(queryClient, null, startedVersion))) return;
      router.replace("/login");
      router.refresh();
    },
    onError: (_error, _variables, startedVersion) => {
      if (version() === startedVersion)
        toast.error("Nepodařilo se odhlásit. Zkuste to prosím znovu.");
    },
  });

  return {
    isPending: loginMutation.isPending || logoutMutation.isPending,
    error,
    loginAsync: (username: string, password: string) => {
      setError(null);
      return loginMutation.mutateAsync({ username, password });
    },
    logoutAsync: () => logoutMutation.mutateAsync(),
  };
}
