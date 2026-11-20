import { describe, expect, it } from "vitest";

import { pageBreadcrumbs } from "@/core/shell/navigation";
import { resources } from "@/modules/catalog";
import { workspaceBreadcrumbs } from "@/modules/navigation";

const all = () => true;
const trail = (path: string, query: string, can = all, role = "admin") =>
  workspaceBreadcrumbs(path, new URLSearchParams(query), resources, can, role);

describe("workspace navigation", () => {
  it("keeps the full settings hierarchy with usable parent links", () => {
    expect(pageBreadcrumbs("/app/settings/security")).toEqual([
      { title: "Přehled", href: "/app" },
      { title: "Můj účet", href: "/app/settings" },
      { title: "Zabezpečení", href: "/app/settings/security" },
    ]);
  });
  it("includes the selected room screen and the nested detail section", () => {
    expect(trail("/app/rooms", "evidence=room_distance_models").map((item) => item.title)).toEqual([
      "Přesuny",
    ]);
    expect(trail("/app/rooms", "evidence=rooms&record=abc&section=groups")).toEqual([
      { title: "Přehled", href: "/app/rooms?evidence=rooms" },
      { title: "Detail učebny", href: "/app/rooms?evidence=rooms&record=abc" },
      { title: "Kmenové skupiny" },
    ]);
  });
  it("uses actual permitted resources rather than labels from arbitrary URL input", () => {
    expect(trail("/app/school", "evidence=rooms")).toEqual([]);
    expect(trail("/app/rooms", "evidence=rooms", () => false)).toEqual([]);
    expect(trail("/app/rooms", "evidence=unknown")).toEqual([]);
  });
  it("keeps timetable views, preparation steps and subsections in their actual order", () => {
    expect(trail("/app/timetable", "view=schedule").map((item) => item.title)).toEqual([
      "Týdenní rozvrh",
    ]);
    expect(trail("/app/timetable", "view=manage&step=cycle").map((item) => item.title)).toEqual([
      "Příprava rozvrhu",
      "Čas a pravidla",
      "Cyklus a bloky",
    ]);
    expect(trail("/app/timetable", "step=setup&tab=teacher_unavailability").at(-1)?.title).toBe(
      resources.find((item) => item.id === "teacher_unavailability")?.title,
    );
    expect(trail("/app/timetable", "evidence=teaching_cycle_steps").at(-1)?.title).toBe(
      "Cyklus a bloky",
    );
  });
  it("starts with a working plan and keeps review distinct from editing", () => {
    expect(trail("/app/timetable", "view=manage").map((item) => item.title)).toEqual([
      "Příprava rozvrhu",
      "Skupiny a úvazky",
      "Pracovní plán",
    ]);
    expect(trail("/app/timetable", "step=review").at(-1)?.title).toBe("Kontrola");
    expect(trail("/app/timetable", "view=changes").map((item) => item.title)).toEqual([
      "Suplování",
    ]);
  });
  it("does not invent planning steps for a substitution-only role", () => {
    expect(
      trail(
        "/app/timetable",
        "evidence=lesson_changes",
        (permission) => permission === "timetable.substitute",
      ).map((item) => item.title),
    ).toEqual(["Příprava rozvrhu", "Suplování"]);
  });
  it("uses the same role-dependent classbook views as the page", () => {
    const student = (permission: string) => permission === "classbook.read";
    expect(
      trail("/app/classbook", "view=attendance", student, "student").map((item) => item.title),
    ).toEqual(["Moje docházka"]);
    expect(
      trail("/app/classbook", "view=manage", student, "student").map((item) => item.title),
    ).toEqual(["Moje docházka"]);
  });
});
