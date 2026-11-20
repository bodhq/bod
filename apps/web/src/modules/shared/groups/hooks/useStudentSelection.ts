"use client";
import type { Row } from "@/modules/shared/records/types";
import type { GroupContext } from "../membership";

import { useState } from "react";

import { rowLabel } from "@/modules/shared/records/format";

import {
  buildStudentRoster,
  filterStudentRoster,
  type StudentRosterFilters,
  type StudentRosterRow,
} from "../groupRoster";

const initial: StudentRosterFilters = {
  search: "",
  classId: "",
  specializationId: "",
  groupId: "",
  enrollment: "enrolled",
  status: "active",
  selectedOnly: false,
};

export function useStudentSelection({
  accounts,
  classes,
  specializations,
  context,
  selected,
  onChange,
}: {
  accounts: Row[];
  classes: Row[];
  specializations: Row[];
  context: GroupContext;
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [filters, setFilters] = useState(initial);
  const [sort, setSort] = useState<{
    field: "name" | "classIds" | "specializationIds";
    descending: boolean;
  }>({ field: "name", descending: false });
  const change = (key: keyof StudentRosterFilters, value: string | boolean) =>
    setFilters((previous) => ({ ...previous, [key]: value }));
  const labels = (ids: string[], rows: Row[]) =>
    ids
      .map((id) => {
        const row = rows.find((row) => String(row.id) === id);
        return row ? rowLabel(row) : "Nedostupný údaj";
      })
      .join(", ") || "—";
  const roster = buildStudentRoster(
    accounts,
    context,
    classes.map((row) => String(row.id)),
  );
  const rows = filterStudentRoster(roster, filters, selected).sort((a, b) => {
    const value = (row: StudentRosterRow) =>
      sort.field === "name"
        ? row.name
        : labels(row[sort.field], sort.field === "classIds" ? classes : specializations);
    return (sort.descending ? -1 : 1) * value(a).localeCompare(value(b), "cs");
  });
  const available = rows.filter((row) => row.active).map((row) => row.id);
  const all = available.length > 0 && available.every((id) => selected.includes(id));
  const some = available.some((id) => selected.includes(id));
  const selectFiltered = () => onChange([...new Set([...selected, ...available])]);
  const sortBy = (field: typeof sort.field) =>
    setSort((previous) => ({
      field,
      descending: previous.field === field && !previous.descending,
    }));
  const selectedOutside = selected.filter((id) => !rows.some((row) => row.id === id)).length;
  return {
    resetFilters: () => setFilters(initial),
    filters,
    setFilters,
    sort,
    change,
    labels,
    roster,
    rows,
    available,
    all,
    some,
    selectFiltered,
    sortBy,
    selectedOutside,
  };
}
