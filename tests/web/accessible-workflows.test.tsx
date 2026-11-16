import type { ReactNode } from "react";
import type { User } from "@/core/auth/api";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { apiClient } from "@/core/api/client";
import { useAuthStore } from "@/core/auth/store";
import { ConfirmProvider } from "@/core/ui/overlays/ConfirmProvider";
import { AccountsPanel } from "@/modules/access/components/AccountsPanel";
import { AuditPanel } from "@/modules/access/components/AuditPanel";
import { useAccessManagement } from "@/modules/access/hooks/useAccessManagement";
import { getResource, resources, workflows } from "@/modules/catalog";
import { OwnExcuses } from "@/modules/classbook/components/OwnExcuses";
import { RecordCatalogProvider } from "@/modules/shared/records/catalog";
import { ResourceManager } from "@/modules/shared/records/components/ResourceManager";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/app",
}));
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
      <RecordCatalogProvider catalog={{ resources, workflows }}>
        <ConfirmProvider>{children}</ConfirmProvider>
      </RecordCatalogProvider>
    </QueryClientProvider>
  );
}
function Accounts() {
  const model = useAccessManagement();
  return <AccountsPanel model={model} />;
}
function Audit() {
  const model = useAccessManagement();
  return (
    <>
      <button type="button" onClick={() => model.setSection("audit")}>
        Historie
      </button>
      <AuditPanel model={model} />
    </>
  );
}
beforeEach(() => {
  apiClient.setConfig({ baseUrl: "http://api:8000" });
  useAuthStore.setState({
    user: {
      id: "viewer",
      active_role: "admin",
      username: "spravce",
      permissions: ["users.manage", "audit.read", "school.manage"],
    } as User,
  });
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});
afterEach(() => {
  cleanup();
  useAuthStore.setState({ user: null });
  apiClient.setConfig({ baseUrl: "" });
  vi.unstubAllGlobals();
});

const account = (i: number) => ({
  id: `user-${i}`,
  username: `ucet-${i}`,
  display_name: i === 51 ? "Anna Zaškolená" : `Uživatel ${i}`,
  roles: [],
  is_active: true,
});
it("navigates account pages and searches beyond the first fifty records", async () => {
  const offsets: number[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: Request) => {
      const url = new URL(input.url);
      const offset = Number(url.searchParams.get("offset"));
      offsets.push(offset);
      return Response.json(
        Array.from({ length: offset === 0 ? 50 : 2 }, (_, i) => account(offset + i)),
      );
    }),
  );
  render(<Accounts />, { wrapper });
  await screen.findByText("Uživatel 0");
  const paging = screen.getByRole("navigation", { name: "Stránkování účtů" });
  fireEvent.click(within(paging).getByRole("button", { name: "Další" }));
  expect(await screen.findByText("Anna Zaškolená")).toBeVisible();
  expect(within(paging).getByRole("button", { name: "Další" })).toBeDisabled();
  fireEvent.change(screen.getByRole("searchbox", { name: "Hledat účet" }), {
    target: { value: "Zaskolena" },
  });
  await waitFor(() => expect(screen.queryByText("Uživatel 50")).toBeNull());
  expect(await screen.findByText("Anna Zaškolená")).toBeVisible();
  expect(offsets).toContain(50);
});

