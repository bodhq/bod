import type { ClassbookEntriesRead, ScheduleLesson } from "@bod/api-client/types.gen";

export interface JournalPage {
  key: string;
  starts: string;
  entry?: ClassbookEntriesRead;
  lesson?: ScheduleLesson;
}

// A materialized lesson and its journal entry are one hour, including when the
// schedule response has not yet acquired its occurrence ID after a mutation.
export function buildJournalDay(
  entries: ClassbookEntriesRead[],
  planned: ScheduleLesson[],
  day: string,
  group = "",
) {
  const matches = (item: { starts_at: string; group_id: string }) =>
    new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Prague" }).format(
      new Date(item.starts_at),
    ) === day &&
    (!group || item.group_id === group);
  const written = entries.filter(matches);
  const pending = planned
    .filter(matches)
    .filter(
      (lesson) =>
        !written.some(
          (entry) =>
            (lesson.lesson_occurrence_id &&
              entry.lesson_occurrence_id === lesson.lesson_occurrence_id) ||
            (Date.parse(entry.starts_at) === Date.parse(lesson.starts_at) &&
              entry.group_id === lesson.group_id &&
              entry.subject_id === lesson.subject_id &&
              entry.actual_teacher_id === lesson.teacher_id),
        ),
    );
  const pages: JournalPage[] = [
    ...written.map((entry) => ({ key: entry.id, starts: entry.starts_at, entry })),
    ...pending.map((lesson) => ({
      key: `${lesson.timetable_entry_id}:${lesson.scheduled_date}`,
      starts: lesson.starts_at,
      lesson,
    })),
  ].sort((a, b) => Date.parse(a.starts) - Date.parse(b.starts));
  return { pages, completed: written.filter((entry) => entry.status === "signed").length };
}

export function journalIdentity(page: JournalPage) {
  return [
    Date.parse(page.starts),
    page.entry?.group_id ?? page.lesson?.group_id,
    page.entry?.subject_id ?? page.lesson?.subject_id,
    page.entry?.actual_teacher_id ?? page.lesson?.teacher_id,
  ].join(":");
}
export function chooseJournalPage(pages: JournalPage[], selected = "", now = Date.now()) {
  const explicit = pages.find((page) =>
    [journalIdentity(page), page.key, page.entry?.id, page.lesson?.timetable_entry_id].includes(
      selected,
    ),
  );
  return (
    explicit ??
    pages.find((page) => {
      const end = page.entry?.ends_at ?? page.lesson?.ends_at;
      return (
        page.entry?.status !== "signed" &&
        Date.parse(page.starts) <= now &&
        !!end &&
        Date.parse(end) > now
      );
    }) ??
    pages.find((page) => page.entry?.status !== "signed") ??
    pages[0]
  );
}
export function journalHref(page: JournalPage, day: string) {
  return `/app/classbook?den=${encodeURIComponent(day)}&hodina=${encodeURIComponent(page.entry?.id ?? page.lesson?.timetable_entry_id ?? page.key)}`;
}
