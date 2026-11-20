import { expect, it } from "vitest";

import { groupMembers, sharedStudents } from "@/modules/shared/groups/membership";
import { assignmentProgress, entryConflicts } from "@/modules/timetable/editor";

const assignments = [
  { id: "math", teacher_id: "teacher", group_id: "1A" },
  { id: "physics", teacher_id: "teacher", group_id: "1B" },
];
const entry = {
  id: "one",
  teaching_assignment_id: "math",
  cycle_week_id: "A",
  day_of_week: 1,
  time_slot_id: "first",
  room_id: "lab",
};
it("reports simultaneous shared teachers and rooms across groups", () => {
  expect(
    entryConflicts(
      entry,
      [entry, { ...entry, id: "two", teaching_assignment_id: "physics" }],
      assignments,
    ),
  ).toEqual(["Vyučující má současně jinou hodinu", "Učebna je současně obsazená"]);
});
it("does not mix cycle weeks or report an entry conflicting with itself", () => {
  expect(
    entryConflicts(entry, [entry, { ...entry, id: "two", cycle_week_id: "B" }], assignments),
  ).toEqual([]);
});
it("uses authoritative workload counts for the selected assignment and week", () => {
  expect(
    assignmentProgress("math", "A", [
      {
        teaching_assignment_id: "math",
        cycle_week_id: "A",
        required_periods: 2,
        scheduled_periods: 3,
        remaining_periods: -1,
      },
      {
        teaching_assignment_id: "math",
        cycle_week_id: "B",
        required_periods: 0,
        scheduled_periods: 0,
        remaining_periods: 0,
      },
    ]),
  ).toEqual({ placed: 3, required: 2, remaining: -1 });
  expect(assignmentProgress("math", "B", [])).toEqual({
    placed: 0,
    required: null,
    remaining: null,
  });
});

import { type PlanningContext, placementIssues } from "@/modules/timetable/planning";

const context: PlanningContext = {
  from: "2026-09-01",
  to: "2027-07-01",
  membershipAvailable: true,
  groups: [
    { id: "1A", membership_mode: "class_enrollment", source_class_id: "classA" },
    { id: "1B", membership_mode: "explicit" },
  ],
  enrollments: [
    { student_id: "student", class_id: "classA", valid_from: "2026-09-01", valid_to: "2027-07-01" },
  ],
  memberships: [
    { student_id: "student", group_id: "1B", valid_from: "2026-09-01", valid_to: "2027-07-01" },
  ],
  slots: [
    { id: "first", start_time: "08:00:00", end_time: "08:45:00" },
    { id: "overlap", start_time: "08:30:00", end_time: "09:15:00" },
    { id: "next", start_time: "08:45:00", end_time: "09:30:00" },
  ],
  rooms: [{ id: "lab", room_type_code: "lab", capacity: 1, is_active: true }],
};
it("detects shared students across explicit and whole-class groups", () => {
  expect(sharedStudents("1A", "1B", context)).toEqual(["student"]);
  expect(
    placementIssues(
      entry,
      [
        entry,
        {
          ...entry,
          id: "two",
          teaching_assignment_id: "physics",
          time_slot_id: "overlap",
          room_id: null,
        },
      ],
      [assignments[0] ?? {}, { ...assignments[1], teacher_id: "other" }],
      context,
    ),
  ).toEqual(["Překryv skupin: 1 společných žáků"]);
});
it("does not treat successive memberships as simultaneous", () => {
  expect(
    sharedStudents("1A", "1B", {
      ...context,
      enrollments: [{ ...context.enrollments[0], valid_to: "2027-01-01" }],
      memberships: [{ ...context.memberships[0], valid_from: "2027-01-01" }],
    }),
  ).toEqual([]);
});
it("honors the planning interval and excluded end date", () => {
  expect(groupMembers("1B", { ...context, from: "2027-07-01", to: "2027-08-01" })).toEqual([]);
});
it("allows touching time slots but detects actual time overlap", () => {
  const other = { ...entry, id: "two", teaching_assignment_id: "physics", time_slot_id: "next" };
  expect(placementIssues(entry, [entry, other], assignments, context)).toEqual([]);
  expect(
    placementIssues(entry, [entry, { ...other, time_slot_id: "overlap" }], assignments, context),
  ).toContain("Vyučující má současně jinou hodinu");
});
it("validates room type and peak capacity with membership turnover", () => {
  const rows = [{ ...assignments[0], required_room_type_code: "gym" }];
  expect(placementIssues(entry, [entry], rows, context)).toEqual(["Učebna nemá požadovaný typ"]);
  const enrollments = [
    { student_id: "one", class_id: "classA", valid_from: "2026-09-01", valid_to: "2027-01-01" },
    { student_id: "two", class_id: "classA", valid_from: "2027-01-01", valid_to: "2027-07-01" },
  ];
  expect(placementIssues(entry, [entry], assignments, { ...context, enrollments })).toEqual([]);
  expect(
    placementIssues(entry, [entry], assignments, {
      ...context,
      enrollments: [
        ...enrollments,
        {
          student_id: "three",
          class_id: "classA",
          valid_from: "2026-09-01",
          valid_to: "2027-07-01",
        },
      ],
    }),
  ).toContain("Kapacita učebny 1 nestačí pro 2 žáků");
});
it("does not claim student collisions without membership access", () => {
  expect(
    placementIssues(
      entry,
      [entry, { ...entry, id: "two", teaching_assignment_id: "physics", room_id: null }],
      [assignments[0] ?? {}, { ...assignments[1], teacher_id: "other" }],
      { ...context, membershipAvailable: false },
    ),
  ).toEqual([]);
});
