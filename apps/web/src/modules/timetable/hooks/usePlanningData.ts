"use client";

import type { Row } from "@/modules/shared/records/types";

import { useQuery } from "@tanstack/react-query";

import { getAccountDirectory } from "@/core/accounts/api";
import { workspaceKey } from "@/modules/shared/records/api";
import { usePermissions } from "@/modules/shared/records/hooks";
import { useRecordData } from "@/modules/shared/records/hooks/useRecordData";

const ids = [
  "teaching_groups",
  "teaching_group_memberships",
  "class_enrollments",
  "classes",
  "subjects",
  "rooms",
  "room_types",
  "specializations",
];

export function usePlanningData({
  collections = ids,
  includeDirectory = true,
}: {
  collections?: string[];
  includeDirectory?: boolean;
} = {}) {
  const can = usePermissions();
  const data = useRecordData(collections);
  const directory = useQuery({
    queryKey: [...workspaceKey, "planning-students"],
    queryFn: ({ signal }) => getAccountDirectory(signal),
    enabled: includeDirectory && can("users.manage"),
  });
  return {
    ...data,
    rows: (id: string): Row[] => (id === "users" ? (directory.data ?? []) : data.rows(id)),
    canSchool: can("school.manage"),
    canRooms: can("rooms.manage"),
    membershipAvailable: [
      "teaching_groups",
      "teaching_group_memberships",
      "class_enrollments",
    ].every(data.available),
  };
}
