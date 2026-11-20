"use client";

import type { Row } from "@/modules/shared/records/types";

import { useQueries } from "@tanstack/react-query";
import { useState } from "react";

import { today } from "@/core/time/school";
import { listAllRows, workspaceKey } from "@/modules/shared/records/api";
import { useRecordCatalog } from "@/modules/shared/records/catalog";
import { useWorkspaceRefresh } from "@/modules/shared/records/hooks";

import { cyclePhases } from "../cycle";

export function useAcademicCalendar({ plan }: { plan: Row }) {
  const { getResource, workflows } = useRecordCatalog();
  const refresh = useWorkspaceRefresh();
  const ids = [
    "teaching_plan_calendar_days",
    "teaching_plan_calendar_weeks",
    "teaching_cycle_weeks",
    "teaching_cycle_steps",
    "school_years",
  ];
  const queries = useQueries({
    queries: ids.map((id) => ({
      queryKey: [...workspaceKey, "visual-calendar", id],
      queryFn: ({ signal }: { signal: AbortSignal }) => listAllRows(getResource(id), signal),
    })),
  });
  const rows = (index: number) =>
    (queries[index]?.data ?? []).filter((row) => row.teaching_plan_id === plan.id);
  const days = rows(0),
    weekDates = rows(1),
    weeks = rows(2),
    phases = cyclePhases(rows(3));
  const year = queries[4]?.data?.find((row) => row.id === plan.school_year_id);
  const [month, setMonth] = useState(String(plan.cycle_anchor_monday ?? today()).slice(0, 7));
  const [editing, setEditing] = useState<{ kind: "day" | "week"; date: string } | null>(null);
  const locked = !!plan.frozen_at;
  const [generating, setGenerating] = useState(false);
  const calendarAction = workflows.find((workflow) => workflow.id === "calendar");
  return {
    getResource,
    refresh,
    queries,
    days,
    weekDates,
    weeks,
    phases,
    year,
    month,
    setMonth,
    editing,
    setEditing,
    locked,
    generating,
    setGenerating,
    calendarAction,
  };
}
