import type { ClassbookEntriesRead, ScheduleLesson } from "@bod/api-client/types.gen";

import { expect, it } from "vitest";

import { buildJournalDay } from "@/modules/classbook/journal";

const planned = {
  timetable_entry_id: "slot",
  scheduled_date: "2026-11-02",
  lesson_occurrence_id: null,
  starts_at: "2026-11-02T07:00:00Z",
  ends_at: "2026-11-02T07:45:00Z",
  subject_id: "math",
  group_id: "A",
  teacher_id: "teacher",
  room_id: null,
  timetable_version_id: "v",
  group_name: "A",
  subject_code: "MAT",
  subject_name: "Matematika",
  teacher_name: "Vyučující",
  room_code: null,
  room_name: null,
  change_type: null,
  original_teacher_id: "teacher",
  original_room_id: null,
  original_starts_at: "2026-11-02T07:00:00Z",
  original_ends_at: "2026-11-02T07:45:00Z",
  unresolved_reasons: [],
} satisfies ScheduleLesson;
const written = {
  id: "entry",
  starts_at: "2026-11-02T08:00:00+01:00",
  group_id: "A",
  subject_id: "math",
  actual_teacher_id: "teacher",
  lesson_occurrence_id: "occurrence",
  status: "signed",
} as ClassbookEntriesRead;

it("does not offer a second entry while the schedule occurrence ID is stale", () => {
  const result = buildJournalDay([written], [planned], "2026-11-02");
  expect(result.pages).toHaveLength(1);
  expect(result.pages[0]?.entry?.id).toBe("entry");
  expect(result.completed).toBe(1);
});
it("keeps simultaneous lessons of different groups separate", () => {
  expect(
    buildJournalDay([written], [{ ...planned, group_id: "B" }], "2026-11-02").pages,
  ).toHaveLength(2);
  const filtered = buildJournalDay([written], [{ ...planned, group_id: "B" }], "2026-11-02", "B");
  expect(filtered.pages).toHaveLength(1);
  expect(filtered.pages[0]?.lesson?.group_id).toBe("B");
  expect(filtered.completed).toBe(0);
});
it("assigns midnight lessons to the school day in Prague and orders instants", () => {
  const midnight = { ...planned, starts_at: "2026-11-01T23:30:00Z", timetable_entry_id: "night" };
  const result = buildJournalDay([], [planned, midnight], "2026-11-02");
  expect(result.pages.map((page) => page.lesson?.timetable_entry_id)).toEqual(["night", "slot"]);
  expect(buildJournalDay([], [midnight], "2026-11-01").pages).toHaveLength(0);
});

it("keeps the same lesson selected when its scheduled hour becomes a saved entry", async () => {
  const { chooseJournalPage, journalIdentity } = await import("@/modules/classbook/journal");
  const pending = buildJournalDay([], [planned], "2026-11-02").pages[0];
  if (!pending) throw new Error("missing fixture");
  const saved = buildJournalDay([written], [], "2026-11-02").pages;
  expect(chooseJournalPage(saved, journalIdentity(pending))?.entry?.id).toBe("entry");
});

it("suggests unfinished work rather than claiming all entries are done during a signed lesson", async () => {
  const { chooseJournalPage } = await import("@/modules/classbook/journal");
  const current = { ...written, ends_at: "2026-11-02T08:45:00+01:00" };
  const later = { ...planned, timetable_entry_id: "later", starts_at: "2026-11-02T09:00:00Z" };
  const pages = buildJournalDay([current], [later], "2026-11-02").pages;
  expect(
    chooseJournalPage(pages, "", Date.parse("2026-11-02T07:15:00Z"))?.lesson?.timetable_entry_id,
  ).toBe("later");
});
