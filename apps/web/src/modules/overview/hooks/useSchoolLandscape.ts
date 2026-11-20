"use client";
import { useQueries } from "@tanstack/react-query";

import { listAllRows, workspaceKey } from "@/modules/shared/records/api";
import { useRecordCatalog } from "@/modules/shared/records/catalog";
import { usePermissions } from "@/modules/shared/records/hooks";

const collections = [
  "school_years",
  "classes",
  "teaching_groups",
  "rooms",
  "room_types",
  "teaching_plans",
];

export function useSchoolLandscape() {
  const { getResource } = useRecordCatalog();
  const can = usePermissions();
  const allowed = collections.filter((id) => can(getResource(id).permission));
  const queries = useQueries({
    queries: allowed.map((id) => ({
      queryKey: [...workspaceKey, "school-landscape", id],
      queryFn: ({ signal }: { signal: AbortSignal }) => listAllRows(getResource(id), signal),
    })),
  });
  const rows = (id: string) => queries[allowed.indexOf(id)]?.data ?? [];
  return { allowed, queries, rows };
}
