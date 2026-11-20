"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { useAuthUser } from "@/core/auth/store";
import { addDays, dateLabel, today } from "@/core/time/school";
import { Button } from "@/core/ui/actions/Button";
import { EmptyState } from "@/core/ui/feedback/EmptyState";
import { ErrorState } from "@/core/ui/feedback/ErrorState";
import { LoadingState } from "@/core/ui/feedback/LoadingState";
import { Select } from "@/core/ui/forms/Select";
import { getMyExcuses } from "@/modules/classbook/api";
import { useChildren } from "@/modules/classbook/hooks/useChildren";
import { workspaceKey } from "@/modules/shared/records/api";
import { getSchedule } from "@/modules/timetable/api";

export function PersonalDay() {
  const user = useAuthUser();
  const { parent, children } = useChildren();
  const [selected, setSelected] = useState("");
  const student = parent
    ? (children.data?.find((child) => child.student_id === selected)?.student_id ??
      children.data?.[0]?.student_id ??
      "")
    : (user?.id ?? "");
  const day = today();
  const canSchedule = !!user?.permissions?.includes("timetable.read");
  const canRead = !!user?.permissions?.includes("classbook.read");
  const canRequest = !!user?.permissions?.includes("attendance.request");
  const schedule = useQuery({
    queryKey: [...workspaceKey, "personal-day", student, day],
    queryFn: ({ signal }) => getSchedule(day, addDays(day, 1), student, signal),
    enabled: !!student && canSchedule,
  });
  const requests = useQuery({
    queryKey: [...workspaceKey, "my-excuses"],
    queryFn: ({ signal }) => getMyExcuses(signal),
    enabled: canRequest,
  });
  if (parent && children.isPending) return <LoadingState>Načítám děti…</LoadingState>;
  if (parent && children.isError)
    return (
      <ErrorState
        title="Děti se nepodařilo načíst"
        error={children.error}
        action={
          <Button variant="outline" onClick={() => children.refetch()}>
            Zkusit znovu
          </Button>
        }
      />
    );
  if (!student)
    return (
      <EmptyState
        title="K účtu není připojené žádné dítě"
        description="Propojení může nastavit správce školy."
      />
    );
  const query = `student=${encodeURIComponent(student)}`;
  const pending =
    requests.data?.filter((request) => request.student_id === student && request.status === "open")
      .length ?? 0;
  return (
    <section className="ui-stack" aria-label={parent ? "Přehled dítěte" : "Můj přehled"}>
      {parent && (
        <Select label="Dítě" value={student} onChange={(event) => setSelected(event.target.value)}>
          {children.data?.map((child) => (
            <option key={child.student_id} value={child.student_id}>
              {child.name}
            </option>
          ))}
        </Select>
      )}
      <div className="personal-shortcuts">
        {canRead && (
          <Link className="workspace-link" href={`/app/classbook?view=attendance&${query}`}>
            <strong>Docházka a omlouvání</strong>
            <span aria-hidden="true">→</span>
          </Link>
        )}
        {canRequest && (
          <Link className="workspace-link" href={`/app/classbook?view=excuses&${query}`}>
            <div>
              <strong>Moje omluvenky</strong>
              {requests.isPending ? (
                <span>Načítám stav…</span>
              ) : requests.isError ? (
                <span>Stav se nepodařilo načíst</span>
              ) : (
                <span>Vaše čekající podání: {pending}</span>
              )}
            </div>
            <span aria-hidden="true">→</span>
          </Link>
        )}
      </div>
      {canSchedule && (
        <div className="ui-stack">
          <h2 className="text-lg font-semibold">Dnešní výuka · {dateLabel(day)}</h2>
          {schedule.isPending ? (
            <LoadingState>Načítám dnešní rozvrh…</LoadingState>
          ) : schedule.isError ? (
            <ErrorState
              error={schedule.error}
              action={
                <Button variant="outline" onClick={() => schedule.refetch()}>
                  Zkusit znovu
                </Button>
              }
            />
          ) : !schedule.data?.length ? (
            <p>Na dnešek není naplánovaná výuka.</p>
          ) : (
            <ul className="record-list">
              {schedule.data.map((lesson) => (
                <li
                  key={`${lesson.timetable_entry_id}:${lesson.starts_at}`}
                  className="record-list-item"
                >
                  <div>
                    <strong>{lesson.subject_name}</strong>
                    <p className="text-sm text-(--color-muted-foreground)">
                      {new Date(lesson.starts_at).toLocaleTimeString("cs-CZ", {
                        timeZone: "Europe/Prague",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      –
                      {new Date(lesson.ends_at).toLocaleTimeString("cs-CZ", {
                        timeZone: "Europe/Prague",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      · {lesson.room_code ?? lesson.room_name ?? "Učebna neuvedena"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Link
            href={`/app/timetable?student=${encodeURIComponent(student)}`}
            className="min-h-11 inline-flex items-center font-semibold text-(--color-primary-accessible)"
          >
            Celý rozvrh →
          </Link>
        </div>
      )}
    </section>
  );
}
