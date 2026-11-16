import {
  materializeApiV1TimetableMaterializePost,
  overviewApiV1TimetableTimetableVersionsVersionIdOverviewGet,
  publicationCheckApiV1TimetableTimetableVersionsVersionIdPublicationCheckGet,
  scheduleApiV1TimetableScheduleGet,
} from "@bod/api-client/sdk.gen";

import { apiClient } from "@/core/api/client";
import { apiData } from "@/core/api/result";

export async function getSchedule(
  from: string,
  to: string,
  studentId?: string,
  signal?: AbortSignal,
) {
  return apiData(
    await scheduleApiV1TimetableScheduleGet({
      client: apiClient,
      signal,
      query: { date_from: from, date_to: to, ...(studentId ? { student_id: studentId } : {}) },
    }),
  );
}

export async function checkPublication(versionId: string, signal?: AbortSignal) {
  return apiData(
    await publicationCheckApiV1TimetableTimetableVersionsVersionIdPublicationCheckGet({
      client: apiClient,
      signal,
      path: { version_id: versionId },
    }),
  );
}
export async function getVersionOverview(versionId: string, signal?: AbortSignal) {
  return apiData(
    await overviewApiV1TimetableTimetableVersionsVersionIdOverviewGet({
      client: apiClient,
      signal,
      path: { version_id: versionId },
    }),
  );
}
export async function materializeLesson(entryId: string, day: string) {
  return apiData(
    await materializeApiV1TimetableMaterializePost({
      client: apiClient,
      body: { timetable_entry_id: entryId, scheduled_date: day },
    }),
  );
}
