"use client";

import { useQueries, useQueryClient } from "@tanstack/react-query";

import { useAuthUser } from "@/core/auth/store";
import { collectPages, listAllRows, userOptions, workspaceKey } from "@/modules/shared/records/api";
import { useRecordCatalog } from "@/modules/shared/records/catalog";
import { rowLabel } from "@/modules/shared/records/format";

export function usePermissions() {
  const user = useAuthUser();
  return (permission: string) =>
    !user?.must_change_password && !!user?.permissions?.includes(permission);
}
export function useWorkspaceRefresh() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: workspaceKey });
}
export function useReferenceNames(references: string[]) {
  const { resources, getResource } = useRecordCatalog();
  const can = usePermissions();
  const user = useAuthUser();
  const sources = [...new Set(references)].filter((id) =>
    can(
      id === "users"
        ? "users.manage"
        : (resources.find((resource) => resource.id === id)?.permission ?? ""),
    ),
  );
  const queries = useQueries({
    queries: sources.map((id) => ({
      queryKey: [...workspaceKey, "reference-names", id],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        id === "users"
          ? collectPages((offset) => userOptions(offset, signal), signal)
          : listAllRows(getResource(id), signal),
    })),
  });
  const names: Record<string, Record<string, string>> = {};
  sources.forEach((id, index) => {
    names[id] = Object.fromEntries(
      (queries[index]?.data ?? []).map((row) => [
        String(row.id ?? row.code ?? row.group_id),
        rowLabel(row),
      ]),
    );
  });
  if (user) names.users = { ...names.users, [user.id]: rowLabel(user) };
  return names;
}
