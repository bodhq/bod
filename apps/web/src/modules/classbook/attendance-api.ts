import type { ExcuseDetail } from "@bod/api-client/types.gen";
import type { AttendanceView } from "./attendance";

import { getSchedule } from "@/modules/timetable/api";
import { scheduleNames } from "@/modules/timetable/names";

import { getExcuseDetail, getMyAttendance, getMyExcuses, getMyLessons } from "./api";

/** Compose the existing public endpoints without extending the backend contract. */
export async function getAttendanceView(
  student: string,
  period: { from: string; to: string },
  options: { schedule: boolean; requests: boolean },
  signal?: AbortSignal,
): Promise<AttendanceView[]> {
  const [records, lessons, schedule, requests] = await Promise.all([
    getMyAttendance(student, signal, period),
    getMyLessons(signal, period),
    options.schedule ? getSchedule(period.from, period.to, student, signal) : [],
    options.requests ? getMyExcuses(signal) : [],
  ]);
  const entries = new Map(lessons.map((lesson) => [lesson.id, lesson]));
  const names = scheduleNames(schedule);
  const pending = new Set<string>();
  const subjects = new Map<string, string>();
  const open = requests.filter(
    (request) => request.student_id === student && request.status === "open",
  );
  // The API exposes only this actor's requests. Never infer another guardian's state.
  for (let offset = 0; offset < open.length; offset += 4) {
    signal?.throwIfAborted();
    const details: ExcuseDetail[] = await Promise.all(
      open.slice(offset, offset + 4).map((request) => getExcuseDetail(request.id, signal)),
    );
    for (const detail of details)
      for (const item of detail.items) {
        subjects.set(item.lesson_id, item.subject_name);
        if (detail.status === "open" && item.item.decision === "pending")
          pending.add(item.attendance.id);
      }
  }
  return records.map((record) => {
    const lesson = entries.get(record.classbook_entry_id);
    const state =
      record.status === "present"
        ? "not_required"
        : record.is_excused
          ? "excused"
          : pending.has(record.id)
            ? "pending"
            : "unresolved";
    return {
      ...record,
      starts_at: lesson?.starts_at ?? null,
      ends_at: lesson?.ends_at ?? null,
      subject_name:
        subjects.get(record.classbook_entry_id) ??
        (lesson ? names.subjects[lesson.subject_id] : undefined) ??
        "Předmět neuveden",
      group_name:
        (lesson ? names.teaching_groups[lesson.group_id] : undefined) ?? "Skupina neuvedena",
      absence_minutes:
        record.status === "present"
          ? 0
          : record.status === "late"
            ? record.late_minutes
            : record.missed_minutes,
      excuse_state: state,
      can_request_excuse: options.requests && state === "unresolved",
    };
  });
}
