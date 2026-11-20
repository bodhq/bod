"use client";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { useQueryValue } from "@/core/hooks/useQueryValue";
import { useConfirm } from "@/core/ui/overlays/ConfirmProvider";
import { listAllRows, workspaceKey } from "@/modules/shared/records/api";
import { useRecordCatalog } from "@/modules/shared/records/catalog";
import { useWorkspaceRefresh } from "@/modules/shared/records/hooks";
import { useRecordScope } from "@/modules/shared/records/scope";

import { defaultPlannerStep, sections } from "../planner-navigation";

export function usePlannerWorkspace({
  onDirtyChange,
}: {
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const { getResource } = useRecordCatalog();
  const scope = useRecordScope();
  const params = useSearchParams();
  const [requestedStep, setStep] = useQueryValue(
    "step",
    Object.entries(sections).find(([, section]) =>
      section.ids.includes(params.get("evidence") ?? ""),
    )?.[0] ?? defaultPlannerStep,
  );
  const step = Object.hasOwn(sections, requestedStep) ? requestedStep : defaultPlannerStep;
  const refresh = useWorkspaceRefresh();
  const confirm = useConfirm();
  const [cycleDirty, setCycleDirty] = useState(false);
  useEffect(() => {
    onDirtyChange?.(cycleDirty);
    return () => onDirtyChange?.(false);
  }, [cycleDirty, onDirtyChange]);
  const navigate = (action: () => void) => {
    if (!cycleDirty) {
      action();
      return;
    }
    confirm({
      title: "Zahodit rozepsané opakování?",
      description: "Změny cyklu ještě nejsou uložené.",
      confirmLabel: "Zahodit změny",
      onConfirm: action,
    });
  };
  const [creatingVersion, setCreatingVersion] = useState(false);
  const [planId, setPlanId] = useQueryValue("plan");
  const [versionId, setVersionId] = useQueryValue("version");
  const [tab, setTab] = useQueryValue("tab");
  const plans = useQuery({
    queryKey: [...workspaceKey, "planner-plans"],
    queryFn: ({ signal }) => listAllRows(getResource("teaching_plans"), signal),
  });
  const versions = useQuery({
    queryKey: [...workspaceKey, "planner-versions"],
    queryFn: ({ signal }) => listAllRows(getResource("timetable_versions"), signal),
    enabled: ["versions", "preferences", "review"].includes(step),
  });
  const availablePlans = (plans.data ?? []).filter(
    (row) =>
      !scope?.defaults.school_year_id || row.school_year_id === scope.defaults.school_year_id,
  );
  const plan = availablePlans.find((row) => row.id === planId) ?? availablePlans[0];
  const activePlanId = String(plan?.id ?? "");
  const availableVersions = (versions.data ?? []).filter(
    (row) => row.teaching_plan_id === activePlanId,
  );
  const version =
    availableVersions.find((row) => row.id === versionId) ??
    availableVersions.find((row) => row.status === "draft") ??
    availableVersions[0];
  const needsPlan = ["cycle", "teaching", "versions", "preferences", "calendar", "review"].includes(
    step,
  );
  const section = sections[step] ?? { hint: "", ids: ["teaching_plans"] };
  const resourceId = (section.ids.includes(tab) ? tab : section.ids[0]) ?? "teaching_plans";
  const resource = resourceId ? getResource(resourceId) : null;
  const bound =
    needsPlan && plan
      ? ["timetable_entries", "timetable_preferences"].includes(resourceId)
        ? { timetable_version_id: version?.id }
        : { teaching_plan_id: activePlanId }
      : {};
  return {
    getResource,
    step,
    setStep,
    refresh,
    setCycleDirty,
    navigate,
    creatingVersion,
    setCreatingVersion,
    planId,
    setPlanId,
    setVersionId,
    setTab,
    plans,
    versions,
    availablePlans,
    plan,
    activePlanId,
    availableVersions,
    version,
    needsPlan,
    section,
    resourceId,
    resource,
    bound,
  };
}
