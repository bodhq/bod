"use client";

import { useQuery } from "@tanstack/react-query";

import { timetableQueries } from "../queries";

export function useTimetableEditor(versionId: string) {
  const query = useQuery(timetableQueries.overview(versionId));
  const overview = query.data;
  const assignments = (overview?.assignments ?? []).map((assignment) => ({
    ...assignment,
    id: assignment.teaching_assignment_id,
    teaching_plan_id: overview?.plan.id,
  }));
  const names: Record<string, Record<string, string>> = {
    subjects: Object.fromEntries(assignments.map((row) => [row.subject_id, row.subject_name])),
    teaching_groups: Object.fromEntries(assignments.map((row) => [row.group_id, row.group_name])),
    users: Object.fromEntries(assignments.map((row) => [row.teacher_id, row.teacher_name])),
    rooms: Object.fromEntries(
      (overview?.entries ?? []).flatMap((row) =>
        row.room_id ? [[row.room_id, row.room_code ?? row.room_name ?? "Učebna"]] : [],
      ),
    ),
  };
  return {
    overview,
    names,
    // Labels enrich the read model but are not part of the optimistic write state.
    entries: (overview?.entries ?? []).map(
      ({ room_code: _code, room_name: _name, ...entry }) => entry,
    ),
    assignments,
    weeks: overview?.cycle_weeks ?? [],
    slots: overview?.time_slots ?? [],
    workloads: overview?.workloads ?? [],
    loading: query.isPending,
    error: query.error,
    retry: () => query.refetch(),
  };
}
