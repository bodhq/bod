import type {
  ClassbookEntriesRead,
  Decision,
  MarkAttendanceBatch,
  ScheduleLesson,
} from "@bod/api-client/types.gen";
import type { Row } from "@/modules/shared/records/types";

import {
  createLessonApiV1ClassbookLessonsPost,
  decideApiV1ClassbookExcuseRequestsRequestIdItemsRecordIdDecidePost,
  deleteLessonApiV1ClassbookLessonsEntryIdDelete,
  excuseInboxApiV1ClassbookExcuseInboxGet,
  markBatchApiV1ClassbookLessonsEntryIdAttendancePut,
  myAttendanceApiV1ClassbookMyAttendanceGet,
  myChildrenApiV1ClassbookMyChildrenGet,
  myExcusesApiV1ClassbookMyExcuseRequestsGet,
  myLessonsApiV1ClassbookMyLessonsGet,
  patchClassbookEntriesApiV1ClassbookClassbookEntriesIdPatch,
  patchLessonApiV1ClassbookLessonsEntryIdPatch,
  readExcuseApiV1ClassbookExcuseRequestsRequestIdGet,
  readLessonApiV1ClassbookLessonsEntryIdGet,
  requestExcuseApiV1ClassbookExcuseRequestsPost,
  withdrawApiV1ClassbookExcuseRequestsRequestIdWithdrawPost,
} from "@bod/api-client/sdk.gen";
import { zClassbookEntriesCreate } from "@bod/api-client/zod.gen";

import { apiClient } from "@/core/api/client";
import { apiData, apiVoid } from "@/core/api/result";
import { collectPages } from "@/modules/shared/records/api";
import { materializeLesson } from "@/modules/timetable/api";

export async function getMyLessons(signal?: AbortSignal, period?: { from: string; to: string }) {
  return collectPages(
    async (offset, limit) =>
      apiData(
        await myLessonsApiV1ClassbookMyLessonsGet({
          client: apiClient,
          signal,
          query: {
            offset,
            limit,
            ...(period ? { date_from: period.from, date_to: period.to } : {}),
          },
        }),
      ),
    signal,
  );
}
export async function getMyAttendance(
  studentId?: string,
  signal?: AbortSignal,
  period?: { from: string; to: string },
) {
  return collectPages(
    async (offset, limit) =>
      apiData(
        await myAttendanceApiV1ClassbookMyAttendanceGet({
          client: apiClient,
          signal,
          query: {
            offset,
            limit,
            ...(studentId ? { student_id: studentId } : {}),
            ...(period ? { date_from: period.from, date_to: period.to } : {}),
          },
        }),
      ),
    signal,
  );
}
export async function getMyExcuses(signal?: AbortSignal) {
  return collectPages(
    async (offset, limit) =>
      apiData(
        await myExcusesApiV1ClassbookMyExcuseRequestsGet({
          client: apiClient,
          signal,
          query: { offset, limit },
        }),
      ),
    signal,
  );
}

export async function getChildren(signal?: AbortSignal) {
  return apiData(await myChildrenApiV1ClassbookMyChildrenGet({ client: apiClient, signal }));
}
export async function getLessonDetail(id: string, signal?: AbortSignal) {
  return apiData(
    await readLessonApiV1ClassbookLessonsEntryIdGet({
      client: apiClient,
      signal,
      path: { entry_id: id },
    }),
  );
}
export async function saveAttendance(id: string, records: MarkAttendanceBatch["records"]) {
  return apiData(
    await markBatchApiV1ClassbookLessonsEntryIdAttendancePut({
      client: apiClient,
      path: { entry_id: id },
      body: { records },
    }),
  );
}
export async function getExcuseInbox(signal?: AbortSignal) {
  return collectPages(
    async (offset, limit) =>
      apiData(
        await excuseInboxApiV1ClassbookExcuseInboxGet({
          client: apiClient,
          signal,
          query: { offset, limit },
        }),
      ),
    signal,
  );
}
export async function getExcuseDetail(id: string, signal?: AbortSignal) {
  return apiData(
    await readExcuseApiV1ClassbookExcuseRequestsRequestIdGet({
      client: apiClient,
      signal,
      path: { request_id: id },
    }),
  );
}
export async function decideExcuse(
  requestId: string,
  recordId: string,
  decision: Decision["decision"],
  note: string,
) {
  return apiData(
    await decideApiV1ClassbookExcuseRequestsRequestIdItemsRecordIdDecidePost({
      client: apiClient,
      path: { request_id: requestId, record_id: recordId },
      body: { decision, note: note.trim() || null },
    }),
  );
}
export async function createLesson(body: Row) {
  return apiData(
    await createLessonApiV1ClassbookLessonsPost({
      client: apiClient,
      body: zClassbookEntriesCreate.parse(body),
    }),
  );
}
export async function recordScheduledLesson(lesson: ScheduleLesson, topic: string, note: string) {
  const occurrence = await materializeLesson(lesson.timetable_entry_id, lesson.scheduled_date);
  return createLesson({
    lesson_occurrence_id: occurrence.id,
    group_id: lesson.group_id,
    subject_id: lesson.subject_id,
    actual_teacher_id: lesson.teacher_id,
    actual_room_id: lesson.room_id,
    starts_at: lesson.starts_at,
    ends_at: lesson.ends_at,
    topic: topic || null,
    note: note || null,
  });
}
export async function updateLesson(entry: ClassbookEntriesRead, body: Row, managed = false) {
  const patch = {
    topic: String(body.topic ?? "") || null,
    note: String(body.note ?? "") || null,
    expected_updated_at: entry.updated_at,
    correction_reason: String(body.correction_reason ?? "").trim() || null,
  };
  if (managed)
    return apiData(
      await patchClassbookEntriesApiV1ClassbookClassbookEntriesIdPatch({
        client: apiClient,
        path: { id: entry.id },
        body: patch,
      }),
    );
  return apiData(
    await patchLessonApiV1ClassbookLessonsEntryIdPatch({
      client: apiClient,
      path: { entry_id: entry.id },
      body: patch,
    }),
  );
}
export async function submitExcuse(studentId: string, reason: string, recordIds: string[]) {
  if (!reason.trim()) throw new Error("Vyplňte důvod omluvení.");
  if (!recordIds.length || recordIds.length > 100) throw new Error("Vyberte 1 až 100 absencí.");
  return apiData(
    await requestExcuseApiV1ClassbookExcuseRequestsPost({
      client: apiClient,
      body: {
        student_id: studentId,
        reason: reason.trim(),
        attendance_record_ids: [...new Set(recordIds)],
      },
    }),
  );
}
export async function withdrawExcuse(requestId: string) {
  return apiData(
    await withdrawApiV1ClassbookExcuseRequestsRequestIdWithdrawPost({
      client: apiClient,
      path: { request_id: requestId },
    }),
  );
}

export async function deleteEmptyLesson(id: string) {
  apiVoid(
    await deleteLessonApiV1ClassbookLessonsEntryIdDelete({
      client: apiClient,
      path: { entry_id: id },
    }),
  );
}
