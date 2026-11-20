"use client";
import type { Row } from "@/modules/shared/records/types";
import type { GroupContext } from "../membership";

import { Button } from "@/core/ui/actions/Button";
import { Checkbox } from "@/core/ui/forms/Checkbox";
import { Input } from "@/core/ui/forms/Input";
import { Select } from "@/core/ui/forms/Select";
import { rowLabel } from "@/modules/shared/records/format";

import { useStudentSelection } from "../hooks/useStudentSelection";

export function StudentSelectionTable({
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
  const {
    filters,
    resetFilters,
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
  } = useStudentSelection({ accounts, classes, specializations, context, selected, onChange });
  return (
    <section className="space-y-3" aria-label="Výběr žáků do skupiny">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          label="Hledat žáka"
          placeholder="Jméno nebo uživatelské jméno"
          value={filters.search}
          onChange={(event) => change("search", event.target.value)}
        />
        <Select
          label="Třída"
          value={filters.classId}
          onChange={(event) => change("classId", event.target.value)}
        >
          <option value="">Všechny třídy</option>
          {classes.map((row) => (
            <option key={String(row.id)} value={String(row.id)}>
              {rowLabel(row)}
            </option>
          ))}
        </Select>
        <Select
          label="Zaměření"
          value={filters.specializationId}
          onChange={(event) => change("specializationId", event.target.value)}
        >
          <option value="">Všechna zaměření</option>
          <option value="none">Bez uvedeného zaměření</option>
          {specializations.map((row) => (
            <option key={String(row.id)} value={String(row.id)}>
              {rowLabel(row)}
            </option>
          ))}
        </Select>
        <Select
          label="Členství ve skupině"
          value={filters.groupId}
          onChange={(event) => change("groupId", event.target.value)}
        >
          <option value="">Všechny skupiny</option>
          <option value="none">Bez členství ve skupině</option>
          {context.groups.map((row) => (
            <option key={String(row.id)} value={String(row.id)}>
              {rowLabel(row)}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <Select
          label="Zařazení ve školním roce"
          fieldWidth="standard"
          value={filters.enrollment}
          onChange={(event) => change("enrollment", event.target.value)}
        >
          <option value="enrolled">Zařazení do třídy</option>
          <option value="unassigned">Bez zařazení do třídy</option>
          <option value="all">Všichni žáci</option>
        </Select>
        <Select
          label="Stav účtu"
          fieldWidth="short"
          value={filters.status}
          onChange={(event) => change("status", event.target.value)}
        >
          <option value="active">Aktivní</option>
          <option value="inactive">Neaktivní</option>
          <option value="all">Všechny účty</option>
        </Select>
        <Button
          variant="choice"
          aria-pressed={filters.selectedOnly}
          onClick={() => change("selectedOnly", !filters.selectedOnly)}
        >
          Jen vybrané ({selected.length})
        </Button>
        <Button variant="outline" size="sm" onClick={resetFilters}>
          Vymazat filtry
        </Button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-(--color-border) pt-3">
        <p className="text-sm">
          Zobrazeno <strong>{rows.length}</strong> z {roster.length} · vybráno{" "}
          <strong>{selected.length}</strong>
          {selectedOutside > 0 ? ` (${selectedOutside} mimo filtr)` : ""}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" disabled={!available.length} onClick={selectFiltered}>
            Vybrat filtrované
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!some}
            onClick={() => onChange(selected.filter((id) => !available.includes(id)))}
          >
            Odebrat filtrované
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!selected.length}
            onClick={() => onChange([])}
          >
            Zrušit výběr
          </Button>
        </div>
      </div>
      <div className="ui-panel max-h-[420px] overflow-auto">
        <table
          className="ui-table w-full min-w-[800px] text-left text-sm"
          aria-label="Žáci pro ruční vytvoření skupiny"
        >
          <thead className="sticky top-0 z-10 bg-(--color-surface-100)">
            <tr className="border-b border-(--color-border)">
              <th className="w-12 p-3">
                <Checkbox
                  aria-label="Vybrat všechny filtrované žáky"
                  disabled={!available.length}
                  checked={all}
                  ref={(node) => {
                    if (node) node.indeterminate = some && !all;
                  }}
                  onChange={(event) =>
                    event.target.checked
                      ? selectFiltered()
                      : onChange(selected.filter((id) => !available.includes(id)))
                  }
                />
              </th>
              <th
                className="p-3"
                aria-sort={
                  sort.field === "name" ? (sort.descending ? "descending" : "ascending") : "none"
                }
              >
                <button
                  type="button"
                  className="min-h-11 font-semibold"
                  onClick={() => sortBy("name")}
                >
                  Žák ↕
                </button>
              </th>
              <th
                className="p-3"
                aria-sort={
                  sort.field === "classIds"
                    ? sort.descending
                      ? "descending"
                      : "ascending"
                    : "none"
                }
              >
                <button
                  type="button"
                  className="min-h-11 font-semibold"
                  onClick={() => sortBy("classIds")}
                >
                  Třída ↕
                </button>
              </th>
              <th
                className="p-3"
                aria-sort={
                  sort.field === "specializationIds"
                    ? sort.descending
                      ? "descending"
                      : "ascending"
                    : "none"
                }
              >
                <button
                  type="button"
                  className="min-h-11 font-semibold"
                  onClick={() => sortBy("specializationIds")}
                >
                  Zaměření ↕
                </button>
              </th>
              <th className="p-3">Členství ve skupinách</th>
              <th className="p-3">Stav</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className={`border-b border-(--color-border) last:border-0 ${selected.includes(row.id) ? "bg-(--color-surface-200)" : "hover:bg-(--color-surface-200)/50"}`}
              >
                <td className="p-3">
                  <Checkbox
                    aria-label={`Vybrat žáka ${row.name}`}
                    disabled={!row.active}
                    checked={selected.includes(row.id)}
                    onChange={(event) =>
                      onChange(
                        event.target.checked
                          ? [...new Set([...selected, row.id])]
                          : selected.filter((id) => id !== row.id),
                      )
                    }
                  />
                </td>
                <th scope="row" className="p-3 font-medium">
                  <span className="block">{row.name}</span>
                  <span className="mt-1 block text-xs font-normal text-(--color-muted-foreground)">
                    {row.username}
                  </span>
                </th>
                <td className="p-3">{labels(row.classIds, classes)}</td>
                <td className="p-3">{labels(row.specializationIds, specializations)}</td>
                <td className="max-w-64 p-3 text-xs text-(--color-muted-foreground)">
                  {labels(row.groupIds, context.groups)}
                </td>
                <td className="p-3 text-xs">{row.active ? "Aktivní" : "Neaktivní"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <p className="p-6 text-center text-sm text-(--color-muted-foreground)">
            Žádní žáci neodpovídají filtrům. Změňte nebo vymažte filtry.
          </p>
        )}
      </div>
      <p className="text-xs text-(--color-muted-foreground)">
        Třída, zaměření a členství odpovídají zvolenému období. Změna filtru neodstraňuje předchozí
        výběr.
      </p>
    </section>
  );
}
