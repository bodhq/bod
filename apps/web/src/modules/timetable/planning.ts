import type { Row } from "@/modules/shared/records/types";

import {
  type GroupContext,
  groupMembers,
  sharedStudents,
} from "@/modules/shared/groups/membership";

export interface PlanningContext extends GroupContext {
  slots: Row[];
  rooms: Row[];
}

export function slotsOverlap(a: unknown, b: unknown, slots: Row[]) {
  if (a === b) return true;
  const left = slots.find((row) => row.id === a);
  const right = slots.find((row) => row.id === b);
  return (
    !!left &&
    !!right &&
    String(left.start_time) < String(right.end_time) &&
    String(right.start_time) < String(left.end_time)
  );
}

export function placementIssues(
  entry: Row,
  entries: Row[],
  assignments: Row[],
  context: PlanningContext,
) {
  const assignment = assignments.find((row) => row.id === entry.teaching_assignment_id);
  if (!assignment) return ["Chybí přiřazení výuky"];
  const issues: string[] = [];
  for (const other of entries) {
    if (
      other.id === entry.id ||
      other.cycle_week_id !== entry.cycle_week_id ||
      Number(other.day_of_week) !== Number(entry.day_of_week) ||
      !slotsOverlap(other.time_slot_id, entry.time_slot_id, context.slots)
    )
      continue;
    const paired = assignments.find((row) => row.id === other.teaching_assignment_id);
    if (paired?.teacher_id && paired.teacher_id === assignment.teacher_id)
      issues.push("Vyučující má současně jinou hodinu");
    if (paired?.group_id === assignment.group_id) issues.push("Skupina má současně jinou hodinu");
    else if (context.membershipAvailable && paired) {
      const shared = sharedStudents(assignment.group_id, paired.group_id, context);
      if (shared.length) issues.push(`Překryv skupin: ${shared.length} společných žáků`);
    }
    if (entry.room_id && other.room_id === entry.room_id)
      issues.push("Učebna je současně obsazená");
  }
  const room = context.rooms.find((row) => row.id === entry.room_id);
  if (room) {
    if (
      assignment.required_room_type_code &&
      room.room_type_code !== assignment.required_room_type_code
    )
      issues.push("Učebna nemá požadovaný typ");
    if (room.is_active === false) issues.push("Učebna je neaktivní");
    // Count peak simultaneous membership rather than everyone enrolled during the year.
    const start = (row: Row) => String(row.valid_from ?? "0000-01-01");
    const end = (row: Row) => String(row.valid_to ?? "9999-12-31");
    const members = groupMembers(assignment.group_id, context);
    const dates = [
      context.from,
      ...members.map(start).filter((day) => context.from <= day && day < context.to),
    ];
    const size = Math.max(
      0,
      ...dates.map(
        (day) =>
          new Set(
            members
              .filter((row) => start(row) <= day && day < end(row))
              .map((row) => row.student_id),
          ).size,
      ),
    );
    if (context.membershipAvailable && size > Number(room.capacity))
      issues.push(`Kapacita učebny ${room.capacity} nestačí pro ${size} žáků`);
  }
  return [...new Set(issues)];
}

export function placementAdvice(
  entry: Row,
  entries: Row[],
  assignments: Row[],
  context: PlanningContext,
  preferredTime: string,
) {
  const advice: string[] = [];
  const assignment = assignments.find((row) => row.id === entry.teaching_assignment_id);
  const slot = context.slots.find((row) => row.id === entry.time_slot_id);
  if (preferredTime === "morning" && Number(slot?.position) > 3)
    advice.push("Pro tuto výuku preferujete první tři hodiny");
  if (preferredTime === "afternoon" && Number(slot?.position) <= 4)
    advice.push("Pro tuto výuku preferujete odpolední blok");
  if (
    entries.some(
      (row) =>
        row.id !== entry.id &&
        row.cycle_week_id === entry.cycle_week_id &&
        row.day_of_week === entry.day_of_week &&
        assignments.find((item) => item.id === row.teaching_assignment_id)?.subject_id ===
          assignment?.subject_id &&
        assignments.find((item) => item.id === row.teaching_assignment_id)?.group_id ===
          assignment?.group_id,
    )
  )
    advice.push("Stejný předmět už je tento den zařazený");
  return advice;
}
