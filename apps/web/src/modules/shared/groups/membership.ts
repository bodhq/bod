import type { Row } from "@/modules/shared/records/types";

export interface GroupContext {
  groups: Row[];
  memberships: Row[];
  enrollments: Row[];
  from: string;
  to: string;
  membershipAvailable: boolean;
}

const start = (row: Row) => String(row.valid_from ?? "0000-01-01");
const end = (row: Row) => String(row.valid_to ?? "9999-12-31");

const memberCache = new WeakMap<GroupContext, Map<unknown, Row[]>>();
const overlapCache = new WeakMap<GroupContext, Map<string, string[]>>();

export function groupMembers(groupId: unknown, context: GroupContext) {
  let cache = memberCache.get(context);
  if (!cache) {
    cache = new Map();
    memberCache.set(context, cache);
  }
  const cached = cache.get(groupId);
  if (cached) return cached;
  const group = context.groups.find((row) => row.id === groupId);
  if (!group) return [];
  const members = (
    group.membership_mode === "class_enrollment"
      ? context.enrollments.filter((row) => row.class_id === group.source_class_id)
      : context.memberships.filter((row) => row.group_id === groupId)
  ).filter((row) => start(row) < context.to && context.from < end(row));
  cache.set(groupId, members);
  return members;
}

// Membership intervals must overlap each other, not just the school year.
export function sharedStudents(a: unknown, b: unknown, context: GroupContext) {
  let cache = overlapCache.get(context);
  if (!cache) {
    cache = new Map();
    overlapCache.set(context, cache);
  }
  const key = [String(a), String(b)].sort().join(":");
  const cached = cache.get(key);
  if (cached) return cached;
  const right = groupMembers(b, context);
  const shared = [
    ...new Set(
      groupMembers(a, context)
        .filter((left) =>
          right.some(
            (row) =>
              row.student_id === left.student_id &&
              ([start(left), start(row), context.from].sort().at(-1) ?? "") <
                ([end(left), end(row), context.to].sort()[0] ?? ""),
          ),
        )
        .map((row) => String(row.student_id)),
    ),
  ];
  cache.set(key, shared);
  return shared;
}