const auditEvent = (id: string, topic = "Nové téma") => ({
  id,
  actor_user_id: "teacher",
  actor_role_code: "teacher",
  operation: "update",
  entity_type: "classbook_entries",
  entity_id: "lesson",
  event_code: "classbook.updated",
  created_at: "2026-11-16T09:00:00Z",
  before_data: { topic: "Původní téma", password_hash: "hidden-before" },
  after_data: { topic, password_hash: "hidden-after" },
});
it("renders actual audit differences and paginates without account-directory permission", async () => {
  useAuthStore.setState({ user: { id: "viewer", permissions: ["audit.read"] } as User });
  const paths: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: Request) => {
      const url = new URL(input.url);
      paths.push(url.pathname);
      const offset = Number(url.searchParams.get("offset"));
      return Response.json(
        offset === 0
          ? Array.from({ length: 50 }, (_, i) => auditEvent(`event-${i}`))
          : [auditEvent("old", "Starší téma")],
      );
    }),
  );
  render(<Audit />, { wrapper });
  await screen.findAllByText("Upraveno · Zápisy třídnice");
  fireEvent.click(screen.getAllByText("Zobrazit změnu")[0]);
  expect(screen.getAllByText("Před: Původní téma")[0]).toBeVisible();
  expect(screen.getAllByText("Po: Nové téma")[0]).toBeVisible();
  expect(screen.queryByText(/hidden-before|hidden-after/)).toBeNull();
  const nav = screen.getByRole("navigation", { name: "Stránkování historie" });
  fireEvent.click(within(nav).getByRole("button", { name: "Další" }));
  await waitFor(() => expect(screen.getAllByText("Zobrazit změnu")).toHaveLength(1));
  fireEvent.click(screen.getByText("Zobrazit změnu"));
  expect(screen.getByText("Po: Starší téma")).toBeVisible();
  expect(paths.every((path) => path.endsWith("/audit"))).toBe(true);
});

it("looks up the audit actor only when account management is authorized", async () => {
  const names: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: Request) => {
      const url = new URL(input.url);
      if (url.pathname.endsWith("/audit")) return Response.json([auditEvent("event")]);
      if (url.pathname.endsWith("/users/teacher")) {
        names.push(url.pathname);
        return Response.json({ ...account(1), id: "teacher", display_name: "Jan Novák" });
      }
      return Response.json([]);
    }),
  );
  render(<Audit />, { wrapper });
  fireEvent.click(screen.getByRole("button", { name: "Historie" }));
  expect(await screen.findByText(/Jan Novák · Učitel/)).toBeVisible();
  expect(names).toHaveLength(1);
});

it("finds a resource record on a later API page instead of searching only the current page", async () => {
  const offsets: number[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: Request) => {
      const url = new URL(input.url);
      const offset = Number(url.searchParams.get("offset"));
      offsets.push(offset);
      return Response.json(
        Array.from({ length: offset === 0 ? 50 : 2 }, (_, i) => ({
          id: `subject-${offset + i}`,
          code: `S${offset + i}`,
          name: offset + i === 51 ? "Algebra pro pokročilé" : `Předmět ${offset + i}`,
        })),
      );
    }),
  );
  render(<ResourceManager resource={getResource("subjects")} />, { wrapper });
  await screen.findByRole("heading", { name: "Předmět 0" });
  fireEvent.change(screen.getByRole("textbox", { name: "Hledat: Předměty" }), {
    target: { value: "Algebra" },
  });
  expect(await screen.findByRole("heading", { name: "Algebra pro pokročilé" })).toBeVisible();
  expect(offsets).toContain(50);
});

