import type { ReactNode } from "react";
import type { User } from "@/core/auth/api";
import type { AttendanceView } from "@/modules/classbook/attendance";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { apiClient } from "@/core/api/client";
import { useAuthStore } from "@/core/auth/store";
import { ConfirmProvider } from "@/core/ui/overlays/ConfirmProvider";
import { resources, workflows } from "@/modules/catalog";
import { getMyAttendance } from "@/modules/classbook/api";
import {
  attendancePeriodError,
  attendanceSummary,
  initialAttendancePeriod,
} from "@/modules/classbook/attendance";
import { OwnAttendance } from "@/modules/classbook/components/OwnAttendance";
import { RecordCatalogProvider } from "@/modules/shared/records/catalog";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/core/ui/feedback/toast", () => ({ toast: { success: vi.fn() } }));

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
        })
      }
    >
      <RecordCatalogProvider catalog={{ resources, workflows }}>
        <ConfirmProvider>{children}</ConfirmProvider>
      </RecordCatalogProvider>
    </QueryClientProvider>
  );
}
function record(id: string, fields: Partial<AttendanceView> = {}): AttendanceView {
  return {
    id,
    student_id: "anna",
    classbook_entry_id: `internal-${id}`,
    status: "absent",
    subject_name: "Matematika",
    group_name: "1.A",
    starts_at: "2026-11-17T07:00:00Z",
    ends_at: "2026-11-17T07:45:00Z",
    absence_minutes: 45,
    excuse_state: "unresolved",
    can_request_excuse: true,
    is_excused: false,
    late_minutes: null,
    missed_minutes: 45,
    excuse_reason: null,
    note: "Interní poznámka učitele",
    recorded_by: "teacher",
    excused_by: null,
    excused_at: null,
    recorded_at: "2026-11-17T08:00:00Z",
    updated_at: "2026-11-17T08:00:00Z",
    ...fields,
  };
}
let rows: AttendanceView[];
let posts: unknown[];
let failure: number | null;
let attendanceCalls: URL[];
let unexpected: string[];
let ownPending: Set<string>;
beforeEach(() => {
  apiClient.setConfig({ baseUrl: "http://api:8000" });
  useAuthStore.setState({
    user: {
      id: "guardian",
      active_role: "parent",
      permissions: ["classbook.read", "attendance.request", "timetable.read"],
    } as User,
  });
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
  rows = [record("absence")];
  posts = [];
  failure = null;
  attendanceCalls = [];
  unexpected = [];
  ownPending = new Set();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: Request) => {
      const url = new URL(input.url);
      if (url.pathname.endsWith("/my-children"))
        return Response.json([
          { student_id: "anna", name: "Anna Nováková" },
          { student_id: "adam", name: "Adam Bartoš" },
        ]);
      if (url.pathname.endsWith("/my-lessons"))
        return Response.json(
          rows
            .slice(
              Number(url.searchParams.get("offset")),
              Number(url.searchParams.get("offset")) + Number(url.searchParams.get("limit")),
            )
            .map((row) => ({
              id: row.classbook_entry_id,
              starts_at: row.starts_at,
              ends_at: row.ends_at,
              subject_id: `subject-${row.id}`,
              group_id: "class",
            })),
        );
      if (url.pathname.endsWith("/schedule"))
        return Response.json(
          rows.map((row) => ({
            subject_id: `subject-${row.id}`,
            subject_name: row.subject_name,
            group_id: "class",
            group_name: row.group_name,
          })),
        );
      if (url.pathname.endsWith("/my-excuse-requests"))
        return Response.json(
          ownPending.size ? [{ id: "own-request", student_id: "anna", status: "open" }] : [],
        );
      if (url.pathname.endsWith("/excuse-requests/own-request"))
        return Response.json({
          status: "open",
          items: rows
            .filter((row) => ownPending.has(row.id))
            .map((row) => ({
              attendance: { id: row.id },
              lesson_id: row.classbook_entry_id,
              subject_name: row.subject_name,
              item: { decision: "pending" },
            })),
        });
      if (url.pathname.endsWith("/my-attendance")) {
        attendanceCalls.push(url);
        const student = url.searchParams.get("student_id");
        const filtered = rows.filter((row) => row.student_id === student);
        const offset = Number(url.searchParams.get("offset"));
        return Response.json(
          filtered.slice(offset, offset + Number(url.searchParams.get("limit"))).map((row) => ({
            id: row.id,
            student_id: row.student_id,
            classbook_entry_id: row.classbook_entry_id,
            status: row.status,
            is_excused: row.is_excused,
            late_minutes: row.late_minutes,
            missed_minutes: row.absence_minutes,
            note: null,
            excuse_reason: row.excuse_reason,
          })),
        );
      }
      if (input.method === "POST" && url.pathname.endsWith("/excuse-requests")) {
        const body = await input.json();
        posts.push(body);
        if (failure) {
          if (failure === 409)
            rows = rows.map((row) => ({
              ...row,
              excuse_state: "pending",
              can_request_excuse: false,
            }));
          return Response.json(
            {
              error: {
                code: failure === 409 ? "RESOURCE_CONFLICT" : "DATABASE_UNAVAILABLE",
                message: "Žádost nelze nyní odeslat.",
              },
            },
            { status: failure },
          );
        }
        ownPending = new Set(body.attendance_record_ids);
        rows = rows.map((row) =>
          body.attendance_record_ids.includes(row.id)
            ? { ...row, excuse_state: "pending", can_request_excuse: false }
            : row,
        );
        return Response.json({ id: "request" });
      }
      unexpected.push(url.pathname);
      return Response.json([]);
    }),
  );
});
afterEach(() => {
  cleanup();
  useAuthStore.setState({ user: null });
  apiClient.setConfig({ baseUrl: "" });
  vi.unstubAllGlobals();
});

