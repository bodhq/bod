import type { Row } from "@/modules/shared/records/types";

import { addDays, monday } from "@/core/time/school";

export interface CyclePhase {
  key: string;
  weekId: string;
  duration: number;
}
export function cyclePhases(rows: Row[]): CyclePhase[] {
  return [...rows]
    .sort((a, b) => Number(a.position) - Number(b.position))
    .map((row) => ({
      key: String(row.id),
      weekId: String(row.cycle_week_id),
      duration: Number(row.duration_weeks),
    }));
}
export function cycleWeek(anchor: string, day: string, phases: CyclePhase[]): string | null {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(anchor) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
    !phases.length ||
    phases.some((phase) => !phase.weekId || !Number.isInteger(phase.duration) || phase.duration < 1)
  )
    return null;
  const elapsed = Math.floor((Date.parse(monday(day)) - Date.parse(monday(anchor))) / 604800000);
  if (!Number.isFinite(elapsed)) return null;
  const length = phases.reduce((sum, phase) => sum + phase.duration, 0);
  let index = ((elapsed % length) + length) % length;
  for (const phase of phases) {
    if (index < phase.duration) return phase.weekId;
    index -= phase.duration;
  }
  return null;
}
export function cyclePreview(anchor: string, phases: CyclePhase[], count = 12) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(anchor) || !Number.isFinite(Date.parse(anchor))) return [];
  return Array.from({ length: count }, (_, i) => {
    const date = addDays(monday(anchor), i * 7);
    return { date, weekId: cycleWeek(anchor, date, phases) };
  });
}
