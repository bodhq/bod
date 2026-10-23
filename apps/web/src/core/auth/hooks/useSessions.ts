import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { toast } from "@/core/ui/toast";

import { getSessions, revokeSession } from "../api";
import { useAuthStore } from "../store";

export function useSessions(enabled = true) {
  return useQuery({
    queryKey: ["sessions"],
    queryFn: () => getSessions(),
    enabled,
  });
}

export function useRevokeSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sessionId: string) => revokeSession(sessionId),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      await useAuthStore.getState().checkAuth();
      if (!useAuthStore.getState().isAuthenticated) {
        window.location.href = "/login";
        return; // Zastavíme další provádění, aby se neukázal toast
      }
      toast.success("Zařízení bylo úspěšně odhlášeno.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Nepodařilo se odhlásit zařízení.");
    },
  });
}

export function useRevokeMultipleSessions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sessionIds: string[]) => {
      const results = await Promise.allSettled(sessionIds.map((id) => revokeSession(id)));
      const firstFailure = results.find(
        (result): result is PromiseRejectedResult => result.status === "rejected",
      );
      if (firstFailure) throw firstFailure.reason;
    },
    onSuccess: () => {
      toast.success("Zařízení byla úspěšně odhlášena.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Nepodařilo se odhlásit všechna zařízení.");
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["sessions"] });
      await useAuthStore.getState().checkAuth();
      if (!useAuthStore.getState().isAuthenticated) {
        window.location.href = "/login";
      }
    },
  });
}
