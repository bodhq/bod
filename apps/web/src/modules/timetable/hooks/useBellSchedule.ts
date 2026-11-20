"use client";

import type { Row } from "@/modules/shared/records/types";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { useConfirm } from "@/core/ui/overlays/ConfirmProvider";
import { listAllRows, request, workspaceKey } from "@/modules/shared/records/api";
import { useRecordCatalog } from "@/modules/shared/records/catalog";
import { useWorkspaceRefresh } from "@/modules/shared/records/hooks";

import { buildBellDay, clockMinutes, clockTime } from "../bell-schedule";

export function useBellSchedule({ grid, readOnly = false }: { grid: Row; readOnly?: boolean }) {
  const { getResource } = useRecordCatalog();
  const resource = getResource("time_slots");
  const refresh = useWorkspaceRefresh(),
    confirm = useConfirm(),
    client = useQueryClient();
  const key = [...workspaceKey, "bell-schedule-slots"];
  const query = useQuery({ queryKey: key, queryFn: ({ signal }) => listAllRows(resource, signal) });
  const slots = (query.data ?? [])
    .filter((row) => row.time_grid_id === grid.id)
    .sort((a, b) => Number(a.position) - Number(b.position));
  const [building, setBuilding] = useState(false),
    [started, setStarted] = useState(false);
  const [start, setStart] = useState("08:00"),
    [count, setCount] = useState(6),
    [duration, setDuration] = useState(45),
    [pause, setPause] = useState(10),
    [longPause, setLongPause] = useState(20),
    [longAfter, setLongAfter] = useState(2);
  const [editor, setEditor] = useState<{ row?: Row; initial: Row } | null>(null);
  let preview: ReturnType<typeof buildBellDay> = [],
    previewError = "";
  try {
    preview = buildBellDay(start, count, duration, pause, longPause, longAfter);
  } catch (error) {
    previewError = (error as Error).message;
  }
  const create = useMutation({
    mutationFn: async () => {
      if (readOnly) throw new Error("Publikované zvonění už nelze měnit.");
      const planned = buildBellDay(start, count, duration, pause, longPause, longAfter);
      setStarted(true);
      try {
        for (const row of planned) {
          const existing = slots.find((slot) => Number(slot.position) === row.position);
          if (existing) {
            if (
              String(existing.start_time).slice(0, 5) === row.start_time.slice(0, 5) &&
              String(existing.end_time).slice(0, 5) === row.end_time.slice(0, 5)
            )
              continue;
            throw new Error(
              "Zvonění už obsahuje jinak nastavenou hodinu. Upravte ji přímo v přehledu.",
            );
          }
          const saved = await request<Row>("POST", resource.path, {
            body: resource.parseCreate({ ...row, time_grid_id: grid.id }),
          });
          client.setQueryData<Row[]>(key, (previous) => [...(previous ?? []), saved]);
        }
        setBuilding(false);
        setStarted(false);
      } finally {
        await refresh();
      }
    },
  });
  const add = () => {
    const last = slots.at(-1);
    const next = last ? Math.min(1380, clockMinutes(String(last.end_time)) + 10) : 480;
    setEditor({
      initial: {
        start_time: clockTime(next),
        end_time: clockTime(Math.min(1439, next + 45)),
        position: last ? Number(last.position) + 1 : 1,
      },
    });
  };
  return {
    resource,
    refresh,
    confirm,
    key,
    query,
    slots,
    building,
    setBuilding,
    started,
    start,
    setStart,
    count,
    setCount,
    duration,
    setDuration,
    pause,
    setPause,
    longPause,
    setLongPause,
    longAfter,
    setLongAfter,
    editor,
    setEditor,
    preview,
    previewError,
    create,
    add,
  };
}
