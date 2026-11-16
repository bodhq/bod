import type { ScheduleLesson } from "@bod/api-client/types.gen";

/** The authorized schedule already names its people and catalogs. */
export function scheduleNames(
  lessons: ScheduleLesson[],
  references: Record<string, Record<string, string>> = {},
) {
  return {
    ...references,
    subjects: {
      ...references.subjects,
      ...Object.fromEntries(lessons.map((lesson) => [lesson.subject_id, lesson.subject_name])),
    },
    teaching_groups: {
      ...references.teaching_groups,
      ...Object.fromEntries(lessons.map((lesson) => [lesson.group_id, lesson.group_name])),
    },
    rooms: {
      ...references.rooms,
      ...Object.fromEntries(
        lessons.flatMap((lesson) =>
          lesson.room_id
            ? [[lesson.room_id, lesson.room_code ?? lesson.room_name ?? "Učebna"]]
            : [],
        ),
      ),
    },
    users: {
      ...references.users,
      ...Object.fromEntries(lessons.map((lesson) => [lesson.teacher_id, lesson.teacher_name])),
    },
  };
}
