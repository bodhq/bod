import type { AttendanceRecordsRead } from "@bod/api-client/types.gen";

export interface AttendanceView extends AttendanceRecordsRead {
  starts_at: string | null;
  ends_at: string | null;
  subject_name: string;
  group_name: string;
  absence_minutes: number | null;
  excuse_state: "not_required" | "unresolved" | "pending" | "excused";
  can_request_excuse: boolean;
}

import { addDays, today } from "@/core/time/school";

export const excuseStates = {
  not_required: { label: "Bez absence", tone: "neutral" },
  unresolved: { label: "Bez potvrzeného omluvení", tone: "warning" },
  pending: { label: "Vaše žádost čeká", tone: "info" },
  excused: { label: "Omluveno", tone: "success" },
} as const;

export function initialAttendancePeriod() {
  const from = `${today().slice(0, 7)}-01`;
  const next = new Date(`${from}T12:00:00Z`);
  next.setUTCMonth(next.getUTCMonth() + 1);
  return { from, to: addDays(next.toISOString().slice(0, 10), -1) };
}

export function attendancePeriodError(from: string, to: string) {
  const valid = (day: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(day) &&
    Number.isFinite(Date.parse(day)) &&
    new Date(day).toISOString().slice(0, 10) === day;
  if (!valid(from) || !valid(to)) return "Vyplňte začátek a konec období.";
  return from > to ? "Začátek období musí být před koncem nebo ve stejný den." : null;
}

export function attendanceSummary(records: AttendanceView[]) {
  return {
    records: records.length,
    minutes: records.reduce((sum, record) => sum + (record.absence_minutes ?? 0), 0),
    unknownMinutes: records.filter(
      (record) => record.status !== "present" && record.absence_minutes == null,
    ).length,
    pending: records.filter((record) => record.excuse_state === "pending").length,
  };
}
