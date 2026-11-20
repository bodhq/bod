import { render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { AppShell } from "@/core/shell/AppShell";
import { pageBreadcrumbs } from "@/core/shell/navigation";
import { PageHeader } from "@/core/ui/layout/Page";
import { resources } from "@/modules/catalog";
import { workspaceBreadcrumbs } from "@/modules/navigation";

const route = vi.hoisted(() => ({ pathname: "/app/timetable" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));
vi.mock("@/core/appearance/preferences", () => ({
  useAppearanceStore: (select: (state: { sidebarCollapsed: boolean }) => unknown) =>
    select({ sidebarCollapsed: false }),
}));
vi.mock("@/core/appearance/ThemeToggle", () => ({
  ThemeToggle: () => <button type="button" aria-label="Přepnout motiv" />,
}));
vi.mock("@/core/shell/AppSidebar", () => ({ AppSidebar: () => null }));
vi.mock("@/core/ui/overlays/Dialog", () => ({ Dialog: () => null }));

afterEach(() => {
  vi.restoreAllMocks();
});

it("replaces breadcrumbs across repeated workspace changes even when two levels share a URL", () => {
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  const visits = [
    ["/app/timetable", "step=plans"],
    ["/app/timetable", "step=groups"],
    ["/app/timetable", "step=plans"],
    ["/app/timetable", "step=teaching"],
    ["/app/timetable", "step=groups"],
    ["/app/classbook", "view=journal"],
    ["/app/rooms", "evidence=rooms&record=room&section=groups"],
    ["/app/settings/security", ""],
    ["/app", ""],
  ] as const;
  const { rerender } = render(
    <AppShell>
      <PageHeader title="Stránka" description="Popis stránky" />
    </AppShell>,
  );
  for (let repeat = 0; repeat < 3; repeat++) {
    for (const [pathname, query] of visits) {
      route.pathname = pathname;
      const breadcrumbs = workspaceBreadcrumbs(
        pathname,
        new URLSearchParams(query),
        resources,
        () => true,
        "admin",
      );
      rerender(
        <AppShell breadcrumbs={breadcrumbs}>
          <PageHeader title="Stránka" description="Popis stránky" />
        </AppShell>,
      );
      const expected = [...pageBreadcrumbs(pathname), ...breadcrumbs];
      const nav = screen.getByRole("navigation", { name: "Drobečková navigace" });
      expect(Array.from(nav.querySelectorAll("a, span"), (element) => element.textContent)).toEqual(
        expected.map((item) => item.title),
      );
      expect(nav.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
      expect(nav.querySelector('[aria-current="page"]')).toHaveTextContent(
        expected.at(-1)?.title ?? "",
      );
      const header = nav.closest("header");
      expect(header).toContainElement(screen.getByRole("heading", { name: "Stránka" }));
      expect(header).toHaveTextContent("Popis stránky");
      expect(header).toContainElement(screen.getByRole("button", { name: "Otevřít navigaci" }));
      expect(header).toContainElement(screen.getByRole("button", { name: "Přepnout motiv" }));
      expect(document.querySelector(".app-topbar")).toBeNull();
      expect(within(nav).queryAllByRole("link")).toHaveLength(
        expected.slice(0, -1).filter((item) => item.href).length,
      );
    }
  }
  expect(errors).not.toHaveBeenCalled();
});

it("keeps the page title out of the breadcrumb when it is already the heading", () => {
  route.pathname = "/app/settings/security";
  render(
    <AppShell>
      <PageHeader title="Zabezpečení" />
    </AppShell>,
  );
  const nav = screen.getByRole("navigation", { name: "Drobečková navigace" });
  expect(Array.from(nav.querySelectorAll("a, span"), (element) => element.textContent)).toEqual([
    "Přehled",
    "Můj účet",
  ]);
  expect(nav.querySelector('[aria-current="page"]')).toBeNull();
});
