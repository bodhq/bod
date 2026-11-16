"use client";
import type { Row } from "@/modules/shared/records/types";

import { addDays, dateLabel, monday } from "@/core/time/school";
import { Button } from "@/core/ui/actions/Button";
import { ErrorState } from "@/core/ui/feedback/ErrorState";
import { LoadingState } from "@/core/ui/feedback/LoadingState";
import { Input } from "@/core/ui/forms/Input";
import { Panel, PanelHeader } from "@/core/ui/layout/Panel";
import { request, resourcePath } from "@/modules/shared/records/api";
import { RecordDialog } from "@/modules/shared/records/components/RecordDialog";
import { WorkflowDialog } from "@/modules/shared/records/components/WorkflowDialog";
import { ReferenceScopeProvider } from "@/modules/shared/records/scope";

import { cycleWeek } from "../cycle";
import { useAcademicCalendar } from "../hooks/useAcademicCalendar";

export function AcademicCalendar({ plan }: { plan: Row }) {
  const {
    getResource,
    refresh,
    queries,
    days,
    weekDates,
    weeks,
    phases,
    year,
    month,
    setMonth,
    editing,
    setEditing,
    locked,
    generating,
    setGenerating,
    calendarAction,
  } = useAcademicCalendar({ plan });
  if (queries.some((query) => query.isPending))
    return <LoadingState>Skládám kalendář výuky…</LoadingState>;
  if (queries.some((query) => query.isError))
    return (
      <ErrorState
        error={queries.find((query) => query.isError)?.error}
        action={
          <Button
            variant="outline"
            onClick={() => Promise.all(queries.map((query) => query.refetch()))}
          >
            Zkusit znovu
          </Button>
        }
      />
    );
  const start = `${month}-01`,
    first = monday(start);
  const date = new Date(`${start}T12:00:00Z`);
  const move = (offset: number) => {
    const next = new Date(date);
    next.setUTCMonth(next.getUTCMonth() + offset);
    setMonth(next.toISOString().slice(0, 7));
  };
  const weekId = (day: string) =>
    weekDates.find((row) => row.week_starts_on === monday(day))?.cycle_week_id ??
    cycleWeek(String(plan.cycle_anchor_monday ?? ""), day, phases);
  const code = (id: unknown) => String(weeks.find((row) => row.id === id)?.code ?? "—");
  const saved = editing
    ? editing.kind === "day"
      ? days.find((row) => row.calendar_date === editing.date)
      : weekDates.find((row) => row.week_starts_on === editing.date)
    : undefined;
  const resource = getResource(
    editing?.kind === "week" ? "teaching_plan_calendar_weeks" : "teaching_plan_calendar_days",
  );
  return (
    <section className="ui-stack" aria-label="Kalendář školního roku">
      <PanelHeader
        eyebrow="Rok na jednom místě"
        title="Kalendář výuky"
        description="Klikněte na den pro prázdniny, volno nebo mimořádnou výuku. Pod kalendářem lze změnit typ celého týdne."
      />
      {!locked && calendarAction && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-xl text-sm text-(--color-muted-foreground)">
            Uložené opakování promítněte do kalendáře přepočtem. Ruční výjimky zůstanou zachované.
          </p>
          <Button disabled={!phases.length} onClick={() => setGenerating(true)}>
            {weekDates.length ? "Přepočítat týdny podle cyklu" : "Vytvořit týdny podle cyklu"}
          </Button>
        </div>
      )}
      <div className="visual-calendar-toolbar">
        <Button variant="outline" aria-label="Předchozí měsíc" onClick={() => move(-1)}>
          ←
        </Button>
        <Input
          aria-label="Zobrazený měsíc"
          type="month"
          value={month}
          onChange={(event) => {
            if (event.target.value) setMonth(event.target.value);
          }}
        />
        <Button variant="outline" aria-label="Následující měsíc" onClick={() => move(1)}>
          →
        </Button>
        <h3 className="text-lg font-semibold">
          {date.toLocaleDateString("cs-CZ", { month: "long", year: "numeric", timeZone: "UTC" })}
        </h3>
      </div>
      <Panel as="div" className="ui-stack">
        <div className="visual-calendar" aria-hidden="true">
          {["Po", "Út", "St", "Čt", "Pá", "So", "Ne"].map((day) => (
            <span key={day} className="py-1 text-center text-xs text-(--color-muted-foreground)">
              {day}
            </span>
          ))}
        </div>
        <section className="visual-calendar" aria-label="Dny v měsíci">
          {Array.from({ length: 42 }, (_, i) => addDays(first, i)).map((day) => {
            const record = days.find((row) => row.calendar_date === day),
              weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
            const teaching = record ? !!record.is_teaching_day : weekday !== 0 && weekday !== 6;
            const outside = !!year && (day < String(year.starts_on) || day >= String(year.ends_on));
            const materialized = weekDates.some((row) => row.week_starts_on === monday(day));
            return (
              <button
                key={day}
                type="button"
                className="visual-calendar-day focus-visible:outline-2 focus-visible:outline-(--color-ring) enabled:hover:bg-(--color-surface-hover)"
                data-outside={!day.startsWith(month) || outside}
                data-off={!teaching}
                disabled={locked || outside}
                aria-label={`${dateLabel(day)} · ${teaching ? "výuka" : "volno"}${record?.reason ? ` · ${record.reason}` : ""}`}
                onClick={() => setEditing({ kind: "day", date: day })}
              >
                <span className="flex flex-wrap justify-between gap-1 text-xs">
                  <strong>{Number(day.slice(8))}</strong>
                  <span>
                    {code(weekId(day))}
                    {materialized ? "" : "*"}
                  </span>
                </span>
                <span className="visual-calendar-note mt-3 block break-words text-xs text-(--color-muted-foreground)">
                  {String(record?.reason ?? (teaching ? "Výuka" : "Volno"))}
                </span>
                {record && <span className="mt-1 block text-xs font-semibold">Výjimka</span>}
              </button>
            );
          })}
        </section>
        <p className="text-xs text-(--color-muted-foreground)">
          * Náhled podle opakování cyklu. Bez hvězdičky je typ týdne už uložený v kalendáři. Výjimka
          v jednom týdnu neposouvá další opakování.
        </p>
      </Panel>
      <section className="ui-stack">
        <h3 className="font-semibold">Podoby týdnů v tomto měsíci</h3>
        <div className="visual-ribbon">
          {Array.from({ length: 6 }, (_, i) => addDays(first, i * 7)).map((day) => {
            const row = weekDates.find((row) => row.week_starts_on === day);
            return (
              <div key={day} className="visual-phase">
                <p className="text-xs text-(--color-muted-foreground)">Od {dateLabel(day)}</p>
                <strong className="my-2 text-2xl">{code(weekId(day))}</strong>
                <p className="mb-3 text-xs text-(--color-muted-foreground)">
                  {row?.is_override ? "Ruční výjimka" : row ? "Uložený týden" : "Náhled cyklu"}
                </p>
                {!locked && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditing({ kind: "week", date: day })}
                  >
                    Změnit týden
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </section>
      {locked && (
        <p className="text-sm text-(--color-muted-foreground)">
          Plán je uzamčený. Kalendář je pouze ke čtení.
        </p>
      )}
      {generating && calendarAction && (
        <WorkflowDialog workflow={calendarAction} row={plan} onClose={() => setGenerating(false)} />
      )}
      {editing && (
        <ReferenceScopeProvider value={{ teaching_cycle_weeks: { teaching_plan_id: plan.id } }}>
          <RecordDialog
            key={`${editing.kind}:${editing.date}`}
            title={
              editing.kind === "day"
                ? `Výuka ${dateLabel(editing.date)}`
                : `Týden od ${dateLabel(editing.date)}`
            }
            editing={!!saved}
            initial={
              saved ??
              (editing.kind === "day"
                ? { is_teaching_day: false }
                : { cycle_week_id: weekId(editing.date), is_override: true })
            }
            fields={resource.fields.filter(
              (field) =>
                !["teaching_plan_id", "calendar_date", "week_starts_on", "is_override"].includes(
                  field.name,
                ),
            )}
            onClose={() => setEditing(null)}
            onSave={async (values) => {
              if (saved && resource.parsePatch)
                await request("PATCH", resourcePath(resource, saved), {
                  body: resource.parsePatch({
                    ...values,
                    ...(editing.kind === "week" ? { is_override: true } : {}),
                  }),
                });
              else
                await request("POST", resource.path, {
                  body: resource.parseCreate({
                    ...values,
                    ...(editing.kind === "week" ? { is_override: true } : {}),
                    teaching_plan_id: plan.id,
                    ...(editing.kind === "day"
                      ? { calendar_date: editing.date }
                      : { week_starts_on: editing.date }),
                  }),
                });
              await refresh();
              setEditing(null);
            }}
          />
        </ReferenceScopeProvider>
      )}
    </section>
  );
}
