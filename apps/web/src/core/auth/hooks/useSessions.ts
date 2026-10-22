import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { toast } from "@/core/ui/toast";

import { getSessions, revokeSession } from "../api";
import { useAuthStore } from "../store";

export function useSessions() {
  return useQuery({
    queryKey: ["sessions"],
    queryFn: () => getSessions(),
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
    onError: () => {
      toast.error("Nepodařilo se odhlásit zařízení. Zkuste to prosím znovu.");
    },
  });
}

export function useRevokeMultipleSessions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sessionIds: string[]) => {
      await Promise.all(sessionIds.map((id) => revokeSession(id)));
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      await useAuthStore.getState().checkAuth();
      if (!useAuthStore.getState().isAuthenticated) {
        window.location.href = "/login";
        return;
      }
      toast.success("Zařízení byla úspěšně odhlášena.");
    },
    onError: () => {
      toast.error("Nepodařilo se odhlásit některá zařízení. Zkuste to prosím znovu.");
    },
  });
}
