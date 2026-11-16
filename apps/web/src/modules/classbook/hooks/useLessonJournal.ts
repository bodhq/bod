"use client";

import type { ClassbookEntriesRead } from "@bod/api-client/types.gen";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { useAuthUser } from "@/core/auth/store";
import { useConfirm } from "@/core/ui/overlays/ConfirmProvider";
import { listAllRows, workspaceKey } from "@/modules/shared/records/api";
import { useRecordCatalog } from "@/modules/shared/records/catalog";
import { addDays, monday, today } from "@/modules/shared/records/format";
import {
  usePermissions,
  useReferenceNames,
  useWorkspaceRefresh,
} from "@/modules/shared/records/hooks";
import { scheduleNames } from "@/modules/timetable/names";
import { timetableQueries } from "@/modules/timetable/queries";

import { buildJournalDay, chooseJournalPage } from "../journal";
import { classbookQueries } from "../queries";

export function useLessonJournal({ onDirtyChange }: { onDirtyChange: (dirty: boolean) => void }) {
  const params = useSearchParams();
  const [selected, setSelected] = useState(params.get("hodina") ?? "");
  const confirm = useConfirm();
  const [drafts, setDrafts] = useState<Record<string, boolean>>({});
  const dirty = Object.values(drafts).some(Boolean);
  const reportDirty = useCallback(
    (key: string, value: boolean) =>
      setDrafts((previous) => (previous[key] === value ? previous : { ...previous, [key]: value })),
    [],
  );
  useEffect(() => {
    onDirtyChange(dirty);
    return () => onDirtyChange(false);
  }, [dirty, onDirtyChange]);
  const navigate = (action: () => void) => {
    if (!dirty) {
      action();
      return;
    }
    confirm({
      title: "Zahodit rozepsaný zápis?",
      description: "Před změnou dne nebo skupiny zápis uložte, nebo změny zahoďte.",
      confirmLabel: "Zahodit změny",
      onConfirm: action,
    });
  };
  const user = useAuthUser();
  const can = usePermissions();
  const refresh = useWorkspaceRefresh();
  const { getResource, workflows } = useRecordCatalog();
  const references = useReferenceNames(["subjects", "teaching_groups", "rooms", "users"]);
  const [day, setDay] = useState(() => {
    const requested = params.get("den");
    return requested &&
      /^\d{4}-\d{2}-\d{2}$/.test(requested) &&
      Number.isFinite(Date.parse(`${requested}T12:00:00Z`))
      ? requested
      : today();
  });
  const [group, setGroup] = useState("");
  const [extra, setExtra] = useState(false);
  const managed = useQuery({
    queryKey: [...workspaceKey, "journal-entries"],
    queryFn: ({ signal }) =>
      listAllRows(getResource("classbook_entries"), signal) as Promise<ClassbookEntriesRead[]>,
    enabled: can("classbook.manage"),
  });
  const own = useQuery({
    ...classbookQueries.lessons(),
    enabled: !can("classbook.manage") && can("classbook.read"),
  });
  const week = monday(day);
  const schedule = useQuery({
    ...timetableQueries.week(week, addDays(week, 7)),
    enabled: can("timetable.read"),
  });
  const entriesQuery = can("classbook.manage") ? managed : own;
  const entries = entriesQuery.data ?? [];
  const planned = schedule.data ?? [];
  const names = scheduleNames(planned, references);
  const groups = [
    ...new Set([
      ...entries.map((entry) => entry.group_id),
      ...planned.map((lesson) => lesson.group_id),
    ]),
  ];
  const { pages, completed } = buildJournalDay(entries, planned, day, group);
  const chosen = chooseJournalPage(pages, selected);
  const time = (value: string) =>
    new Date(value).toLocaleTimeString("cs-CZ", {
      timeZone: "Europe/Prague",
      hour: "2-digit",
      minute: "2-digit",
    });
  const attendanceWorkflow = workflows.find((item) => item.id === "attendance");
  return {
    setSelected,
    reportDirty,
    navigate,
    user,
    can,
    refresh,
    getResource,
    names,
    day,
    setDay,
    group,
    setGroup,
    extra,
    setExtra,
    schedule,
    entriesQuery,
    groups,
    pages,
    completed,
    chosen,
    time,
    attendanceWorkflow,
  };
}
