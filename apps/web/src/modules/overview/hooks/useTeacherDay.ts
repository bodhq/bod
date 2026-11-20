"use client";
import { useQuery } from "@tanstack/react-query";

import { addDays, today } from "@/core/time/school";
import { buildJournalDay, chooseJournalPage } from "@/modules/classbook/journal";
import { classbookQueries } from "@/modules/classbook/queries";
import { useReferenceNames } from "@/modules/shared/records/hooks";
import { scheduleNames } from "@/modules/timetable/names";
import { timetableQueries } from "@/modules/timetable/queries";

export function useTeacherDay() {
  const day = today();
  const schedule = useQuery(timetableQueries.week(day, addDays(day, 1)));
  const lessons = useQuery(classbookQueries.lessons());
  const references = useReferenceNames(["subjects", "teaching_groups", "rooms"]);
  const names = scheduleNames(schedule.data ?? [], references);
  const { pages, completed } = buildJournalDay(lessons.data ?? [], schedule.data ?? [], day);
  const next = chooseJournalPage(pages);
  const time = (instant: string) =>
    new Date(instant).toLocaleTimeString("cs-CZ", {
      timeZone: "Europe/Prague",
      hour: "2-digit",
      minute: "2-digit",
    });
  return { day, schedule, lessons, names, pages, completed, next, time };
}
