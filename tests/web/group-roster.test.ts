import type { GroupContext } from "@/modules/shared/groups/membership";

import { expect, it } from "vitest";

import {
  alphabeticalGroupCounts,
  buildStudentRoster,
  filterStudentRoster,
  type StudentRosterFilters,
} from "@/modules/shared/groups/groupRoster";

const context: GroupContext = {
  from: "2026-09-01",
  to: "2027-07-01",
  membershipAvailable: true,
  groups: [{ id: "group", membership_mode: "explicit" }],
  memberships: [
    { group_id: "group", student_id: "one", valid_from: "2026-09-01", valid_to: "2027-07-01" },
  ],
  enrollments: [
    {
      student_id: "one",
      class_id: "A",
      specialization_id: "design",
      valid_from: "2026-09-01",
      valid_to: "2027-01-01",
    },
    {
      student_id: "one",
      class_id: "B",
      specialization_id: "networks",
      valid_from: "2027-01-01",
      valid_to: null,
    },
    { student_id: "two", class_id: "B", valid_from: "2026-09-01", valid_to: null },
  ],
};
const accounts = [
  { id: "one", display_name: "Anna Nová", username: "anova", roles: ["student"], is_active: true },
  { id: "two", display_name: "Petr Malý", username: "pmaly", roles: ["student"], is_active: true },
  {
    id: "three",
    display_name: "Starý účet",
    username: "old",
    roles: ["student"],
    is_active: false,
  },
  { id: "teacher", roles: ["teacher"], is_active: true },
];
const filters: StudentRosterFilters = {
  search: "",
  classId: "",
  specializationId: "",
  groupId: "",
  enrollment: "all",
  status: "all",
  selectedOnly: false,
};
const roster = buildStudentRoster(accounts, context, ["A", "B"]);
it("builds the roster from real enrollment and membership records, without inferring a study field", () => {
  expect(roster).toHaveLength(3);
  expect(roster[0]).toMatchObject({
    classIds: ["A", "B"],
    specializationIds: ["design", "networks"],
    groupIds: ["group"],
  });
  expect(roster[0]).not.toHaveProperty("studyField");
});
it("combines class and specialization filters on the same enrollment", () => {
  expect(
    filterStudentRoster(roster, { ...filters, classId: "A", specializationId: "networks" }, []),
  ).toHaveLength(0);
  expect(
    filterStudentRoster(roster, { ...filters, classId: "B", specializationId: "networks" }, []).map(
      (row) => row.id,
    ),
  ).toEqual(["one"]);
});
it("filters account state, membership, missing specialization and selection independently", () => {
  expect(
    filterStudentRoster(
      roster,
      { ...filters, status: "active", groupId: "none", specializationId: "none" },
      [],
    ).map((row) => row.id),
  ).toEqual(["two"]);
  expect(
    filterStudentRoster(roster, { ...filters, selectedOnly: true }, ["one"]).map((row) => row.id),
  ).toEqual(["one"]);
  expect(
    filterStudentRoster(
      roster,
      { ...filters, enrollment: "unassigned", status: "inactive" },
      [],
    ).map((row) => row.id),
  ).toEqual(["three"]);
});
it("respects period boundaries when finding a student's class", () => {
  const current = buildStudentRoster(
    accounts,
    { ...context, from: "2027-01-01", to: "2027-07-01" },
    ["A", "B"],
  );
  expect(current[0]?.classIds).toEqual(["B"]);
});
it("previews the existing server's alphabetical partition counts, including uneven divisions", () => {
  expect(alphabeticalGroupCounts(5, 2)).toEqual([3, 2]);
  expect(alphabeticalGroupCounts(8, 3)).toEqual([3, 3, 2]);
  expect(alphabeticalGroupCounts(0, 2)).toEqual([0, 0]);
});
