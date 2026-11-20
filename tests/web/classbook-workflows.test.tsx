import type { ClassbookEntriesRead, ScheduleLesson } from "@bod/api-client/types.gen";
import type { ReactNode } from "react";
import type { User } from "@/core/auth/api";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { apiClient } from "@/core/api/client";
import { useAuthStore } from "@/core/auth/store";
import { getResource, resources, workflows } from "@/modules/catalog";
import {
  getMyAttendance,
  getMyExcuses,
  getMyLessons,
  recordScheduledLesson,
  updateLesson,
} from "@/modules/classbook/api";
import { ExcuseInbox } from "@/modules/classbook/components/ExcuseInbox";
import { LessonPage } from "@/modules/classbook/components/LessonPage";
import { OwnAttendance } from "@/modules/classbook/components/OwnAttendance";
import { patchRow } from "@/modules/shared/records/api";
import { RecordCatalogProvider } from "@/modules/shared/records/catalog";

vi.mock("@/core/ui/overlays/ConfirmProvider", () => ({ useConfirm: () => vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/core/ui/feedback/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
        })
      }
    >
      <RecordCatalogProvider catalog={{ resources, workflows }}>{children}</RecordCatalogProvider>
    </QueryClientProvider>
  );
}
beforeEach(() => {
  apiClient.setConfig({ baseUrl: "http://api:8000" });
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});
afterEach(() => {
  cleanup();
  apiClient.setConfig({ baseUrl: "" });
  useAuthStore.setState({ user: null });
  vi.unstubAllGlobals();
});

it.each([
  getMyLessons,
  getMyExcuses,
  () => getMyAttendance("student"),
])("keeps personal records beyond the first API page", async (load) => {
  const offsets: number[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: Request) => {
      const url = new URL(input.url);
      const offset = Number(url.searchParams.get("offset"));
      offsets.push(offset);
      return Response.json(
        Array.from({ length: offset === 0 ? 50 : 2 }, (_, index) => ({
          id: `record-${offset + index}`,
        })),
      );
    }),
  );
  const rows = await load();
  expect(rows).toHaveLength(52);
  expect(rows.at(-1)?.id).toBe("record-51");
  expect(offsets).toEqual([0, 50]);
});

it("loads a parent's linked child and selects children by name", async () => {
  useAuthStore.setState({
    user: {
      id: "parent",
      active_role: "parent",
      permissions: ["classbook.read", "attendance.request"],
    } as User,
  });
  const students: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: Request) => {
      const url = new URL(input.url);
      if (url.pathname.endsWith("/my-children"))
        return Response.json([
          { student_id: "anna", name: "Anna Nováková" },
          { student_id: "jan", name: "Jan Novák" },
        ]);
      students.push(url.searchParams.get("student_id") ?? "");
      return Response.json([]);
    }),
  );
  render(<OwnAttendance />, { wrapper });
  const picker = await screen.findByRole("combobox", { name: "Dítě" });
  await waitFor(() => expect(students).toContain("anna"));
  fireEvent.change(picker, { target: { value: "jan" } });
  await waitFor(() => expect(students).toContain("jan"));
  expect(screen.queryByLabelText(/Identifikátor/)).toBeNull();
});

it("saves attendance for the lesson roster without entering student identifiers", async () => {
  useAuthStore.setState({
    user: {
      id: "teacher",
      permissions: ["classbook.read", "classbook.write", "attendance.mark"],
    } as User,
  });
  const entry = {
    id: "lesson",
    actual_teacher_id: "teacher",
    subject_id: "math",
    group_id: "group",
    topic: "Rovnice",
    note: null,
    status: "draft",
    updated_at: "2026-11-17T07:00:00Z",
    starts_at: "2026-11-17T07:00:00Z",
    ends_at: "2026-11-17T07:45:00Z",
  } as ClassbookEntriesRead;
  let body: unknown;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: Request) => {
      if (input.method === "PUT") {
        body = await input.json();
        return Response.json([]);
      }
      if (input.method === "PATCH") return Response.json(entry);
      return Response.json({
        lesson: entry,
        participants: [{ student_id: "anna", name: "Anna Nováková", attendance: null }],
      });
    }),
  );
  render(<LessonPage entry={entry} names={{}} onDirtyChange={vi.fn()} />, { wrapper });
  fireEvent.click(await screen.findByRole("radio", { name: "Chybí: Anna Nováková" }));
  expect(screen.queryByLabelText("Interní poznámka: Anna Nováková")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Uložit zápis" }));
  await waitFor(() => expect(body).toBeDefined());
  expect(body).toEqual({
    records: [
      {
        student_id: "anna",
        status: "absent",
        late_minutes: null,
        missed_minutes: null,
        note: null,
      },
    ],
  });
});

