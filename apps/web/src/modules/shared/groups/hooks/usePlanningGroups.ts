"use client";

import type { Row } from "@/modules/shared/records/types";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { getAccountDirectory } from "@/core/accounts/api";
import { request, workspaceKey } from "@/modules/shared/records/api";
import { useRecordCatalog } from "@/modules/shared/records/catalog";
import { usePermissions, useWorkspaceRefresh } from "@/modules/shared/records/hooks";
import { useRecordData } from "@/modules/shared/records/hooks/useRecordData";
import { useRecordScope } from "@/modules/shared/records/scope";

import { type GroupContext, groupMembers } from "../membership";

export function usePlanningGroups() {
  const data = useRecordData([
    "teaching_groups",
    "teaching_group_memberships",
    "class_enrollments",
    "classes",
    "specializations",
    "study_fields",
  ]);
  const scope = useRecordScope();
  const can = usePermissions();
  const { getResource } = useRecordCatalog();
  const refresh = useWorkspaceRefresh();
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [creationMethod, setCreationMethod] = useState("choose");
  const [review, setReview] = useState(false);
  const [name, setName] = useState("");
  const [chosen, setChosen] = useState<string[]>([]);
  const [created, setCreated] = useState<Row | null>(null);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sourceGroup, setSourceGroup] = useState("");
  const accounts = useQuery({
    queryKey: [...workspaceKey, "planning-students"],
    queryFn: ({ signal }) => getAccountDirectory(signal),
    enabled: can("users.manage"),
  });
  const groups = data
    .rows("teaching_groups")
    .filter((row) => !scope || row.school_year_id === scope.defaults.school_year_id);
  const classes = data
    .rows("classes")
    .filter((row) => !scope || row.school_year_id === scope.defaults.school_year_id);
  const selected = groups.find((row) => row.id === selectedId) ?? groups[0];
  const context: GroupContext = {
    groups: data.rows("teaching_groups"),
    memberships: data.rows("teaching_group_memberships"),
    enrollments: data.rows("class_enrollments"),
    from: scope?.interval.start ?? "0000-01-01",
    to: scope?.interval.end ?? "9999-12-31",
    membershipAvailable: [
      "teaching_groups",
      "teaching_group_memberships",
      "class_enrollments",
    ].every(data.available),
  };
  const students = (accounts.data ?? []).filter(
    (row) => row.is_active && row.roles?.includes("student"),
  );
  const memberIds = selected
    ? [...new Set(groupMembers(selected.id, context).map((row) => String(row.student_id)))]
    : [];
  const save = useMutation({
    mutationFn: async () => {
      if (
        !scope ||
        !name.trim() ||
        !chosen.length ||
        from < scope.interval.start ||
        to > scope.interval.end ||
        from >= to
      )
        throw new Error("Vyplňte název, vyberte žáky a platné období ve školním roce.");
      let group = created;
      if (!group) {
        const resource = getResource("teaching_groups");
        group = await request<Row>("POST", resource.path, {
          body: resource.parseCreate({
            name: name.trim(),
            membership_mode: "explicit",
            school_year_id: scope.defaults.school_year_id,
          }),
        });
        setCreated(group);
      }
      try {
        for (const id of chosen.filter((id) => !savedIds.includes(id))) {
          const resource = getResource("teaching_group_memberships");
          await request("POST", resource.path, {
            body: resource.parseCreate({
              group_id: group.id,
              student_id: id,
              valid_from: from,
              valid_to: to,
            }),
          });
          setSavedIds((previous) => [...previous, id]);
        }
        setSelectedId(String(group.id));
        setAdding(false);
      } finally {
        await refresh();
      }
    },
  });
  const open = () => {
    setAdding(true);
    setCreationMethod("choose");
    setReview(false);
    setCreated(null);
    setSavedIds([]);
    setChosen([]);
    setName("");
    setSourceGroup("");
    setFrom(scope?.interval.start ?? "");
    setTo(scope?.interval.end ?? "");
    save.reset();
  };
  return {
    data,
    scope,
    can,
    setSelectedId,
    search,
    setSearch,
    adding,
    setAdding,
    creationMethod,
    setCreationMethod,
    review,
    setReview,
    name,
    setName,
    chosen,
    setChosen,
    created,
    savedIds,
    from,
    setFrom,
    to,
    setTo,
    sourceGroup,
    setSourceGroup,
    accounts,
    groups,
    classes,
    selected,
    context,
    students,
    memberIds,
    save,
    open,
  };
}
