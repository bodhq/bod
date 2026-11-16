import type { VersionOverview } from "@bod/api-client/types.gen";
import type { ReactNode } from "react";
import type { User } from "@/core/auth/api";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { apiClient } from "@/core/api/client";
import { useAuthStore } from "@/core/auth/store";
import { schoolInstant, today } from "@/core/time/school";
import { resources, workflows } from "@/modules/catalog";
import { TeacherDay } from "@/modules/overview/components/TeacherDay";
import { RecordCatalogProvider } from "@/modules/shared/records/catalog";
import { TimetableEditor } from "@/modules/timetable/components/TimetableEditor";
import { useTeachingPlanData } from "@/modules/timetable/hooks/useTeachingPlanData";

vi.mock("@/core/ui/overlays/ConfirmProvider", () => ({ useConfirm: () => vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const version = {
  id: id(1),
  teaching_plan_id: id(2),
  time_grid_id: id(3),
  name: "Pracovní varianta",
  status: "draft",
  valid_from: "2026-09-01",
  valid_to: "2027-09-01",
};
const entry = {
  id: id(4),
  timetable_version_id: version.id,
  teaching_assignment_id: id(5),
  cycle_week_id: id(6),
  day_of_week: 1,
  time_slot_id: id(7),
  room_id: id(8),
  is_locked: false,
};
function overview(editable = true): VersionOverview {
  return {
    version: { ...version, status: editable ? "draft" : "published" },
    plan: { id: version.teaching_plan_id, name: "Plán", frozen_at: null },
    editable,
    plan_editable: true,
    assignments: [
      {
        teaching_assignment_id: id(5),
        group_id: id(9),
        group_name: "1.A",
        subject_id: id(10),
        subject_code: "MAT",
        subject_name: "Matematika",
        teacher_id: id(11),
        teacher_name: "Jan Novák",
        required_room_type_code: null,
      },
    ],
    cycle_weeks: [
      {
        id: id(6),
        teaching_plan_id: version.teaching_plan_id,
        position: 1,
        code: "A",
        name: "První týden",
      },
    ],
    time_slots: [
      { id: id(7), time_grid_id: id(3), position: 1, start_time: "08:00:00", end_time: "08:45:00" },
    ],
    entries: [{ ...entry, room_code: "101", room_name: "Učebna matematiky" }],
    workloads: [
      {
        teaching_assignment_id: id(5),
        cycle_week_id: id(6),
        required_periods: 2,
        scheduled_periods: 3,
        remaining_periods: -1,
      },
    ],
  } as VersionOverview;
}
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
  useAuthStore.setState({
    user: { id: id(11), active_role: "scheduler", permissions: ["timetable.edit"] } as User,
  });
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  apiClient.setConfig({ baseUrl: "" });
  useAuthStore.setState({ user: null });
});

it("names today's subjects and groups for a teacher without school or account management", async () => {
  useAuthStore.setState({
    user: {
      id: id(11),
      active_role: "teacher",
      permissions: ["timetable.read", "classbook.read", "classbook.write"],
    } as User,
  });
  const paths: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (request: Request) => {
      const path = new URL(request.url).pathname;
      paths.push(path);
      if (path.endsWith("/my-lessons")) return Response.json([]);
      if (path.endsWith("/schedule"))
        return Response.json([
          {
            timetable_entry_id: entry.id,
            scheduled_date: today(),
            group_id: id(9),
            group_name: "1.A",
            subject_id: id(10),
            subject_name: "Matematika",
            teacher_id: id(11),
            teacher_name: "Jan Novák",
            room_id: null,
            starts_at: schoolInstant(`${today()}T08:00`),
            ends_at: schoolInstant(`${today()}T08:45`),
          },
        ]);
      throw new Error(`Unexpected directory request: ${path}`);
    }),
  );
  render(<TeacherDay />, { wrapper });
  expect(await screen.findByText("Matematika · 1.A")).toBeVisible();
  expect(screen.queryByText("Výuka podle rozvrhu")).not.toBeInTheDocument();
  expect(paths.sort()).toEqual(["/api/v1/classbook/my-lessons", "/api/v1/timetable/schedule"]);
});

it("loads one variant with named teachers and authoritative workload counts using only timetable.edit", async () => {
  const paths: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (request: Request) => {
      const path = new URL(request.url).pathname;
      paths.push(path);
      if (path.endsWith("/overview")) return Response.json(overview());
      if (path.endsWith("/publication-check"))
        return Response.json({ can_publish: false, issues: [] });
      throw new Error(`Unexpected global collection request: ${path}`);
    }),
  );
  render(<TimetableEditor planId={version.teaching_plan_id} version={version} />, { wrapper });
  expect(await screen.findByRole("table", { name: "Editor týdenního rozvrhu" })).toBeVisible();
  expect(
    within(screen.getByRole("combobox", { name: "Zobrazit učitele" })).getByRole("option", {
      name: "Jan Novák",
    }),
  ).toBeVisible();
  expect(screen.getByText("3 / 2")).toBeVisible();
  expect(screen.getByText(/zbývá podle úvazků · 1 navíc/)).toBeVisible();
  await waitFor(() => expect(paths).toHaveLength(2));
  expect(paths).toContain(`/api/v1/timetable/timetable-versions/${version.id}/overview`);
});