const selectFirst = async () =>
  fireEvent.click(await screen.findByRole("checkbox", { name: /^Vybrat: Matematika/ }));
async function openRequest() {
  await selectFirst();
  fireEvent.click(screen.getByRole("button", { name: "Omluvit vybrané" }));
  const dialog = screen.getByRole("dialog", { name: "Omluvit vybrané absence" });
  fireEvent.change(within(dialog).getByLabelText("Důvod omluvení"), {
    target: { value: "Návštěva lékaře" },
  });
  return dialog;
}

it("combines the original endpoints and does not invent another guardian's pending state", async () => {
  rows = [record("pending", { excuse_state: "pending", can_request_excuse: false })];
  render(<OwnAttendance />, { wrapper });
  expect(await screen.findByText("Matematika")).toBeVisible();
  expect(screen.getByText(/17\. 11\. 2026, 08:00–08:45/, { selector: "time" })).toBeVisible();
  expect(screen.getByText("1.A")).toBeVisible();
  expect(screen.getByText("45 min nepřítomnosti")).toBeVisible();
  expect(screen.getByRole("checkbox", { name: /^Vybrat:/ })).toBeEnabled();
  expect(screen.getByText("Bez potvrzeného omluvení", { selector: ".ui-badge" })).toBeVisible();
  expect(screen.queryByText("Vaše žádost čeká")).toBeNull();
  expect(screen.queryByText(/neomluven|internal-|Interní poznámka/)).toBeNull();
  expect(unexpected).toEqual([]);
});

