"use client";
import type { ScheduleLesson } from "@bod/api-client/types.gen";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useAuthUser } from "@/core/auth/store";
import { useChildren } from "@/modules/classbook/hooks/useChildren";
import { classbookQueries } from "@/modules/classbook/queries";
import { addDays, monday, today } from "@/modules/shared/records/format";
import { usePermissions, useWorkspaceRefresh } from "@/modules/shared/records/hooks";

import { timetableQueries } from "../queries";

export function useScheduleWorkspace() {
  const user = useAuthUser();
  const can = usePermissions();
  const refresh = useWorkspaceRefresh();
  const [start, setStart] = useState(() => monday(today()));
  const [student, setStudent] = useState(() =>
    typeof window === "undefined"
      ? ""
      : (new URLSearchParams(window.location.search).get("student") ?? ""),
  );
  const { parent, children } = useChildren();
  const [recording, setRecording] = useState<ScheduleLesson | null>(null);
  const end = addDays(start, 7);
  const query = useQuery({
    ...timetableQueries.week(start, end, student),
    enabled: can("timetable.read"),
  });
  const lessons = useQuery({
    ...classbookQueries.lessons(),
    enabled: can("classbook.read") && can("classbook.write"),
  });
  return {
    user,
    can,
    refresh,
    start,
    setStart,
    setStudent,
    student,
    parent,
    children,
    recording,
    setRecording,
    end,
    query,
    lessons,
  };
}
