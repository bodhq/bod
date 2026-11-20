"use client";

import type { Row } from "@/modules/shared/records/types";

import { useQueries } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { useQueryValue } from "@/core/hooks/useQueryValue";
import { useConfirm } from "@/core/ui/overlays/ConfirmProvider";
import { listAllRows, workspaceKey } from "@/modules/shared/records/api";
import { useRecordCatalog } from "@/modules/shared/records/catalog";
import { rowLabel } from "@/modules/shared/records/format";
import { useWorkspaceRefresh } from "@/modules/shared/records/hooks";

export function useRoomStudio() {
  const { getResource } = useRecordCatalog();
  const refresh = useWorkspaceRefresh();
  const confirm = useConfirm();
  const queries = useQueries({
    queries: ["rooms", "room_types"].map((id) => ({
      queryKey: [...workspaceKey, "room-studio", id],
      queryFn: ({ signal }: { signal: AbortSignal }) => listAllRows(getResource(id), signal),
    })),
  });
  const rooms = queries[0]?.data ?? [],
    types = queries[1]?.data ?? [];
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [capacity, setCapacity] = useState("0");
  const [selectedId, setSelectedId] = useQueryValue("record");
  const [requestedSection, setSection] = useQueryValue("section", "availability");
  const section = requestedSection === "groups" ? "groups" : "availability";
  const [editor, setEditor] = useState<{ row?: Row } | null>(null);
  const [typeOpen, setTypeOpen] = useState<{ row?: Row } | null>(null);
  const selected = rooms.find((row) => row.id === selectedId);
  const roomsLoaded = queries[0]?.isSuccess;
  useEffect(() => {
    if (!selectedId || !roomsLoaded || selected) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("record");
    url.searchParams.delete("section");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, [selectedId, roomsLoaded, selected]);
  const typeName = (code: unknown) => {
    const row = types.find((row) => row.code === code);
    return row ? rowLabel(row) : String(code ?? "Typ neurčen");
  };
  const visible = rooms.filter(
    (row) =>
      (!type || row.room_type_code === type) &&
      Number(row.capacity) >= Number(capacity) &&
      `${rowLabel(row)} ${row.code}`
        .toLocaleLowerCase("cs")
        .includes(search.toLocaleLowerCase("cs")),
  );
  return {
    getResource,
    refresh,
    confirm,
    queries,
    rooms,
    types,
    search,
    setSearch,
    type,
    setType,
    capacity,
    setCapacity,
    setSelectedId,
    section,
    setSection,
    editor,
    setEditor,
    typeOpen,
    setTypeOpen,
    selected,
    typeName,
    visible,
  };
}
