"use client";

import type { Row } from "../types";

import { useQueries } from "@tanstack/react-query";

import { listAllRows, workspaceKey } from "../api";
import { useRecordCatalog } from "../catalog";
import { usePermissions } from "../hooks";

/** Complete, permission-aware records for a workflow; inaccessible records stay unavailable. */
export function useRecordData(ids: string[]) {
  const { getResource } = useRecordCatalog();
  const can = usePermissions();
  const queries = useQueries({
    queries: ids.map((id) => ({
      queryKey: [...workspaceKey, "planning", id],
      queryFn: ({ signal }: { signal: AbortSignal }) => listAllRows(getResource(id), signal),
      enabled: can(getResource(id).permission),
    })),
  });
  const available = (id: string) => queries[ids.indexOf(id)]?.isSuccess ?? false;
  return {
    rows: (id: string): Row[] => queries[ids.indexOf(id)]?.data ?? [],
    available,
    loading: queries.some((query) => query.isLoading),
    errors: ids.filter((_, index) => queries[index]?.isError),
    retry: () =>
      Promise.all(
        queries
          .filter((_query, index) => can(getResource(ids[index] ?? "").permission))
          .map((query) => query.refetch()),
      ),
  };
}
