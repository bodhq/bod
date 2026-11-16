"use client";
import type { Row } from "@/modules/shared/records/types";

import Link from "next/link";

import { addDays, dateLabel } from "@/core/time/school";
import { Button } from "@/core/ui/actions/Button";
import { EmptyState } from "@/core/ui/feedback/EmptyState";
import { ErrorState } from "@/core/ui/feedback/ErrorState";
import { LoadingState } from "@/core/ui/feedback/LoadingState";
import { Checkbox } from "@/core/ui/forms/Checkbox";
import { Input } from "@/core/ui/forms/Input";
import { Panel } from "@/core/ui/layout/Panel";
import { Dialog } from "@/core/ui/overlays/Dialog";
import { request, resourcePath } from "@/modules/shared/records/api";
import { RecordDialog } from "@/modules/shared/records/components/RecordDialog";
import { rowLabel } from "@/modules/shared/records/format";
import { RecordScopeProvider } from "@/modules/shared/records/scope";

import { useClassRoster } from "../hooks/useClassRoster";

export function ClassRoster({ classroom }: { classroom: Row }) {
  const {
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
    accounts,
    years,
    enrollments,
    year,
    rows,
    yearStart,
    yearEnd,
    candidates,
    assign,
  } = useClassRoster({ classroom });
  if (!can("users.manage"))
    return (
      <EmptyState title="Jmenný seznam není pro tuto roli dostupný">
        Správa žáků třídy potřebuje oprávnění ke čtení uživatelských účtů. Obraťte se na správce
        školy.
      </EmptyState>
    );
  if (accounts.isPending || years.isPending || enrollments.isPending)
    return <LoadingState>Načítám žáky třídy…</LoadingState>;
  if (accounts.isError || years.isError || enrollments.isError)
    return <ErrorState error={accounts.error ?? years.error ?? enrollments.error} />;
  return (
    <section className="ui-stack">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold">Žáci třídy</h3>
          <p className="mt-1 text-sm text-(--color-muted-foreground)">
            Počet žáků: {rows.length}
            {year ? ` · školní rok ${year.name}` : ""}
          </p>
        </div>
        <Button
          disabled={!year}
          onClick={() => {
            setPeriodStart(yearStart);
            setPeriodEnd(yearEnd);
            setAdding(true);
            setSelected([]);
            setSaved(0);
            setSearch("");
            assign.reset();
          }}
        >
          Přidat žáky do třídy
        </Button>
      </div>
      {!rows.length ? (
        <EmptyState title="Třída zatím nemá žádné žáky">
          Vyberte žáky ze školního seznamu. Přiřazení ke třídě a školnímu roku vyplníme za vás.
        </EmptyState>
      ) : (
        <ul className="visual-people-grid">
          {rows.map((row) => {
            const student = accounts.data.find((user) => user.id === row.student_id);
            return (
              <Panel as="li" key={String(row.id)} className="ui-stack">
                <span className="visual-avatar" aria-hidden="true">
                  {(student ? rowLabel(student) : "?")
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((word) => word[0])
                    .join("")}
                </span>
                <div>
                  <p className="font-semibold">
                    {student ? rowLabel(student) : "Žák s nedostupným účtem"}
                  </p>
                  <p className="mt-1 text-sm text-(--color-muted-foreground)">
                    {student?.username}
                    {row.valid_from !== yearStart || row.valid_to !== yearEnd
                      ? ` · ${dateLabel(String(row.valid_from))} – ${dateLabel(addDays(String(row.valid_to), -1))}`
                      : " · celý školní rok"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" onClick={() => setEditingRange(row)}>
                    Upravit zařazení
                  </Button>
                  <Link
                    className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-(--color-primary-accessible) hover:bg-(--color-surface-hover) focus-visible:outline-2 focus-visible:outline-(--color-ring)"
                    href={`/app/school?evidence=parent_students&zak=${encodeURIComponent(String(row.student_id))}`}
                  >
                    Rodiče a kontakty →
                  </Link>
                </div>
              </Panel>
            );
          })}
        </ul>
      )}
      {editingRange && (
        <RecordScopeProvider value={null}>
          <RecordDialog
            title="Zařazení žáka do třídy"
            description={`Období, obor studia a zaměření ve třídě ${rowLabel(classroom)}.`}
            editing
            initial={editingRange}
            useScopeDefaults={false}
            fields={resource.fields
              .filter((field) =>
                ["valid_from", "valid_to", "study_field_id", "specialization_id"].includes(
                  field.name,
                ),
              )
              .map((field) => ({
                ...field,
                label:
                  field.name === "valid_from"
                    ? "První den ve třídě"
                    : field.name === "valid_to"
                      ? "Poslední den ve třídě"
                      : field.label,
              }))}
            onClose={() => setEditingRange(null)}
            onSave={async (body) => {
              if (!resource.parsePatch) return;
              await request("PATCH", resourcePath(resource, editingRange), {
                body: resource.parsePatch(body),
              });
              await refresh();
              setEditingRange(null);
            }}
          />
        </RecordScopeProvider>
      )}
      <Dialog
        open={adding}
        title="Přidat žáky do třídy"
        onClose={() => {
          if (!assign.isPending) setAdding(false);
        }}
        description={`Vybraní žáci budou patřit do třídy ${rowLabel(classroom)} ${periodStart === yearStart && periodEnd === yearEnd ? `po celý školní rok ${year?.name ?? ""}` : "ve zvoleném období"}.`}
      >
        <div className="mt-5 space-y-4">
          <Input
            label="Najít žáka"
            placeholder="Jméno nebo uživatelské jméno"
            value={search}
            disabled={assign.isPending}
            onChange={(event) => setSearch(event.target.value)}
          />
          <details className="ui-panel p-3">
            <summary className="cursor-pointer text-sm font-medium">
              Jiné období než celý školní rok
            </summary>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Input
                label="Zařadit od"
                type="date"
                min={yearStart}
                max={yearEnd ? addDays(yearEnd, -1) : undefined}
                value={periodStart}
                disabled={assign.isPending}
                onChange={(event) => setPeriodStart(event.target.value)}
              />
              <Input
                label="Poslední den ve třídě"
                type="date"
                min={periodStart}
                max={yearEnd ? addDays(yearEnd, -1) : undefined}
                value={periodEnd ? addDays(periodEnd, -1) : ""}
                disabled={assign.isPending}
                onChange={(event) =>
                  setPeriodEnd(event.target.value ? addDays(event.target.value, 1) : "")
                }
              />
            </div>
          </details>
          <p className="text-sm text-(--color-muted-foreground)">
            Nabízíme aktivní žáky, kteří ve vybraném období nemají přiřazení do jiné třídy.
          </p>
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {candidates.map((user) => (
              <label
                key={user.id}
                className="flex min-h-14 cursor-pointer items-center gap-3 rounded-lg p-3 hover:bg-(--color-surface-hover)"
              >
                <Checkbox
                  checked={selected.includes(user.id)}
                  disabled={assign.isPending}
                  onChange={(event) =>
                    setSelected((previous) =>
                      event.target.checked
                        ? [...previous, user.id]
                        : previous.filter((id) => id !== user.id),
                    )
                  }
                />
                <span>
                  <span className="block font-medium">{rowLabel(user)}</span>
                  <span className="text-sm text-(--color-muted-foreground)">{user.username}</span>
                </span>
              </label>
            ))}
            {!candidates.length && (
              <p className="py-5 text-sm text-(--color-muted-foreground)">
                Žádní další žáci odpovídající výběru. Nové účty se zakládají ve správě přístupů.
              </p>
            )}
          </div>
          {assign.isError && (
            <ErrorState
              title={
                saved
                  ? "Část žáků už je přiřazená. Zbývající můžete uložit znovu."
                  : "Žáky se nepodařilo přiřadit"
              }
              error={assign.error}
            />
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" disabled={assign.isPending} onClick={() => setAdding(false)}>
              Zrušit
            </Button>
            <Button
              isLoading={assign.isPending}
              disabled={!selected.length}
              onClick={() => assign.mutate()}
            >
              Přidat vybrané žáky ({selected.length})
            </Button>
          </div>
        </div>
      </Dialog>
    </section>
  );
}
