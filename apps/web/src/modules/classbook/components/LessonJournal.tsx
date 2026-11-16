"use client";
import { Ellipsis } from "lucide-react";

import { DayNavigator } from "@/core/time/DayNavigator";
import { today } from "@/core/time/school";
import { Button } from "@/core/ui/actions/Button";
import { EmptyState } from "@/core/ui/feedback/EmptyState";
import { ErrorState } from "@/core/ui/feedback/ErrorState";
import { LoadingState } from "@/core/ui/feedback/LoadingState";
import { Select } from "@/core/ui/forms/Select";
import { RecordDialog } from "@/modules/shared/records/components/RecordDialog";
import { shortId } from "@/modules/shared/records/format";
import { ReferenceOptionsProvider } from "@/modules/shared/records/scope";

import { createLesson } from "../api";
import { useLessonJournal } from "../hooks/useLessonJournal";
import { journalIdentity } from "../journal";
import { LessonPage } from "./LessonPage";

export function LessonJournal({ onDirtyChange }: { onDirtyChange: (dirty: boolean) => void }) {
  const {
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
  } = useLessonJournal({ onDirtyChange });
  return (
    <section className="lesson-journal">
      <div className="journal-toolbar">
        <DayNavigator compact value={day} onChange={(value) => navigate(() => setDay(value))} />
        <details className="journal-options">
          <summary aria-label="Další možnosti hodiny">
            <Ellipsis size={20} aria-hidden="true" />
            <span>Další možnosti</span>
          </summary>
          <div className="journal-toolbar-actions">
            <Button
              className="journal-today"
              variant="outline"
              onClick={() => navigate(() => setDay(today()))}
            >
              Přejít na dnešek
            </Button>
            {groups.length > 1 && (
              <Select
                aria-label="Třída / skupina"
                fieldWidth="standard"
                value={group}
                onChange={(event) => {
                  const value = event.target.value;
                  navigate(() => setGroup(value));
                }}
              >
                <option value="">Všechny skupiny</option>
                {groups.map((id) => (
                  <option key={id} value={id}>
                    {names.teaching_groups?.[id] ?? `Skupina ${shortId(id)}`}
                  </option>
                ))}
              </Select>
            )}
            <p className="text-sm text-(--color-muted-foreground)" role="status">
              Podepsáno {completed} z {pages.length} hodin
            </p>
            {can("classbook.write") && (
              <Button variant="outline" size="sm" onClick={() => setExtra(true)}>
                + Mimořádná výuka
              </Button>
            )}
          </div>
        </details>
      </div>
      {(entriesQuery.isLoading || schedule.isLoading) && (
        <LoadingState>Otevírám třídní knihu…</LoadingState>
      )}
      {entriesQuery.isError && (
        <ErrorState
          error={entriesQuery.error}
          action={
            <Button variant="outline" onClick={() => entriesQuery.refetch()}>
              Zkusit znovu
            </Button>
          }
        />
      )}
      {schedule.isError && (
        <ErrorState
          title="Plánované hodiny se nepodařilo načíst"
          error={schedule.error}
          action={
            <Button variant="outline" onClick={() => schedule.refetch()}>
              Zkusit znovu
            </Button>
          }
        />
      )}
      {!entriesQuery.isLoading && !schedule.isLoading && !entriesQuery.isError && !pages.length && (
        <EmptyState title="Na tento den nejsou žádné hodiny">
          Vyberte jiný den. Pravidelné hodiny se převezmou z publikovaného rozvrhu.
        </EmptyState>
      )}
      {chosen && (
        <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[160px_minmax(0,1fr)]">
          <nav
            aria-label="Hodiny vybraného dne"
            className="hidden min-w-0 xl:sticky xl:top-6 xl:block xl:space-y-1"
          >
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-(--color-muted-foreground)">
              Hodiny dne
            </p>
            {pages.map((page) => {
              const groupId = page.entry?.group_id ?? page.lesson?.group_id ?? "";
              const subjectId = page.entry?.subject_id ?? page.lesson?.subject_id ?? "";
              return (
                <Button
                  key={page.key}
                  variant="choice"
                  aria-pressed={page.key === chosen.key}
                  onClick={() => navigate(() => setSelected(journalIdentity(page)))}
                  className="w-full text-left whitespace-normal"
                  contentClassName="w-full flex-col items-stretch gap-1 py-1"
                >
                  <span className="flex items-center justify-between gap-2 text-sm">
                    <span className="font-semibold tabular-nums">{time(page.starts)}</span>
                    <span className="text-xs text-(--color-muted-foreground)">
                      {page.entry?.status === "signed"
                        ? "✓ Hotovo"
                        : page.entry
                          ? "Rozepsáno"
                          : "K zápisu"}
                    </span>
                  </span>
                  <span className="block font-medium">
                    {names.subjects?.[subjectId] ?? "Výuka podle rozvrhu"}
                  </span>
                  {names.teaching_groups?.[groupId] && (
                    <span className="block text-sm text-(--color-muted-foreground)">
                      {names.teaching_groups[groupId]}
                    </span>
                  )}
                </Button>
              );
            })}
          </nav>
          <div className="min-w-0 space-y-4">
            <div className="xl:hidden">
              <Select
                aria-label="Vyučovací hodina"
                value={chosen.key}
                onChange={(event) => {
                  const value = event.target.value;
                  navigate(() => setSelected(value));
                }}
              >
                {pages.map((page) => (
                  <option key={page.key} value={page.key}>
                    {time(page.starts)} ·{" "}
                    {names.subjects?.[page.entry?.subject_id ?? page.lesson?.subject_id ?? ""] ??
                      "Výuka"}{" "}
                    ·{" "}
                    {names.teaching_groups?.[page.entry?.group_id ?? page.lesson?.group_id ?? ""] ??
                      "Skupina"}{" "}
                    · {page.entry?.status === "signed" ? "Hotovo" : "K zápisu"}
                  </option>
                ))}
              </Select>
            </div>
            <LessonPage
              key={chosen.key}
              entry={chosen.entry}
              lesson={chosen.lesson}
              onDirtyChange={reportDirty}
              names={names}
            />
          </div>
        </div>
      )}

      {extra && (
        <ReferenceOptionsProvider value={names}>
          <RecordDialog
            title="Mimořádná výuka"
            fields={getResource("classbook_entries").fields.filter(
              (field) =>
                !field.patchOnly &&
                !["actual_teacher_id", "status", "lesson_occurrence_id"].includes(field.name),
            )}
            onClose={() => setExtra(false)}
            onSave={async (body) => {
              await createLesson({ ...body, actual_teacher_id: user?.id });
              await refresh();
              setExtra(false);
            }}
          />
        </ReferenceOptionsProvider>
      )}
    </section>
  );
}