it.each([
  false,
  true,
])("saves the lesson and attendance before signing, preserving a failed attendance edit (%s)", async (failFirst) => {
  useAuthStore.setState({
    user: {
      id: "teacher",
      permissions: ["classbook.read", "classbook.write", "attendance.mark"],
    } as User,
  });
  let entry = {
    id: "lesson",
    actual_teacher_id: "teacher",
    subject_id: "math",
    group_id: "group",
    topic: "Rovnice",
    note: null,
    status: "draft",
    updated_at: "2026-11-17T07:00:00Z",
    starts_at: "2026-11-17T07:00:00Z",
    ends_at: "2026-11-17T07:45:00Z",
  } as ClassbookEntriesRead;
  const calls: string[] = [];
  const revisions: string[] = [];
  let fail = failFirst;
  let stored: unknown[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: Request) => {
      if (input.method === "PATCH") {
        const patch = await input.json();
        revisions.push(patch.expected_updated_at);
        entry = { ...entry, topic: patch.topic, updated_at: "2026-11-17T08:00:00Z" };
        calls.push("lesson");
        return Response.json(entry);
      }
      if (input.method === "PUT") {
        calls.push("attendance");
        if (fail) {
          fail = false;
          return Response.json(
            { error: { code: "VALIDATION_ERROR", message: "Docházku se nepodařilo uložit." } },
            { status: 422 },
          );
        }
        stored = (await input.json()).records;
        return Response.json(stored);
      }
      if (input.method === "POST") {
        calls.push("sign");
        entry = { ...entry, status: "signed" };
        return Response.json(entry);
      }
      return Response.json({
        lesson: entry,
        participants: [{ student_id: "anna", name: "Anna Nováková", attendance: null }],
      });
    }),
  );
  render(<LessonPage entry={entry} names={{}} onDirtyChange={vi.fn()} />, { wrapper });
  fireEvent.click(await screen.findByRole("radio", { name: "Pozdě: Anna Nováková" }));
  fireEvent.change(screen.getByLabelText("Zpoždění: Anna Nováková"), { target: { value: "7" } });
  fireEvent.click(screen.getByRole("button", { name: "Podrobnosti: Anna Nováková" }));
  fireEvent.change(screen.getByLabelText("Interní poznámka: Anna Nováková"), {
    target: { value: "Příjezd autobusem" },
  });
  fireEvent.change(screen.getByLabelText("Probraná látka"), {
    target: { value: "Rovnice se závorkami" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Uložit a podepsat" }));
  if (failFirst) {
    await screen.findByText("Docházku se nepodařilo uložit.");
    expect(calls).toEqual(["lesson", "attendance"]);
    expect(screen.getByLabelText("Zpoždění: Anna Nováková")).toHaveValue(7);
    fireEvent.click(screen.getByRole("button", { name: "Uložit a podepsat" }));
  }
  await waitFor(() => expect(calls.at(-1)).toBe("sign"));
  expect(calls).toEqual(
    failFirst
      ? ["lesson", "attendance", "lesson", "attendance", "sign"]
      : ["lesson", "attendance", "sign"],
  );
  expect(stored).toEqual([
    {
      student_id: "anna",
      status: "late",
      late_minutes: 7,
      missed_minutes: null,
      note: "Příjezd autobusem",
    },
  ]);
  expect(entry.topic).toBe("Rovnice se závorkami");
  if (failFirst) expect(revisions[1]).toBe("2026-11-17T08:00:00Z");
});

it("opens an excuse from the teacher inbox and decides the selected absence", async () => {
  let body: unknown;
  let decisionPath = "";
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: Request) => {
      const url = new URL(input.url);
      if (input.method === "POST") {
        decisionPath = url.pathname;
        body = await input.json();
        return Response.json({});
      }
      if (url.pathname.endsWith("/excuse-inbox")) return Response.json([{ id: "request" }]);
      return Response.json({
        id: "request",
        student_name: "Anna Nováková",
        created_at: "2026-11-15T08:00:00Z",
        status: "open",
        reason: "Návštěva lékaře",
        items: [
          {
            item: { attendance_record_id: "absence", decision: "pending" },
            attendance: { status: "absent" },
            starts_at: "2026-11-14T08:00:00Z",
            subject_name: "Matematika",
            can_decide: true,
          },
        ],
      });
    }),
  );
  render(<ExcuseInbox />, { wrapper });
  fireEvent.click(await screen.findByRole("button", { name: "Omluvit", exact: true }));
  await waitFor(() => expect(body).toEqual({ decision: "approved", note: null }));
  expect(decisionPath).toBe("/api/v1/classbook/excuse-requests/request/items/absence/decide");
});