it("sends the selected records together and refreshes their state", async () => {
  rows.push(
    record("second", {
      subject_name: "Čeština",
      starts_at: "2026-11-17T08:00:00Z",
      ends_at: "2026-11-17T08:45:00Z",
    }),
  );
  render(<OwnAttendance />, { wrapper });
  fireEvent.click(await screen.findByRole("button", { name: "Vybrat vše k omluvení" }));
  fireEvent.click(screen.getByRole("button", { name: "Omluvit vybrané" }));
  const dialog = screen.getByRole("dialog", { name: "Omluvit vybrané absence" });
  fireEvent.change(within(dialog).getByLabelText("Důvod omluvení"), { target: { value: "Nemoc" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Odeslat žádost" }));
  await waitFor(() =>
    expect(screen.queryByRole("dialog", { name: "Omluvit vybrané absence" })).toBeNull(),
  );
  expect(posts).toEqual([
    { student_id: "anna", reason: "Nemoc", attendance_record_ids: ["second", "absence"] },
  ]);
  expect(await screen.findByRole("status")).toHaveTextContent("Žádost byla odeslána");
  await waitFor(() =>
    expect(
      screen
        .getAllByRole("checkbox", { name: /^Vybrat:/ })
        .every((box) => (box as HTMLInputElement).disabled),
    ).toBe(true),
  );
});

it("preserves the selected absence and reason after failure and closing the dialog", async () => {
  failure = 503;
  render(<OwnAttendance />, { wrapper });
  const dialog = await openRequest();
  fireEvent.click(within(dialog).getByRole("button", { name: "Odeslat žádost" }));
  await screen.findByText("Žádost se nepodařilo odeslat");
  expect(within(dialog).getByLabelText("Důvod omluvení")).toHaveValue("Návštěva lékaře");
  fireEvent.click(within(dialog).getByRole("button", { name: "Zpět k výběru" }));
  expect(screen.getByRole("checkbox", { name: /^Vybrat:/ })).toBeChecked();
  fireEvent.click(screen.getByRole("button", { name: "Omluvit vybrané" }));
  expect(screen.getByLabelText("Důvod omluvení")).toHaveValue("Návštěva lékaře");
  failure = null;
  fireEvent.click(screen.getByRole("button", { name: "Odeslat žádost" }));
  await waitFor(() =>
    expect(screen.queryByRole("dialog", { name: "Omluvit vybrané absence" })).toBeNull(),
  );
  expect(posts).toHaveLength(2);
});

it("refreshes a concurrent request conflict and blocks retry without silently changing the submission", async () => {
  failure = 409;
  render(<OwnAttendance />, { wrapper });
  const dialog = await openRequest();
  fireEvent.click(within(dialog).getByRole("button", { name: "Odeslat žádost" }));
  await waitFor(() =>
    expect(within(dialog).getByRole("button", { name: "Odeslat žádost" })).toBeDisabled(),
  );
  await screen.findByText(/Vraťte se k výběru a zkontrolujte je/);
  expect(within(dialog).getByLabelText("Důvod omluvení")).toHaveValue("Návštěva lékaře");
  expect(posts).toHaveLength(1);
  fireEvent.click(within(dialog).getByRole("button", { name: "Zpět k výběru" }));
  const box = screen.getByRole("checkbox", { name: /^Vybrat:/ });
  expect(box).toBeChecked();
  expect(box).not.toBeDisabled();
  fireEvent.click(box);
  expect(box).toBeDisabled();
  expect(screen.queryByRole("button", { name: "Omluvit vybrané" })).toBeNull();
});

it("confirms discarding a draft before switching children and never carries the selection across", async () => {
  rows.push(record("adam-absence", { student_id: "adam", subject_name: "Fyzika" }));
  render(<OwnAttendance />, { wrapper });
  await openRequest();
  fireEvent.click(screen.getByRole("button", { name: "Zpět k výběru" }));
  fireEvent.change(screen.getByRole("combobox", { name: "Dítě" }), { target: { value: "adam" } });
  expect(screen.getByRole("combobox", { name: "Dítě" })).toHaveValue("anna");
  const confirmation = screen.getByRole("dialog", { name: "Zahodit rozepsanou omluvenku?" });
  fireEvent.click(within(confirmation).getByRole("button", { name: "Zahodit změny" }));
  expect(await screen.findByText("Fyzika")).toBeVisible();
  expect(screen.getByRole("checkbox", { name: /^Vybrat:/ })).not.toBeChecked();
  expect(screen.queryByRole("button", { name: "Omluvit vybrané" })).toBeNull();
});

it("uses inclusive date controls and avoids fetching an invalid period", async () => {
  render(<OwnAttendance />, { wrapper });
  await screen.findByText("Matematika");
  fireEvent.change(screen.getByLabelText("Docházka od"), { target: { value: "2026-11-17" } });
  fireEvent.change(screen.getByLabelText("Docházka do"), { target: { value: "2026-11-17" } });
  await waitFor(() =>
    expect(attendanceCalls.at(-1)?.searchParams.get("date_to")).toBe("2026-11-18"),
  );
  expect(attendanceCalls.at(-1)?.searchParams.get("date_from")).toBe("2026-11-17");
  const count = attendanceCalls.length;
  fireEvent.change(screen.getByLabelText("Docházka od"), { target: { value: "2026-11-18" } });
  expect(screen.getByRole("alert")).toHaveTextContent("Začátek období");
  expect(attendanceCalls).toHaveLength(count);
});

it("keeps period filters on every page", async () => {
  rows = Array.from({ length: 53 }, (_, i) => record(`record-${i}`));
  const result = await getMyAttendance("anna", undefined, { from: "2026-11-01", to: "2026-12-01" });
  expect(result).toHaveLength(53);
  expect(attendanceCalls.map((url) => url.searchParams.get("offset"))).toEqual(["0", "50"]);
  expect(
    attendanceCalls.every(
      (url) =>
        url.searchParams.get("date_from") === "2026-11-01" &&
        url.searchParams.get("date_to") === "2026-12-01",
    ),
  ).toBe(true);
});

it("limits a batch explicitly and shows unknown duration without inventing minutes", async () => {
  rows = Array.from({ length: 101 }, (_, i) => record(`record-${i}`, { absence_minutes: null }));
  render(<OwnAttendance />, { wrapper });
  fireEvent.click(await screen.findByRole("button", { name: "Vybrat prvních 100 k omluvení" }));
  expect(
    screen
      .getAllByRole("checkbox", { name: /^Vybrat:/ })
      .filter((box) => (box as HTMLInputElement).checked),
  ).toHaveLength(100);
  expect(screen.getByText(/Součet minut je nezahrnuje/)).toBeVisible();
  expect(screen.getAllByText("Délka neuvedena")).toHaveLength(101);
}, 15_000); // The full 101-row fixture also runs under coverage on shared CI workers.

it("shows a read-only guardian the context without offering submission", async () => {
  useAuthStore.setState({
    user: {
      id: "guardian",
      active_role: "parent",
      permissions: ["classbook.read", "timetable.read"],
    } as User,
  });
  rows = [record("absence", { can_request_excuse: false })];
  render(<OwnAttendance />, { wrapper });
  expect(await screen.findByText("Matematika")).toBeVisible();
  expect(screen.queryByRole("checkbox", { name: /^Vybrat:/ })).toBeNull();
  expect(screen.queryByRole("button", { name: /Omluvit|Vybrat vše/ })).toBeNull();
});

it("counts actual minutes and rejects malformed periods", () => {
  expect(
    attendanceSummary([
      record("late", { absence_minutes: 7 }),
      record("early", { absence_minutes: 12 }),
      record("unknown", { absence_minutes: null }),
    ]),
  ).toEqual({ records: 3, minutes: 19, unknownMinutes: 1, pending: 0 });
  expect(attendancePeriodError("2026-02-30", "2026-03-01")).toBeTruthy();
  expect(attendancePeriodError("", "2026-03-01")).toBeTruthy();
  expect(attendancePeriodError("2026-03-01", "2026-03-01")).toBeNull();
  expect(initialAttendancePeriod().from).toMatch(/^\d{4}-\d{2}-01$/);
});

it("marks pending only when the existing request detail confirms the actor's submission", async () => {
  ownPending.add("absence");
  render(<OwnAttendance />, { wrapper });
  expect(await screen.findByText("Vaše žádost čeká", { selector: ".ui-badge" })).toBeVisible();
  expect(screen.getByRole("checkbox", { name: /^Vybrat:/ })).toBeDisabled();
});

it("does not require timetable permissions or invent unavailable subject names", async () => {
  useAuthStore.setState({
    user: { id: "guardian", active_role: "parent", permissions: ["classbook.read"] } as User,
  });
  render(<OwnAttendance />, { wrapper });
  expect(await screen.findByText("Předmět neuveden")).toBeVisible();
  expect(screen.getByText(/17\. 11\. 2026, 08:00–08:45/, { selector: "time" })).toBeVisible();
  expect(screen.queryByRole("checkbox", { name: /^Vybrat:/ })).toBeNull();
});
