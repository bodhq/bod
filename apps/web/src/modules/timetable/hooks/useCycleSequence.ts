"use client";

import type { Row } from "@/modules/shared/records/types";

import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { useUnsavedChanges } from "@/core/hooks/useUnsavedChanges";
import { monday } from "@/core/time/school";
import { listAllRows, removeRow, request, resourcePath } from "@/modules/shared/records/api";
import { useRecordCatalog } from "@/modules/shared/records/catalog";
import { useWorkspaceRefresh } from "@/modules/shared/records/hooks";

import { type CyclePhase, cyclePhases } from "../cycle";

export function useCycleSequence({
  plan,
  weeks,
  steps,
  onDirtyChange,
}: {
  plan: Row;
  weeks: Row[];
  steps: Row[];
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const { getResource } = useRecordCatalog();
  const refresh = useWorkspaceRefresh();
  const [draft, setDraft] = useState<CyclePhase[] | null>(null);
  const [anchor, setAnchor] = useState(String(plan.cycle_anchor_monday ?? ""));
  const [editor, setEditor] = useState<{ row?: Row } | null>(null);
  const [blockWeek, setBlockWeek] = useState("");
  const [saved, setSaved] = useState(false);
  const phases = draft ?? cyclePhases(steps);
  const locked = !!plan.frozen_at;
  const positionsValid = [...steps]
    .sort((a, b) => Number(a.position) - Number(b.position))
    .every((row, index) => Number(row.position) === index + 1);
  const valid =
    (draft !== null || positionsValid) &&
    phases.length > 0 &&
    phases.every(
      (phase) =>
        weeks.some((week) => week.id === phase.weekId) &&
        Number.isInteger(phase.duration) &&
        phase.duration > 0,
    ) &&
    !!anchor &&
    monday(anchor) === anchor;
  const dirty = draft !== null || anchor !== String(plan.cycle_anchor_monday ?? "");
  useUnsavedChanges(dirty);
  useEffect(() => {
    onDirtyChange?.(dirty);
    return () => onDirtyChange?.(false);
  }, [dirty, onDirtyChange]);
  const change = (value: CyclePhase[]) => {
    setDraft(value);
    setSaved(false);
  };
  const save = useMutation({
    mutationFn: async () => {
      if (locked || !valid)
        throw new Error("Vyberte typy týdnů, kladné délky a počáteční pondělí.");
      const resource = getResource("teaching_cycle_steps");
      try {
        const current = (await listAllRows(resource)).filter(
          (row) => row.teaching_plan_id === plan.id,
        );
        for (let i = 0; i < phases.length; i++) {
          const phase = phases[i];
          if (!phase) continue;
          const row = current.find((row) => Number(row.position) === i + 1);
          const body = { cycle_week_id: phase.weekId, duration_weeks: phase.duration };
          if (row && resource.parsePatch)
            await request("PATCH", resourcePath(resource, row), {
              body: resource.parsePatch(body),
            });
          else
            await request("POST", resource.path, {
              body: resource.parseCreate({ ...body, position: i + 1, teaching_plan_id: plan.id }),
            });
        }
        for (const row of current
          .filter((row) => Number(row.position) > phases.length)
          .sort((a, b) => Number(b.position) - Number(a.position)))
          await removeRow(resource, row);
        if (anchor !== plan.cycle_anchor_monday) {
          const plans = getResource("teaching_plans");
          if (plans.parsePatch)
            await request("PATCH", resourcePath(plans, plan), {
              body: plans.parsePatch({ cycle_anchor_monday: anchor }),
            });
        }
        setDraft(null);
        setSaved(true);
      } finally {
        await refresh();
      }
    },
  });
  const code = (id: string) => String(weeks.find((row) => row.id === id)?.code ?? "?");
  const tone = (id: string) =>
    String(
      Math.max(
        0,
        weeks.findIndex((row) => row.id === id),
      ) % 3,
    );
  return {
    weeks,
    getResource,
    refresh,
    draft,
    setDraft,
    anchor,
    setAnchor,
    editor,
    setEditor,
    blockWeek,
    setBlockWeek,
    saved,
    setSaved,
    phases,
    locked,
    positionsValid,
    valid,
    dirty,
    change,
    save,
    code,
    tone,
  };
}
