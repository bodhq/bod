"use client";
import type { Row } from "@/modules/shared/records/types";

import { useQuery } from "@tanstack/react-query";

import { listAllRows, workspaceKey } from "@/modules/shared/records/api";
import { useRecordCatalog } from "@/modules/shared/records/catalog";

export function usePlanningPreferences({ version }: { version: Row }) {
  const { getResource } = useRecordCatalog();
  const resource = getResource("timetable_preferences");
  const query = useQuery({
    queryKey: [...workspaceKey, "planning-preferences", version.id],
    queryFn: ({ signal }) => listAllRows(resource, signal),
  });
  return { query };
}
