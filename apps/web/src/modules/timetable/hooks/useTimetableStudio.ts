"use client";

import type { Row } from "@/modules/shared/records/types";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useConfirm } from "@/core/ui/overlays/ConfirmProvider";
import { workspaceKey } from "@/modules/shared/records/api";
import { useRecordCatalog } from "@/modules/shared/records/catalog";
import { rowLabel, shortId } from "@/modules/shared/records/format";
import { usePermissions, useWorkspaceRefresh } from "@/modules/shared/records/hooks";
import { useRecordScope } from "@/modules/shared/records/scope";

import { checkPublication } from "../api";
import { assignmentProgress, weekdays } from "../editor";
import { type PlanningContext, placementIssues } from "../planning";
import { usePlanningData } from "./usePlanningData";
import { useTimetableEditor } from "./useTimetableEditor";

export function useTimetableStudio({
  planId,
  version: requestedVersion,
}: {
  planId: string;
  version: Row;
}) {
  const data = useTimetableEditor(String(requestedVersion.id ?? ""));
  const version = data.overview?.version ?? requestedVersion;
  const planning = usePlanningData({
    collections: [
      "teaching_groups",
      "teaching_group_memberships",
      "class_enrollments",
      "rooms",
      "room_types",
    ],
    includeDirectory: false,
  });
  const scope = useRecordScope();
  const { getResource, workflows } = useRecordCatalog();
  const resource = getResource("timetable_entries");
  const can = usePermissions();
  const refresh = useWorkspaceRefresh();
  const confirm = useConfirm();
  const [editingVersion, setEditingVersion] = useState(false);
  const [weekend, setWeekend] = useState(false);
  const [weekId, setWeekId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [assignmentId, setAssignmentId] = useState("");
  const [search, setSearch] = useState("");
  const [remainingOnly, setRemainingOnly] = useState(false);
  const [roomId, setRoomId] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [inspectedId, setInspectedId] = useState("");
  const [editor, setEditor] = useState<{ initial: Row; existing?: Row } | null>(null);
  const [moving, setMoving] = useState<Row | null>(null);
  const [workflowId, setWorkflowId] = useState("");
  const [showChecks, setShowChecks] = useState(false);
  const writable = !!data.overview?.editable && can("timetable.edit");
  const publication = useQuery({
    queryKey: [...workspaceKey, "publication-check", version.id],
    queryFn: ({ signal }) => checkPublication(String(version.id), signal),
    enabled: writable,
  });
  const weeks = data.weeks
    .filter((row) => row.teaching_plan_id === planId)
    .sort((a, b) => Number(a.position) - Number(b.position));
  const week = weeks.find((row) => row.id === weekId) ?? weeks[0];
  const assignments = data.assignments.filter((row) => row.teaching_plan_id === planId);
  const entries = data.entries.filter((row) => row.timetable_version_id === version.id);
  const slots = data.slots
    .filter((row) => row.time_grid_id === version.time_grid_id)
    .sort((a, b) => Number(a.position) - Number(b.position));
  const context: PlanningContext = {
    slots,
    groups: planning.rows("teaching_groups"),
    memberships: planning.rows("teaching_group_memberships"),
    enrollments: planning.rows("class_enrollments"),
    rooms: planning.rows("rooms"),
    from: String(version.valid_from ?? scope?.interval.start ?? "0000-01-01"),
    to: String(version.valid_to ?? scope?.interval.end ?? "9999-12-31"),
    membershipAvailable: planning.membershipAvailable,
  };
  const name = (id: unknown, collection: string, fallback: string) => {
    const label = data.names[collection]?.[String(id)];
    if (label) return label;
    const row = planning.rows(collection).find((item) => (item.id ?? item.code) === id);
    return row ? rowLabel(row) : `${fallback} ${shortId(id)}`;
  };
  const subject = (row: Row) => name(row.subject_id, "subjects", "Předmět");
  const group = (row: Row) => name(row.group_id, "teaching_groups", "Skupina");
  const label = (row: Row) => `${subject(row)} · ${group(row)}`;
  const groups = [...new Set(assignments.map((row) => String(row.group_id)))];
  const teachers = [...new Set(assignments.map((row) => String(row.teacher_id)))];
  const visibleAssignments = assignments.filter(
    (row) => (!groupId || row.group_id === groupId) && (!teacherId || row.teacher_id === teacherId),
  );
  const visibleEntries = entries.filter(
    (row) =>
      row.cycle_week_id === week?.id &&
      visibleAssignments.some((assignment) => assignment.id === row.teaching_assignment_id),
  );
  const days = weekdays.slice(
    0,
    weekend || visibleEntries.some((row) => Number(row.day_of_week) > 5) ? 7 : 5,
  );
  const selected = assignments.find(
    (row) => row.id === (moving?.teaching_assignment_id ?? assignmentId),
  );
  const inspected = entries.find((row) => row.id === inspectedId);
  const inspectedAssignment = assignments.find(
    (row) => row.id === inspected?.teaching_assignment_id,
  );
  const checked = entries
    .filter((row) => row.cycle_week_id === week?.id)
    .map((row) => ({ row, issues: placementIssues(row, entries, assignments, context) }));
  const conflicts = checked.filter((item) => item.issues.length);
  const progress = assignments.map((row) => assignmentProgress(row.id, week?.id, data.workloads));
  const remaining = progress.reduce((sum, row) => sum + Math.max(0, row.remaining ?? 0), 0);
  const excess = progress.reduce((sum, row) => sum + Math.max(0, -(row.remaining ?? 0)), 0);
  const unset = progress.filter((row) => row.required === null).length;
  const backlog = visibleAssignments
    .filter((row) => label(row).toLocaleLowerCase("cs").includes(search.toLocaleLowerCase("cs")))
    .filter((row) => {
      const item = assignmentProgress(row.id, week?.id, data.workloads);
      return !remainingOnly || item.required === null || item.placed < item.required;
    })
    .sort((a, b) => {
      const left = assignmentProgress(a.id, week?.id, data.workloads),
        right = assignmentProgress(b.id, week?.id, data.workloads);
      return (
        Number(left.required !== null && left.placed >= left.required) -
        Number(right.required !== null && right.placed >= right.required)
      );
    });
  const candidate = (day: number, slot: string): Row => ({
    ...(moving ?? {}),
    id: moving?.id ?? "__preview__",
    timetable_version_id: version.id,
    cycle_week_id: week?.id,
    teaching_assignment_id: selected?.id,
    day_of_week: day,
    time_slot_id: slot,
    room_id: moving?.room_id ?? (roomId || null),
    is_locked: moving?.is_locked ?? false,
  });
  const place = (day: number, slot: string) => {
    if (!writable || !week) return;
    const initial = candidate(day, slot);
    setEditor({
      initial: { ...initial, teaching_assignment_id: selected?.id ?? "" },
      existing: moving ?? undefined,
    });
  };
  const publicationReady = publication.data?.can_publish === true && !publication.isFetching;
  const publish = async () => {
    setShowChecks(true);
    const result = await publication.refetch();
    if (result.data?.can_publish && !result.isError) setWorkflowId("publish");
  };
  return {
    data,
    version,
    planning,
    scope,
    getResource,
    workflows,
    resource,
    can,
    refresh,
    confirm,
    editingVersion,
    setEditingVersion,
    weekend,
    setWeekend,
    setWeekId,
    groupId,
    setGroupId,
    teacherId,
    setTeacherId,
    setAssignmentId,
    search,
    setSearch,
    remainingOnly,
    setRemainingOnly,
    roomId,
    setRoomId,
    preferredTime,
    setPreferredTime,
    inspectedId,
    setInspectedId,
    editor,
    setEditor,
    moving,
    setMoving,
    workflowId,
    setWorkflowId,
    showChecks,
    setShowChecks,
    writable,
    weeks,
    week,
    assignments,
    entries,
    slots,
    context,
    name,
    subject,
    group,
    label,
    groups,
    teachers,
    visibleEntries,
    days,
    selected,
    inspected,
    inspectedAssignment,
    checked,
    conflicts,
    remaining,
    excess,
    unset,
    publicationReady,
    publication,
    backlog,
    candidate,
    place,
    publish,
  };
}
