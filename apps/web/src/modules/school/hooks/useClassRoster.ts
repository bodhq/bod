"use client";

import type { Row } from "@/modules/shared/records/types";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { getAccountDirectory } from "@/core/accounts/api";
import { listAllRows, request, workspaceKey } from "@/modules/shared/records/api";
import { useRecordCatalog } from "@/modules/shared/records/catalog";
import { rowLabel } from "@/modules/shared/records/format";
import { usePermissions, useWorkspaceRefresh } from "@/modules/shared/records/hooks";

export function useClassRoster({ classroom }: { classroom: Row }) {
  const { getResource } = useRecordCatalog();
  const can = usePermissions();
  const client = useQueryClient();
  const refresh = useWorkspaceRefresh();
  const [editingRange, setEditingRange] = useState<Row | null>(null);
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [saved, setSaved] = useState(0);
  const resource = getResource("class_enrollments");
  const key = [...workspaceKey, "class-roster-enrollments"];
  const accounts = useQuery({
    queryKey: [...workspaceKey, "family-directory"],
    queryFn: ({ signal }) => getAccountDirectory(signal),
    enabled: can("users.manage"),
  });
  const years = useQuery({
    queryKey: [...workspaceKey, "roster-years"],
    queryFn: ({ signal }) => listAllRows(getResource("school_years"), signal),
  });
  const enrollments = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => listAllRows(resource, signal),
  });
  const year = years.data?.find((row) => row.id === classroom.school_year_id);
  const rows = (enrollments.data ?? []).filter((row) => row.class_id === classroom.id);
  const yearStart = String(year?.starts_on ?? ""),
    yearEnd = String(year?.ends_on ?? "");
  const begins = adding ? periodStart : yearStart,
    ends = adding ? periodEnd : yearEnd;
  const occupied = new Set(
    (enrollments.data ?? [])
      .filter((row) => String(row.valid_from) < ends && begins < String(row.valid_to))
      .map((row) => String(row.student_id)),
  );
  const candidates = (accounts.data ?? [])
    .filter((user) => user.is_active && user.roles?.includes("student") && !occupied.has(user.id))
    .filter((user) =>
      `${rowLabel(user)} ${user.username}`
        .toLocaleLowerCase("cs")
        .includes(search.toLocaleLowerCase("cs")),
    );
  const assign = useMutation({
    mutationFn: async () => {
      if (!year) throw new Error("Nejprve nastavte školní rok této třídy.");
      if (
        !periodStart ||
        !periodEnd ||
        periodStart < yearStart ||
        periodEnd > yearEnd ||
        periodEnd <= periodStart
      )
        throw new Error("Vyberte platné období uvnitř školního roku této třídy.");
      try {
        for (const studentId of selected) {
          if (occupied.has(studentId)) {
            setSelected((previous) => previous.filter((id) => id !== studentId));
            continue;
          }
          const created = await request<Row>("POST", resource.path, {
            body: resource.parseCreate({
              class_id: classroom.id,
              student_id: studentId,
              valid_from: periodStart,
              valid_to: periodEnd,
            }),
          });
          client.setQueryData<Row[]>(key, (previous) => [...(previous ?? []), created]);
          setSelected((previous) => previous.filter((id) => id !== studentId));
          setSaved((count) => count + 1);
        }
        setAdding(false);
      } finally {
        await refresh();
      }
    },
  });
  return {
    can,
    refresh,
    editingRange,
    setEditingRange,
    adding,
    setAdding,
    search,
    setSearch,
    selected,
    setSelected,
    periodStart,
    setPeriodStart,
    periodEnd,
    setPeriodEnd,
    saved,
    setSaved,
    resource,
    key,
    accounts,
    years,
    enrollments,
    year,
    rows,
    yearStart,
    yearEnd,
    candidates,
    assign,
  };
}