it("shows the student's name and individual approved and rejected decisions from the original detail API", async () => {
  useAuthStore.setState({
    user: {
      id: "parent",
      active_role: "parent",
      permissions: ["classbook.read", "attendance.request"],
    } as User,
  });
  const requests = [
    {
      id: "request",
      student_id: "anna",
      status: "closed",
      created_at: "2026-11-16T09:00:00Z",
      reason: "Nemoc",
    },
  ];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: Request) => {
      const path = new URL(input.url).pathname;
      if (path.endsWith("/my-children"))
        return Response.json([{ student_id: "anna", name: "Anna Nováková" }]);
      if (path.endsWith("/my-excuse-requests")) return Response.json(requests);
      return Response.json({
        ...requests[0],
        student_name: "Anna Nováková",
        items: ["approved", "rejected"].map((decision, index) => ({
          subject_name: index === 0 ? "Matematika" : "Český jazyk",
          starts_at: "2026-11-16T07:00:00Z",
          ends_at: "2026-11-16T07:45:00Z",
          attendance: { status: "absent" },
          item: {
            attendance_record_id: `record-${index}`,
            decision,
            decision_note: decision === "rejected" ? "Doplňte doložení" : null,
            decided_at: "2026-11-16T10:00:00Z",
          },
        })),
      });
    }),
  );
  render(<OwnExcuses />, { wrapper });
  expect(await screen.findByRole("heading", { name: "Anna Nováková" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Detail a rozhodnutí" }));
  const dialog = screen.getByRole("dialog", { name: "Omluvenka a rozhodnutí" });
  expect(await within(dialog).findByText("Matematika")).toBeVisible();
  expect(within(dialog).getByText("Český jazyk")).toBeVisible();
  expect(within(dialog).getByText("Schváleno")).toBeVisible();
  expect(within(dialog).getByText("Zamítnuto")).toBeVisible();
  expect(within(dialog).getByText("Poznámka školy: Doplňte doložení")).toBeVisible();
});

it("edits account fields through the original PATCH and exposes authorized photo removal", async () => {
  const edits: unknown[] = [];
  const photos: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: Request) => {
      if (input.method === "PATCH") {
        edits.push(await input.json());
        return new Response(null, { status: 204 });
      }
      if (input.method === "DELETE") {
        photos.push(new URL(input.url).pathname);
        return new Response(null, { status: 204 });
      }
      return Response.json([
        {
          ...account(1),
          first_name: "Jan",
          last_name: "Novák",
          display_name: "Jan Novák",
          avatar_url: "/photo.png",
        },
      ]);
    }),
  );
  render(<Accounts />, { wrapper });
  fireEvent.click(await screen.findByRole("button", { name: "Upravit profil" }));
  const dialog = screen.getByRole("dialog", { name: "Upravit účet: Jan Novák" });
  fireEvent.change(within(dialog).getByLabelText("Jméno"), { target: { value: "Pavel" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Odstranit fotografii" }));
  await waitFor(() =>
    expect(within(dialog).queryByRole("button", { name: "Odstranit fotografii" })).toBeNull(),
  );
  expect(photos).toEqual(["/api/v1/users/user-1/avatar"]);
  fireEvent.click(within(dialog).getByRole("button", { name: "Uložit", exact: true }));
  await waitFor(() => expect(edits).toHaveLength(1));
  expect(edits[0]).toMatchObject({ first_name: "Pavel", username: "ucet-1" });
  expect(edits[0]).not.toHaveProperty("avatar_url");
  expect(edits[0]).not.toHaveProperty("id");
});

it("deletes only the teacher's empty draft through the existing delete endpoint", async () => {
  const { LessonPage } = await import("@/modules/classbook/components/LessonPage");
  const deleted: string[] = [];
  useAuthStore.setState({
    user: {
      id: "teacher",
      active_role: "teacher",
      permissions: ["classbook.read", "classbook.write", "attendance.mark"],
    } as User,
  });
  const entry = {
    id: "empty",
    actual_teacher_id: "teacher",
    status: "draft",
    topic: null,
    note: null,
    starts_at: "2026-11-17T07:00:00Z",
    ends_at: "2026-11-17T07:45:00Z",
    updated_at: "2026-11-16T09:00:00Z",
    subject_id: "math",
    group_id: "class",
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: Request) => {
      if (input.method === "DELETE") {
        deleted.push(new URL(input.url).pathname);
        return new Response(null, { status: 204 });
      }
      return Response.json({
        lesson: entry,
        participants: [{ student_id: "anna", name: "Anna Nováková", attendance: null }],
      });
    }),
  );
  render(
    <LessonPage
      entry={entry as import("@bod/api-client/types.gen").ClassbookEntriesRead}
      names={{}}
      onDirtyChange={vi.fn()}
    />,
    { wrapper },
  );
  fireEvent.click(await screen.findByText("Další úkony hodiny"));
  fireEvent.click(screen.getByRole("button", { name: "Odstranit prázdný návrh" }));
  const confirmation = screen.getByRole("dialog", { name: "Odstranit prázdný návrh?" });
  fireEvent.click(
    within(confirmation).getByRole("button", { name: "Odstranit návrh", exact: true }),
  );
  await waitFor(() => expect(deleted).toEqual(["/api/v1/classbook/lessons/empty"]));
});
