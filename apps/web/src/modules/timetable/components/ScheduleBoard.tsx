"use client";

import type { ScheduleLesson } from "@bod/api-client/types.gen";
import type { ReactNode } from "react";

import { useState } from "react";

import { Button } from "@/core/ui/actions/Button";
import { addDays, today } from "@/modules/shared/records/format";

const localDay = (value: string) =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Prague" }).format(new Date(value));
export const lessonTime = (value: string) =>
  new Date(value).toLocaleTimeString("cs-CZ", {
    timeZone: "Europe/Prague",
    hour: "2-digit",
    minute: "2-digit",
  });

export function ScheduleBoard({
  start,
  lessons,
  renderLesson,
}: {
  start: string;
  lessons: ScheduleLesson[];
  renderLesson: (lesson: ScheduleLesson) => ReactNode;
}) {
  const days = Array.from(
    {
      length: lessons.some((lesson) =>
        [addDays(start, 5), addDays(start, 6)].includes(localDay(lesson.starts_at)),
      )
        ? 7
        : 5,
    },
    (_, index) => addDays(start, index),
  );
  const [chosen, setChosen] = useState(today());
  const selected = days.includes(chosen) ? chosen : days[0];
  const times = [...new Set(lessons.map((lesson) => lessonTime(lesson.starts_at)))].sort((a, b) =>
    a.localeCompare(b),
  );
  const dayTitle = (day: string) =>
    new Date(`${day}T12:00:00Z`).toLocaleDateString("cs-CZ", {
      timeZone: "Europe/Prague",
      weekday: "short",
      day: "numeric",
      month: "numeric",
    });
  const render = (lesson: ScheduleLesson) => (
    <div key={`${lesson.timetable_entry_id}:${lesson.scheduled_date}`}>{renderLesson(lesson)}</div>
  );
  return (
    <>
      <div className="xl:hidden space-y-4">
        <nav aria-label="Dny rozvrhu" className="flex gap-1 overflow-x-auto pb-1">
          {days.map((day) => (
            <Button
              key={day}
              variant="choice"
              size="sm"
              aria-pressed={day === selected}
              onClick={() => setChosen(day)}
              className="shrink-0 capitalize"
            >
              {dayTitle(day)}
            </Button>
          ))}
        </nav>
        {lessons
          .filter((lesson) => localDay(lesson.starts_at) === selected)
          .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
          .map(render)}
        {!lessons.some((lesson) => localDay(lesson.starts_at) === selected) && (
          <p className="py-8 text-center text-sm text-(--color-muted-foreground)">
            Dnes je v rozvrhu volno.
          </p>
        )}
      </div>
      <div className="ui-panel hidden overflow-x-auto xl:block">
        <table
          aria-label="Týdenní rozvrh"
          className="w-full min-w-[720px] table-fixed border-collapse text-left"
        >
          <thead>
            <tr>
              <th scope="col" className="w-16 p-3 text-xs text-(--color-muted-foreground)">
                Čas
              </th>
              {days.map((day) => (
                <th
                  key={day}
                  scope="col"
                  className={`p-3 text-center text-sm font-semibold capitalize ${day === today() ? "bg-(--color-primary)/10 text-(--color-primary-accessible)" : ""}`}
                >
                  {dayTitle(day)}
                  {day === today() && <span className="mt-1 block text-xs font-normal">Dnes</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {times.map((time) => (
              <tr key={time} className="border-t border-(--color-border)">
                <th
                  scope="row"
                  className="px-2 py-4 align-top text-center text-xs font-medium tabular-nums text-(--color-muted-foreground)"
                >
                  {time}
                </th>
                {days.map((day) => {
                  const cell = lessons.filter(
                    (lesson) =>
                      localDay(lesson.starts_at) === day && lessonTime(lesson.starts_at) === time,
                  );
                  return (
                    <td
                      key={day}
                      className={`space-y-2 p-2 align-top ${day === today() ? "bg-(--color-primary)/5" : ""}`}
                    >
                      {cell.map(render)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
