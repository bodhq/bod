"use client";

import type { Row } from "@/modules/shared/records/types";
import type { GroupContext } from "../membership";

import { useMutation, useQueries } from "@tanstack/react-query";
import { useState } from "react";

import { listAllRows, request, workspaceKey } from "@/modules/shared/records/api";
import { useRecordCatalog } from "@/modules/shared/records/catalog";
import { rowLabel } from "@/modules/shared/records/format";
import { useWorkspaceRefresh } from "@/modules/shared/records/hooks";
import { useRecordScope } from "@/modules/shared/records/scope";

import { alphabeticalGroupCounts } from "../groupRoster";

export function useAutomaticGroupBuilder({
  open,
  classes,
  context,
  onCreated,
}: {
  open: boolean;
  classes: Row[];
  context: GroupContext;
  onCreated: (id: string) => void;
}) {
  const { getResource, getWorkflow } = useRecordCatalog();
  const refresh = useWorkspaceRefresh();
  const scope = useRecordScope();
  const [source, setSource] = useState("");
  const [classId, setClassId] = useState("");
  const [method, setMethod] = useState("alphabetical");
  const [divisionName, setDivisionName] = useState("");
  const [count, setCount] = useState(2);
  const [names, setNames] = useState<Record<number, string>>({});
  const [mapping, setMapping] = useState<Record<string, number>>({});
  const [day, setDay] = useState(scope?.interval.start ?? "");
  const [review, setReview] = useState(false);
  const [confirmRecompute, setConfirmRecompute] = useState(false);
  const [prepared, setPrepared] = useState<Row | null>(null);
  const [createdGroups, setCreatedGroups] = useState<Row[]>([]);
  const [savedRules, setSavedRules] = useState<string[]>([]);
  const queries = useQueries({
    queries: ["group_divisions", "group_specialization_rules", "group_study_field_rules"].map(
      (id) => ({
        queryKey: [...workspaceKey, "group-builder", id],
        queryFn: ({ signal }: { signal: AbortSignal }) => listAllRows(getResource(id), signal),
        enabled: open,
      }),
    ),
  });
  const divisions = queries[0]?.data ?? [];
  const existing = divisions.find((row) => row.id === source);
  const classroom = classes.find((row) => row.id === (existing?.class_id ?? classId));
  const selectedMethod = String(existing?.method ?? method);
  const ruleField = selectedMethod === "study_field" ? "study_field_id" : "specialization_id";
  const rules = queries[selectedMethod === "study_field" ? 2 : 1]?.data ?? [];
  const effectiveGroups = existing
    ? context.groups
        .filter((row) => row.division_id === existing.id)
        .sort((a, b) => Number(a.position) - Number(b.position))
    : createdGroups;
  const groupCount = existing ? effectiveGroups.length : count;
  const title = existing
    ? rowLabel(existing)
    : divisionName.trim() || `${classroom ? rowLabel(classroom) : "Třída"} · dělení`;
  const groupKey = (position: number) =>
    String(effectiveGroups[position]?.id ?? `target-position-${position + 1}`);
  const groupName = (index: number) =>
    existing
      ? rowLabel(effectiveGroups[index] ?? {})
      : names[index]?.trim() ||
        `${classroom ? rowLabel(classroom) : "Třída"} · skupina ${index + 1}`;
  const enrollments = context.enrollments.filter(
    (row) =>
      row.class_id === classroom?.id &&
      String(row.valid_from) <= day &&
      day < String(row.valid_to ?? "9999-12-31"),
  );
  const specializationIds = [...new Set(enrollments.map((row) => String(row[ruleField] ?? "")))];
  const groupIndex = (specializationId: string) =>
    existing
      ? effectiveGroups.findIndex((group) =>
          rules.some((rule) => rule.group_id === group.id && rule[ruleField] === specializationId),
        )
      : (mapping[specializationId] ??
        Math.max(0, specializationIds.indexOf(specializationId)) % Math.max(1, groupCount));
  const counts =
    selectedMethod === "alphabetical"
      ? alphabeticalGroupCounts(enrollments.length, groupCount)
      : Array.from(
          { length: groupCount },
          (_, index) =>
            enrollments.filter((row) => groupIndex(String(row[ruleField] ?? "")) === index).length,
        );
  const groupIds = effectiveGroups.map((row) => row.id);
  const affected = context.memberships.filter(
    (row) => groupIds.includes(row.group_id) && (!row.valid_to || String(row.valid_to) > day),
  );
  const uncovered =
    ["specialization", "study_field"].includes(selectedMethod) &&
    specializationIds.some((id) => !id || groupIndex(id) < 0 || groupIndex(id) >= groupCount);
  const earliest = String(existing?.effective_from ?? scope?.interval.start ?? "");
  const valid =
    !!scope &&
    !!classroom &&
    day >= earliest &&
    day < scope.interval.end &&
    enrollments.length > 0 &&
    groupCount >= 2 &&
    groupCount <= 10 &&
    groupCount <= enrollments.length &&
    !uncovered &&
    (!affected.length || confirmRecompute) &&
    new Set(Array.from({ length: groupCount }, (_, index) => groupName(index))).size === groupCount;
  const generate = useMutation({
    mutationFn: async () => {
      if (!valid || !scope || !classroom)
        throw new Error("Zkontrolujte třídu, datum, cílové skupiny a pravidla dělení.");
      let division = existing ?? prepared;
      if (!division) {
        const resource = getResource("group_divisions");
        division = await request<Row>("POST", resource.path, {
          body: resource.parseCreate({
            class_id: classroom.id,
            name: title,
            method: selectedMethod,
            effective_from: day,
          }),
        });
        setPrepared(division);
      }
      const targets = [...effectiveGroups];
      try {
        if (!existing) {
          for (let index = targets.length; index < groupCount; index++) {
            const resource = getResource("teaching_groups");
            const group = await request<Row>("POST", resource.path, {
              body: resource.parseCreate({
                school_year_id: scope.defaults.school_year_id,
                name: groupName(index),
                membership_mode: "explicit",
                division_id: division.id,
                position: index + 1,
              }),
            });
            targets.push(group);
            setCreatedGroups([...targets]);
          }
          if (["specialization", "study_field"].includes(selectedMethod))
            for (const id of specializationIds.filter((id) => id && !savedRules.includes(id))) {
              const resource = getResource(
                selectedMethod === "study_field"
                  ? "group_study_field_rules"
                  : "group_specialization_rules",
              );
              const target = targets[groupIndex(id)];
              if (!target) throw new Error("Zaměření nemá cílovou skupinu.");
              await request("POST", resource.path, {
                body: resource.parseCreate({ group_id: target.id, [ruleField]: id }),
              });
              setSavedRules((previous) => [...previous, id]);
            }
        }
        const workflow = getWorkflow("divide");
        await request(
          "POST",
          workflow.path.replace("{division_id}", encodeURIComponent(String(division.id))),
          { body: workflow.parse({ effective_from: day, confirm_recompute: confirmRecompute }) },
        );
        await refresh();
        const firstId = String(targets[0]?.id ?? "");
        reset();
        onCreated(firstId);
      } finally {
        await refresh();
      }
    },
  });
  const reset = () => {
    setSource("");
    setClassId("");
    setMethod("alphabetical");
    setDivisionName("");
    setCount(2);
    setNames({});
    setMapping({});
    setDay(scope?.interval.start ?? "");
    setReview(false);
    setConfirmRecompute(false);
    setPrepared(null);
    setCreatedGroups([]);
    setSavedRules([]);
    generate.reset();
  };
  const locked = !!prepared || generate.isPending;
  return {
    scope,
    source,
    setSource,
    setClassId,
    method,
    setMethod,
    divisionName,
    setDivisionName,
    count,
    setCount,
    setNames,
    setMapping,
    day,
    setDay,
    review,
    setReview,
    confirmRecompute,
    setConfirmRecompute,
    prepared,
    createdGroups,
    queries,
    divisions,
    existing,
    classroom,
    selectedMethod,
    groupCount,
    title,
    groupKey,
    groupName,
    enrollments,
    specializationIds,
    groupIndex,
    counts,
    affected,
    uncovered,
    earliest,
    valid,
    generate,
    reset,
    locked,
  };
}
