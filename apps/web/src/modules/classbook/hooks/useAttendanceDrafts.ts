"use client";

import type { LessonStudent, MarkAttendance } from "@bod/api-client/types.gen";

import { useState } from "react";

function initialRecord(person: LessonStudent): MarkAttendance {
  return {
    student_id: person.student_id,
    status: person.attendance?.status ?? "present",
    late_minutes: person.attendance?.late_minutes ?? null,
    missed_minutes: person.attendance?.missed_minutes ?? null,
    note: person.attendance?.note ?? null,
  };
}

export function useAttendanceDrafts(participants: LessonStudent[]) {
  const [drafts, setDrafts] = useState<Record<string, MarkAttendance>>({});
  const change = (id: string, patch: Partial<MarkAttendance>) => {
    const person = participants.find((item) => item.student_id === id);
    if (!person) return;
    setDrafts((previous) => {
      const baseline = initialRecord(person);
      const next = { ...(previous[id] ?? baseline), ...patch };
      const result = { ...previous };
      if (JSON.stringify(next) === JSON.stringify(baseline)) delete result[id];
      else result[id] = next;
      return result;
    });
  };
  return {
    records: participants.map((person) => drafts[person.student_id] ?? initialRecord(person)),
    dirty: Object.keys(drafts).length > 0,
    missing: participants.some((person) => !person.attendance),
    change,
    reset: () => setDrafts({}),
  };
}
