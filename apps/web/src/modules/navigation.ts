import type { BreadcrumbItem } from "@/core/shell/navigation";
import type { ResourceDefinition } from "./shared/records/types";

import { classbookViews } from "./classbook/navigation";
import {
  defaultPlannerStep,
  phases,
  plannerPhase,
  sections,
  steps,
} from "./timetable/planner-navigation";

export function workspaceBreadcrumbs(
  pathname: string,
  params: URLSearchParams,
  resources: ResourceDefinition[],
  can: (permission: string) => boolean,
  activeRole?: string | null,
): BreadcrumbItem[] {
  const module = pathname.split("/")[2];
  const result: BreadcrumbItem[] = [];
  if (module === "timetable") {
    const read = can("timetable.read");
    const manage = can("timetable.edit") || can("timetable.substitute");
    if (!read && !manage) return [];
    const schedule = (params.get("view") === "schedule" && read) || !manage;
    const changes = params.get("view") === "changes" && can("timetable.substitute");
    result.push({
      title: schedule ? "Týdenní rozvrh" : changes ? "Suplování" : "Příprava rozvrhu",
      href: `${pathname}?view=${schedule ? "schedule" : changes ? "changes" : "manage"}`,
    });
    if (schedule || changes) return result;
    if (!can("timetable.edit")) {
      const resource = resources.find(
        (item) =>
          item.module === module && item.id === params.get("evidence") && can(item.permission),
      );
      if (resource) result.push({ title: resource.title });
      return result;
    }
    const requested =
      params.get("step") ??
      Object.entries(sections).find(([, section]) =>
        section.ids.includes(params.get("evidence") ?? ""),
      )?.[0];
    const step =
      steps.find((item) => item.id === requested) ??
      steps.find((item) => item.id === defaultPlannerStep);
    const phase = step ? phases[plannerPhase(step.id)] : undefined;
    if (phase && phase.ids.length > 1)
      result.push({ title: phase.title, href: `${pathname}?view=manage&step=${phase.ids[0]}` });
    if (step)
      result.push({
        title: step.title.replace(/^\d+\.\s*/, ""),
        href: `${pathname}?view=manage&step=${step.id}`,
      });
    if (
      !step ||
      ["cycle", "calendar"].includes(step.id) ||
      (sections[step.id]?.ids.length ?? 0) < 2
    )
      return result;
    const ids = sections[step.id]?.ids ?? [];
    const id = ids.includes(params.get("tab") ?? "") ? params.get("tab") : ids[0];
    const resource = resources.find((item) => item.id === id && can(item.permission));
    if (resource) result.push({ title: resource.title });
    return result;
  }
  if (module === "classbook") {
    const views = classbookViews(can, activeRole);
    const view = views.find((item) => item.id === params.get("view")) ?? views[0];
    if (!view) return [];
    result.push({ title: view.title, href: `${pathname}?view=${view.id}` });
    if (view.id !== "manage") return result;
  }
  const resource = resources.find(
    (item) => item.module === module && item.id === params.get("evidence") && can(item.permission),
  );
  if (resource)
    result.push({
      title:
        resource.id === "rooms"
          ? "Přehled"
          : resource.id === "room_distance_models"
            ? "Přesuny"
            : resource.id === "parent_students"
              ? "Žáci a rodiče"
              : resource.title,
      href: `${pathname}?${module === "classbook" ? "view=manage&" : ""}evidence=${resource.id}`,
    });
  if (module === "rooms" && resource?.id === "rooms" && params.get("record")) {
    result.push({
      title: "Detail učebny",
      href: `${pathname}?evidence=rooms&record=${encodeURIComponent(params.get("record") ?? "")}`,
    });
    result.push({
      title: params.get("section") === "groups" ? "Kmenové skupiny" : "Dostupnost v čase",
    });
  }
  return result;
}
