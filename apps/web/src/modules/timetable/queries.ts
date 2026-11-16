import { queryOptions } from "@tanstack/react-query";

import { workspaceKey } from "@/modules/shared/records/api";

import { getSchedule, getVersionOverview } from "./api";

export const timetableQueries = {
  overview: (versionId: string) =>
    queryOptions({
      queryKey: [...workspaceKey, "version-overview", versionId],
      queryFn: ({ signal }) => getVersionOverview(versionId, signal),
      enabled: !!versionId,
    }),
  week: (from: string, to: string, student = "") =>
    queryOptions({
      queryKey: [...workspaceKey, "schedule", from, to, student],
      queryFn: ({ signal }) => getSchedule(from, to, student || undefined, signal),
    }),
};
