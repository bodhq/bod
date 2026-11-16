"use client";

import { useQuery } from "@tanstack/react-query";

import { useConfirm } from "@/core/ui/overlays/ConfirmProvider";
import { getMyExcuses } from "@/modules/classbook/api";
import { workspaceKey } from "@/modules/shared/records/api";
import { useWorkspaceRefresh } from "@/modules/shared/records/hooks";

export function useOwnExcuses() {
  const confirm = useConfirm();
  const refresh = useWorkspaceRefresh();
  const query = useQuery({
    queryKey: [...workspaceKey, "my-excuses"],
    queryFn: ({ signal }) => getMyExcuses(signal),
  });
  return { confirm, refresh, query };
}
