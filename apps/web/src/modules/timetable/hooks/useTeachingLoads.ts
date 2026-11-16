"use client";

import type { Row } from "@/modules/shared/records/types";

import { useState } from "react";

import { useRecordCatalog } from "@/modules/shared/records/catalog";
import { rowLabel, shortId } from "@/modules/shared/records/format";
import { useReferenceNames, useWorkspaceRefresh } from "@/modules/shared/records/hooks";

import { usePlanningData } from "./usePlanningData";
import { useTeachingPlanData } from "./useTeachingPlanData";

export function useTeachingLoads({ planId }: { planId: string }) {
  const data = useTeachingPlanData(planId);
  const planning = usePlanningData();
  const names = useReferenceNames(["users"]);
  const { getResource } = useRecordCatalog();
  const refresh = useWorkspaceRefresh();
  const [search, setSearch] = useState("");
  const [teacher, setTeacher] = useState("");
  const [editor, setEditor] = useState<{ row?: Row } | null>(null);
  const assignments = data.assignments.filter((row) => row.teaching_plan_id === planId);
  const weeks = data.weeks
    .filter((row) => row.teaching_plan_id === planId)
    .sort((a, b) => Number(a.position) - Number(b.position));
  const label = (id: unknown, collection: string, fallback: string) => {
    const row = planning.rows(collection).find((item) => (item.id ?? item.code) === id);
    return row ? rowLabel(row) : `${fallback} ${shortId(id)}`;
  };
  const teacherName = (id: unknown) =>
    planning.rows("users").find((row) => row.id === id)
      ? rowLabel(planning.rows("users").find((row) => row.id === id) ?? {})
      : (names.users?.[String(id)] ?? `Vyučující ${shortId(id)}`);
  const rows = assignments
    .filter((row) => !teacher || row.teacher_id === teacher)
    .filter((row) =>
      `${label(row.subject_id, "subjects", "Předmět")} ${label(row.group_id, "teaching_groups", "Skupina")} ${teacherName(row.teacher_id)}`
        .toLocaleLowerCase("cs")
        .includes(search.toLocaleLowerCase("cs")),
    );
  const missing = assignments.filter((row) =>
    weeks.some(
      (week) =>
        !data.loads.some(
          (load) => load.teaching_assignment_id === row.id && load.cycle_week_id === week.id,
        ),
    ),
  ).length;
  const fields = getResource("teaching_assignments")
    .fields.filter((field) => field.name !== "teaching_plan_id")
    .map((field) =>
      field.name === "required_room_type_code"
        ? { ...field, label: "Typ učebny pro všechny hodiny" }
        : field,
    );
  return {
    data,
    getResource,
    refresh,
    search,
    setSearch,
    teacher,
    setTeacher,
    editor,
    setEditor,
    assignments,
    weeks,
    label,
    teacherName,
    rows,
    missing,
    fields,
  };
}
