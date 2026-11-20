"use client";

import type { ApiError } from "@/core/api/api-errors";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useAuthStore, useAuthUser } from "@/core/auth/store";
import { useUnsavedChanges } from "@/core/hooks/useUnsavedChanges";
import { addDays } from "@/core/time/school";
import { toast } from "@/core/ui/feedback/toast";
import { useConfirm } from "@/core/ui/overlays/ConfirmProvider";
import { submitExcuse } from "@/modules/classbook/api";
import { workspaceKey } from "@/modules/shared/records/api";
import { usePermissions, useWorkspaceRefresh } from "@/modules/shared/records/hooks";

import { attendancePeriodError, attendanceSummary, initialAttendancePeriod } from "../attendance";
import { getAttendanceView } from "../attendance-api";
import { useChildren } from "./useChildren";

interface ExcuseSubmission {
  student: string;
  reason: string;
  ids: string[];
  scope: string;
}
export function useOwnAttendance() {
  const user = useAuthUser();
  const can = usePermissions();
  const confirm = useConfirm();
  const refresh = useWorkspaceRefresh();
  const { parent, children } = useChildren();
  const [selection, selectStudent] = useState(() =>
    typeof window === "undefined"
      ? ""
      : (new URLSearchParams(window.location.search).get("student") ?? ""),
  );
  const student = parent
    ? (children.data?.find((child) => child.student_id === selection)?.student_id ??
      children.data?.[0]?.student_id ??
      "")
    : (user?.id ?? "");
  const studentName = parent
    ? children.data?.find((child) => child.student_id === student)?.name
    : undefined;
  const [period, setPeriod] = useState(initialAttendancePeriod);
  const rangeError = attendancePeriodError(period.from, period.to);
  const scope = `${user?.id}:${student}:${period.from}:${period.to}`;
  const [draft, setDraft] = useState({ scope: "", selected: [] as string[], reason: "" });
  const selected = draft.scope === scope ? draft.selected : [];
  const reason = draft.scope === scope ? draft.reason : "";
  const [opened, setOpened] = useState<string | null>(null);
  const [sent, setSent] = useState<{ scope: string; count: number } | null>(null);
  const [conflicts, setConflicts] = useState<{ scope: string; ids: string[] }>({
    scope: "",
    ids: [],
  });
  const [onlyAbsences, setOnlyAbsences] = useState(true);
  const dirty = !!(selected.length || reason.trim());
  useUnsavedChanges(dirty);
  const query = useQuery({
    queryKey: [...workspaceKey, "attendance", student, period.from, period.to],
    queryFn: ({ signal }) =>
      getAttendanceView(
        student,
        { from: period.from, to: addDays(period.to, 1) },
        { schedule: can("timetable.read"), requests: can("attendance.request") },
        signal,
      ),
    enabled: !!student && can("classbook.read") && !rangeError,
  });
  const records = [
    ...(query.data ?? []).map((record) =>
      conflicts.scope === scope && conflicts.ids.includes(record.id)
        ? { ...record, can_request_excuse: false }
        : record,
    ),
  ].sort(
    (a, b) =>
      Date.parse(b.starts_at ?? "1970-01-01") - Date.parse(a.starts_at ?? "1970-01-01") ||
      a.id.localeCompare(b.id),
  );
  const visible = onlyAbsences ? records.filter((record) => record.status !== "present") : records;
  const eligible = visible.filter((record) => record.can_request_excuse);
  const chosen = records.filter((record) => selected.includes(record.id));
  const invalidSelection =
    selected.length !== chosen.length || chosen.some((record) => !record.can_request_excuse);
  const send = useMutation({
    onMutate: () => useAuthStore.getState().sessionVersion,
    mutationFn: (payload: ExcuseSubmission) =>
      submitExcuse(payload.student, payload.reason, payload.ids),
    onSuccess: async (_data, payload, version) => {
      if (version !== useAuthStore.getState().sessionVersion) return;
      setDraft((previous) =>
        previous.scope === payload.scope ? { scope: "", selected: [], reason: "" } : previous,
      );
      setOpened((previous) => (previous === payload.scope ? null : previous));
      setSent({ scope: payload.scope, count: payload.ids.length });
      await refresh();
      if (version === useAuthStore.getState().sessionVersion)
        toast.success("Žádost o omluvení byla odeslána.");
    },
    onError: async (error: ApiError, payload) => {
      if (error.status === 409) {
        setConflicts({ scope: payload.scope, ids: payload.ids });
        await query.refetch();
      }
    },
  });
  const navigate = (action: () => void) => {
    if (send.isPending) return;
    const change = () => {
      setDraft({ scope: "", selected: [], reason: "" });
      setOpened(null);
      setConflicts({ scope: "", ids: [] });
      send.reset();
      action();
    };
    if (!dirty) {
      change();
      return;
    }
    confirm({
      title: "Zahodit rozepsanou omluvenku?",
      description: "Změnou dítěte nebo období se zruší výběr absencí a rozepsaný důvod.",
      confirmLabel: "Zahodit změny",
      onConfirm: change,
    });
  };
  return {
    can,
    parent,
    student,
    studentName,
    children,
    setStudent: (id: string) => navigate(() => selectStudent(id)),
    period,
    rangeError,
    changePeriod: (field: "from" | "to", value: string) =>
      navigate(() => setPeriod((previous) => ({ ...previous, [field]: value }))),
    selected,
    setSelected: (ids: string[]) => setDraft({ scope, selected: ids, reason }),
    reason,
    setReason: (value: string) => setDraft({ scope, selected, reason: value }),
    onlyAbsences,
    setOnlyAbsences,
    query,
    records,
    visible,
    eligible,
    chosen,
    invalidSelection,
    send,
    summary: attendanceSummary(records),
    sentCount: sent?.scope === scope ? sent.count : 0,
    dialogOpen: opened === scope && !!chosen.length,
    openDialog: () => {
      send.reset();
      setOpened(scope);
    },
    closeDialog: () => {
      if (!send.isPending) setOpened(null);
    },
    submit: () => {
      if (
        !reason.trim() ||
        !chosen.length ||
        chosen.length > 100 ||
        invalidSelection ||
        query.isFetching ||
        send.isPending ||
        !can("attendance.request")
      )
        return;
      send.mutate({ student, reason, ids: chosen.map((record) => record.id), scope });
    },
  };
}
