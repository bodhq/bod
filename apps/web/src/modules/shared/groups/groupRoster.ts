import type { Row } from "@/modules/shared/records/types";

import { rowLabel } from "@/modules/shared/records/format";

import { type GroupContext, groupMembers } from "./membership";

export interface StudentRosterRow {
  id: string;
  name: string;
  username: string;
  active: boolean;
  classIds: string[];
  specializationIds: string[];
  groupIds: string[];
  enrollments: { classId: string; specializationId: string }[];
}
export interface StudentRosterFilters {
  search: string;
  classId: string;
  specializationId: string;
  groupId: string;
  enrollment: string;
  status: string;
  selectedOnly: boolean;
}
export function buildStudentRoster(
  accounts: Row[],
  context: GroupContext,
  classIds: string[],
): StudentRosterRow[] {
  const memberships = new Map<string, string[]>();
  for (const group of context.groups) {
    for (const member of groupMembers(group.id, context)) {
      const id = String(member.student_id);
      memberships.set(id, [...new Set([...(memberships.get(id) ?? []), String(group.id)])]);
    }
  }
  return accounts
    .filter((row) => Array.isArray(row.roles) && row.roles.includes("student"))
    .map((student) => {
      const enrollments = context.enrollments.filter(
        (row) =>
          row.student_id === student.id &&
          classIds.includes(String(row.class_id)) &&
          String(row.valid_from ?? "0000-01-01") < context.to &&
          context.from < String(row.valid_to ?? "9999-12-31"),
      );
      return {
        id: String(student.id),
        name: rowLabel(student),
        username: String(student.username ?? ""),
        active: student.is_active === true,
        classIds: [...new Set(enrollments.map((row) => String(row.class_id)))],
        specializationIds: [
          ...new Set(
            enrollments
              .filter((row) => row.specialization_id)
              .map((row) => String(row.specialization_id)),
          ),
        ],
        groupIds: memberships.get(String(student.id)) ?? [],
        enrollments: enrollments.map((row) => ({
          classId: String(row.class_id),
          specializationId: String(row.specialization_id ?? ""),
        })),
      };
    });
}
export function filterStudentRoster(
  rows: StudentRosterRow[],
  filters: StudentRosterFilters,
  selected: string[],
) {
  const search = filters.search.trim().toLocaleLowerCase("cs");
  return rows.filter(
    (row) =>
      (!search || `${row.name} ${row.username}`.toLocaleLowerCase("cs").includes(search)) &&
      ((!filters.classId && !filters.specializationId) ||
        row.enrollments.some(
          (enrollment) =>
            (!filters.classId || enrollment.classId === filters.classId) &&
            (!filters.specializationId ||
              (filters.specializationId === "none"
                ? !enrollment.specializationId
                : enrollment.specializationId === filters.specializationId)),
        ) ||
        (!row.enrollments.length && !filters.classId && filters.specializationId === "none")) &&
      (!filters.groupId ||
        (filters.groupId === "none"
          ? row.groupIds.length === 0
          : row.groupIds.includes(filters.groupId))) &&
      (filters.enrollment !== "enrolled" || row.classIds.length > 0) &&
      (filters.enrollment !== "unassigned" || row.classIds.length === 0) &&
      (filters.status === "all" || row.active === (filters.status === "active")) &&
      (!filters.selectedOnly || selected.includes(row.id)),
  );
}
export function alphabeticalGroupCounts(studentCount: number, groupCount: number) {
  return Array.from(
    { length: groupCount },
    (_, index) =>
      Math.ceil(((index + 1) * studentCount) / groupCount) -
      Math.ceil((index * studentCount) / groupCount),
  );
}
