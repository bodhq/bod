"use client";
import type { FieldDefinition } from "@/modules/shared/records/types";

import Link from "next/link";

import { Button } from "@/core/ui/actions/Button";
import { EmptyState } from "@/core/ui/feedback/EmptyState";
import { ErrorState } from "@/core/ui/feedback/ErrorState";
import { LoadingState } from "@/core/ui/feedback/LoadingState";
import { toast } from "@/core/ui/feedback/toast";
import { Input } from "@/core/ui/forms/Input";
import { recordScheduledLesson } from "@/modules/classbook/api";
import { ChildPicker } from "@/modules/classbook/components/ChildPicker";
import { RecordDialog } from "@/modules/shared/records/components/RecordDialog";
import { addDays, dateLabel, monday, shortId, today } from "@/modules/shared/records/format";

import { useScheduleWorkspace } from "../hooks/useScheduleWorkspace";
import { lessonTime, ScheduleBoard } from "./ScheduleBoard";

const noteFields: FieldDefinition[] = [
  { name: "topic", label: "Téma výuky", type: "string", required: true, nullable: false },
  { name: "note", label: "Poznámka", type: "string", required: false, nullable: true },
];
export function ScheduleWorkspace() {
  const {
    user,
    can,
    refresh,
    start,
    setStart,
    setStudent,
    student,
    parent,
    children,
    recording,
    setRecording,
    end,
    query,
    lessons,
  } = useScheduleWorkspace();
  if (!can("timetable.read"))
    return (
      <EmptyState title="K rozvrhu nemáte oprávnění">
        Správa návrhů je dostupná samostatně podle vaší provozní role.
      </EmptyState>
    );
  return (
    <div className="ui-stack">
      <div className="ui-panel ui-stack p-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">
              {dateLabel(start)} – {dateLabel(addDays(end, -1))}
            </h2>
            <p className="mt-1 text-sm text-(--color-muted-foreground)">
              Výuka včetně aktuálního suplování.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setStart(addDays(start, -7))}>
              Předchozí týden
            </Button>
            <Button variant="outline" size="sm" onClick={() => setStart(monday(today()))}>
              Dnes
            </Button>
            <Button variant="outline" size="sm" onClick={() => setStart(addDays(start, 7))}>
              Další týden
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <Input
            fieldWidth="short"
            label="Týden od"
            type="date"
            value={start}
            onChange={(event) => {
              if (event.target.value) setStart(monday(event.target.value));
            }}
          />
          {parent && <ChildPicker value={student} onChange={setStudent} query={children} all />}
        </div>
      </div>
      {query.isLoading ? (
        <LoadingState>Načítám rozvrh…</LoadingState>
      ) : query.isError ? (
        <ErrorState
          title="Rozvrh se nepodařilo načíst"
          error={query.error}
          action={
            <Button variant="outline" onClick={() => query.refetch()}>
              Zkusit znovu
            </Button>
          }
        />
      ) : !query.data?.length ? (
        <EmptyState title="V tomto týdnu nemáte naplánovanou výuku">
          Zkuste jiný týden. Publikovaná výuka se zde zobrazí automaticky.
        </EmptyState>
      ) : (
        <ScheduleBoard
          start={start}
          lessons={query.data}
          renderLesson={(lesson) => {
            const recorded = lessons.data?.some(
              (entry) =>
                (lesson.lesson_occurrence_id &&
                  entry.lesson_occurrence_id === lesson.lesson_occurrence_id) ||
                (entry.starts_at === lesson.starts_at &&
                  entry.group_id === lesson.group_id &&
                  entry.subject_id === lesson.subject_id &&
                  entry.actual_teacher_id === lesson.teacher_id),
            );
            return (
              <article className="ui-panel h-full p-3">
                <p className="text-xs tabular-nums text-(--color-muted-foreground) xl:hidden">
                  {lessonTime(lesson.starts_at)}–{lessonTime(lesson.ends_at)}
                </p>
                <h3 className="mt-1 break-words text-base font-semibold">{lesson.subject_name}</h3>
                <p className="mt-1 break-words text-xs text-(--color-muted-foreground)">
                  {lesson.group_name}
                </p>
                <p className="mt-2 break-words text-xs">
                  {lesson.room_id
                    ? (lesson.room_code ?? lesson.room_name ?? `Učebna ${shortId(lesson.room_id)}`)
                    : "Učebna neurčena"}
                </p>
                {lesson.teacher_id !== user?.id && (
                  <p className="mt-1 break-words text-xs text-(--color-muted-foreground)">
                    {lesson.teacher_name}
                  </p>
                )}
                {lesson.unresolved_reasons.length > 0 && (
                  <p className="mt-2 text-xs text-(--color-warning)">
                    Vyžaduje suplování:{" "}
                    {lesson.unresolved_reasons
                      .map((reason) =>
                        reason === "teacher_unavailable"
                          ? "nedostupný vyučující"
                          : "nedostupná učebna",
                      )
                      .join(", ")}
                    .
                  </p>
                )}
                {can("classbook.write") && lesson.teacher_id === user?.id && (
                  <div className="mt-3">
                    {recorded ? (
                      <Link
                        className="text-xs font-medium underline underline-offset-4"
                        href="/app/classbook"
                      >
                        Otevřít třídnici
                      </Link>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full px-1"
                        onClick={() => setRecording(lesson)}
                      >
                        Zapsat výuku
                      </Button>
                    )}
                  </div>
                )}
              </article>
            );
          }}
        />
      )}
      {recording && (
        <RecordDialog
          title="Zapsat výuku"
          description="Údaje o hodině se převezmou z platného rozvrhu. Zápis se uloží jako návrh."
          fields={noteFields}
          label="Vytvořit zápis"
          onClose={() => setRecording(null)}
          onSave={async (body) => {
            await recordScheduledLesson(
              recording,
              String(body.topic ?? ""),
              String(body.note ?? ""),
            );
            await refresh();
            setRecording(null);
            toast.success("Výuka byla zapsána. Podpis a docházku najdete ve třídnici.");
          }}
        />
      )}
    </div>
  );
}
