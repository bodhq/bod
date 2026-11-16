"use client";

import { useQueries } from "@tanstack/react-query";

import { listAllRows, workspaceKey } from "@/modules/shared/records/api";
import { useRecordCatalog } from "@/modules/shared/records/catalog";

/** Preparing workloads also works before the plan has a timetable variant. */
export function useTeachingPlanData(planId: string) {
  const { getResource } = useRecordCatalog();
  const ids = ["teaching_assignments", "teaching_cycle_weeks", "teaching_assignment_weeks"];
  const queries = useQueries({
    queries: ids.map((id) => ({
      queryKey: [...workspaceKey, "teaching-plan", planId, id],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        listAllRows(
          getResource(id),
          signal,
          id === "teaching_assignment_weeks" ? {} : { teaching_plan_id: planId },
        ),
      enabled: !!planId,
    })),
  });
  const assignments = queries[0]?.data ?? [];
  const idsInPlan = new Set(assignments.map((assignment) => assignment.id));
  return {
    assignments,
    weeks: queries[1]?.data ?? [],
    // The workload collection currently only filters by one assignment, not by plan.
    loads: (queries[2]?.data ?? []).filter((load) => idsInPlan.has(load.teaching_assignment_id)),
    loading: queries.some((query) => query.isPending),
    error: queries.find((query) => query.isError)?.error,
    retry: () => Promise.all(queries.map((query) => query.refetch())),
  };
}
