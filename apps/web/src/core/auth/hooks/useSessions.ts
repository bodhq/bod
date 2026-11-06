import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { toast } from "@/core/ui/toast";

import { getSessions } from "../api";
import { replaceAuthUser, revokeSessionsInOrder } from "../session";
import { useAuthStore } from "../store";

export function useSessions(enabled = true) {
  return useQuery({
    queryKey: ["sessions"],
    queryFn: ({ signal }) => getSessions({ signal }),
    enabled,
  });
}

function useRevokeSessions<T>(toIds: (value: T) => string[], successMessage: string) {
  const queryClient = useQueryClient();
  const router = useRouter();
  return useMutation({
    onMutate: () => useAuthStore.getState().sessionVersion,
    mutationFn: (value: T) =>
      revokeSessionsInOrder(toIds(value), useAuthStore.getState().sessionVersion),
    onSuccess: async ({ currentRevoked }, _value, version) => {
      if (version !== useAuthStore.getState().sessionVersion) return;
      if (currentRevoked) {
        if (!(await replaceAuthUser(queryClient, null, version))) return;
        router.replace("/login");
        router.refresh();
      } else {
        toast.success(successMessage);
      }
    },
    onError: (error: Error, _value, version) => {
      if (version === useAuthStore.getState().sessionVersion)
        toast.error(error.message || "Nepodařilo se odhlásit všechna vybraná zařízení.");
    },
    onSettled: async (_data, _error, _value, version) => {
      if (version === useAuthStore.getState().sessionVersion) {
        await queryClient.invalidateQueries({ queryKey: ["sessions"] });
      }
    },
  });
}

export function useRevokeSession() {
  return useRevokeSessions<string>((id) => [id], "Zařízení bylo úspěšně odhlášeno.");
}

export function useRevokeMultipleSessions() {
  return useRevokeSessions<string[]>((ids) => ids, "Zařízení byla úspěšně odhlášena.");
}
