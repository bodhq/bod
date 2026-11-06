import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { toast } from "@/core/ui/toast";

import { switchRole } from "../api";
import { replaceAuthUser } from "../session";
import { useAuthStore } from "../store";

export function useSwitchRole() {
  const queryClient = useQueryClient();
  const router = useRouter();
  return useMutation({
    onMutate: () => useAuthStore.getState().sessionVersion,
    mutationFn: switchRole,
    onSuccess: async (user, _role, version) => {
      if (!(await replaceAuthUser(queryClient, user, version))) return;
      router.replace("/app");
      router.refresh();
      toast.success("Aktivní role byla změněna.");
    },
    onError: (error: Error, _role, version) => {
      if (version === useAuthStore.getState().sessionVersion) toast.error(error.message);
    },
  });
}