it("sends the loaded journal revision and correction reason when correcting a signed entry", async () => {
  let body: unknown;
  let path = "";
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: Request) => {
      body = await input.json();
      path = new URL(input.url).pathname;
      return Response.json({ id: "lesson" });
    }),
  );
  const entry = {
    id: "lesson",
    updated_at: "2026-11-15T08:00:00Z",
    status: "signed",
  } as ClassbookEntriesRead;
  await updateLesson(
    entry,
    { topic: "Opravená látka", correction_reason: "Doplnění po kontrole" },
    true,
  );
  expect(path).toBe("/api/v1/classbook/classbook-entries/lesson");
  expect(body).toMatchObject({
    expected_updated_at: entry.updated_at,
    correction_reason: "Doplnění po kontrole",
    topic: "Opravená látka",
  });
});

it("keeps the original timetable state when moving a loaded entry", async () => {
  let body: unknown;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: Request) => {
      body = await input.json();
      return Response.json({});
    }),
  );
  const id = "b2dd5555-9997-4a7e-b25e-99200adb6db3";
  const previous = {
    id,
    timetable_version_id: id,
    teaching_assignment_id: id,
    cycle_week_id: id,
    day_of_week: 1,
    time_slot_id: id,
    room_id: null,
    is_locked: false,
  };
  await patchRow(getResource("timetable_entries"), previous, { day_of_week: 2 });
  expect(body).toMatchObject({ day_of_week: 2, expected_state: previous });
});

it("records a scheduled lesson using the timezone offsets returned by the API", async () => {
  const id = "b2dd5555-9997-4a7e-b25e-99200adb6db3";
  const bodies: unknown[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: Request) => {
      bodies.push(await input.json());
      return Response.json({ id });
    }),
  );
  const lesson = {
    timetable_entry_id: id,
    scheduled_date: "2026-09-01",
    group_id: id,
    subject_id: id,
    teacher_id: id,
    room_id: null,
    starts_at: "2026-09-01T08:00:00+02:00",
    ends_at: "2026-09-01T08:45:00+02:00",
  } as ScheduleLesson;
  await recordScheduledLesson(lesson, "Rovnice", "");
  expect(bodies).toHaveLength(2);
  expect(bodies[1]).toMatchObject({
    starts_at: lesson.starts_at,
    ends_at: lesson.ends_at,
    lesson_occurrence_id: id,
    topic: "Rovnice",
  });
  await patchRow(
    getResource("classbook_entries"),
    { id, updated_at: lesson.starts_at },
    { topic: "Doplnění" },
  );
  expect(bodies[2]).toMatchObject({ expected_updated_at: lesson.starts_at });
});
