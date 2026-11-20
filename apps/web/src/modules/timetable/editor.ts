import type { WorkloadOverview } from "@bod/api-client/types.gen";
import type { Row } from "@/modules/shared/records/types";

export const weekdays = ["Pondělí", "Úterý", "Středa", "Čtvrtek", "Pátek", "Sobota", "Neděle"];

export function entryConflicts(entry: Row, entries: Row[], assignments: Row[]) {
  const assignment = assignments.find((row) => row.id === entry.teaching_assignment_id);
  if (!assignment) return [];
  return entries
    .filter(
      (other) =>
        other.id !== entry.id &&
        other.cycle_week_id === entry.cycle_week_id &&
        other.day_of_week === entry.day_of_week &&
        other.time_slot_id === entry.time_slot_id,
    )
    .flatMap((other) => {
      const paired = assignments.find((row) => row.id === other.teaching_assignment_id);
      const conflicts: string[] = [];
      if (paired?.teacher_id && paired.teacher_id === assignment.teacher_id)
        conflicts.push("Vyučující má současně jinou hodinu");
      if (paired?.group_id && paired.group_id === assignment.group_id)
        conflicts.push("Skupina má současně jinou hodinu");
      if (entry.room_id && entry.room_id === other.room_id)
        conflicts.push("Učebna je současně obsazená");
      return conflicts;
    })
    .filter((value, index, all) => all.indexOf(value) === index);
}

export function assignmentProgress(
  assignmentId: unknown,
  weekId: unknown,
  workloads: WorkloadOverview[],
) {
  const workload = workloads.find(
    (row) => row.teaching_assignment_id === assignmentId && row.cycle_week_id === weekId,
  );
  return {
    placed: workload?.scheduled_periods ?? 0,
    required: workload?.required_periods ?? null,
    remaining: workload?.remaining_periods ?? null,
  };
}