it("keeps read-model room labels out of the expected state when editing an existing entry", async () => {
  const data = overview();
  let body: Record<string, unknown> | undefined;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (request: Request) => {
      const path = new URL(request.url).pathname;
      if (path.endsWith("/overview")) return Response.json(data);
      if (path.endsWith("/publication-check"))
        return Response.json({ can_publish: false, issues: [] });
      if (request.method === "PATCH" && path.endsWith(`/timetable-entries/${entry.id}`)) {
        body = await request.json();
        const state = body?.expected_state as Record<string, unknown>;
        if (Object.keys(state).some((key) => !Object.hasOwn(entry, key)))
          return Response.json(
            { error: { message: "Unexpected snapshot field" } },
            { status: 422 },
          );
        data.entries[0] = {
          ...data.entries[0],
          is_locked: true,
        } as VersionOverview["entries"][number];
        return Response.json({ ...entry, is_locked: true });
      }
      throw new Error(`Unexpected request: ${request.method} ${path}`);
    }),
  );
  render(<TimetableEditor planId={version.teaching_plan_id} version={version} />, { wrapper });
  const table = await screen.findByRole("table", { name: "Editor týdenního rozvrhu" });
  const lesson = within(table).getByRole("button", { name: /Matematika/ });
  expect(lesson).toHaveTextContent("101");
  fireEvent.click(lesson);
  fireEvent.click(screen.getByRole("button", { name: "Upravit hodinu" }));
  const dialog = screen.getByRole("dialog", { name: "Upravit hodinu" });
  fireEvent.click(
    within(dialog).getByRole("checkbox", { name: "Zamknout umístění pro další plánování" }),
  );
  fireEvent.click(within(dialog).getByRole("button", { name: "Uložit", exact: true }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(body?.expected_state).toEqual(entry);
  expect(body?.is_locked).toBe(true);
});

it("honors the server's read-only state even when the parent still holds a draft", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json(overview(false))),
  );
  render(<TimetableEditor planId={version.teaching_plan_id} version={version} />, { wrapper });
  await screen.findByRole("table", { name: "Editor týdenního rozvrhu" });
  expect(screen.queryByRole("button", { name: /Přidat hodinu:/ })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Nastavení návrhu" })).not.toBeInTheDocument();
  expect(screen.getByText("Pouze ke čtení")).toBeVisible();
});

it("shows a failed overview and retries it without falling back to global collections", async () => {
  let attempts = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (request: Request) => {
      expect(new URL(request.url).pathname).toBe(
        `/api/v1/timetable/timetable-versions/${version.id}/overview`,
      );
      attempts++;
      return attempts === 1
        ? Response.json({ error: { message: "Přehled je nedostupný" } }, { status: 503 })
        : Response.json(overview(false));
    }),
  );
  render(<TimetableEditor planId={version.teaching_plan_id} version={version} />, { wrapper });
  expect(await screen.findByRole("alert")).toHaveTextContent("Přehled je nedostupný");
  fireEvent.click(screen.getByRole("button", { name: "Zkusit znovu" }));
  expect(await screen.findByRole("table", { name: "Editor týdenního rozvrhu" })).toBeVisible();
  expect(attempts).toBe(2);
});

it("prepares a plan before any variant exists and scopes catalog requests to that plan", async () => {
  const urls: URL[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (request: Request) => {
      const url = new URL(request.url);
      urls.push(url);
      if (url.pathname.endsWith("/teaching-assignments"))
        return Response.json([{ id: id(5), teaching_plan_id: version.teaching_plan_id }]);
      if (url.pathname.endsWith("/teaching-cycle-weeks"))
        return Response.json([{ id: id(6), teaching_plan_id: version.teaching_plan_id }]);
      if (url.pathname.endsWith("/teaching-assignment-weeks"))
        return Response.json([
          { teaching_assignment_id: id(5), cycle_week_id: id(6), periods: 2 },
          { teaching_assignment_id: id(99), cycle_week_id: id(98), periods: 5 },
        ]);
      throw new Error(`Unexpected variant request: ${url.pathname}`);
    }),
  );
  const { result } = renderHook(() => useTeachingPlanData(version.teaching_plan_id), { wrapper });
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.error).toBeUndefined();
  expect(result.current.loads).toEqual([
    { teaching_assignment_id: id(5), cycle_week_id: id(6), periods: 2 },
  ]);
  expect(urls).toHaveLength(3);
  for (const url of urls.filter((url) => !url.pathname.endsWith("/teaching-assignment-weeks"))) {
    expect(url.searchParams.get("teaching_plan_id")).toBe(version.teaching_plan_id);
  }
});
