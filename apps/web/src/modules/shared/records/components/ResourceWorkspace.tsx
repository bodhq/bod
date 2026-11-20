"use client";

import type { ReactNode } from "react";
import type { ResourceDefinition } from "@/modules/shared/records/types";

import { List } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { EmptyState } from "@/core/ui/feedback/EmptyState";
import { NavList } from "@/core/ui/navigation/NavList";
import { useRecordCatalog } from "@/modules/shared/records/catalog";
import { usePermissions } from "@/modules/shared/records/hooks";

import { ResourceManager } from "./ResourceManager";

export function ResourceWorkspace({
  module,
  resourceIds,
  renderResource,
  beforeResource,
  aliases = {},
  labels = {},
}: {
  module: string;
  resourceIds?: string[];
  beforeResource?: ReactNode;
  aliases?: Record<string, string>;
  labels?: Record<string, string>;
  renderResource?: (resource: ResourceDefinition) => ReactNode | undefined;
}) {
  const { resources } = useRecordCatalog();
  const can = usePermissions();
  const available = resources.filter(
    (resource) =>
      resource.module === module &&
      can(resource.permission) &&
      (!resourceIds || resourceIds.includes(resource.id)),
  );
  if (resourceIds) available.sort((a, b) => resourceIds.indexOf(a.id) - resourceIds.indexOf(b.id));
  const pathname = usePathname();
  const params = useSearchParams();
  const requested = params.get("evidence") ?? "";
  const selected = aliases[requested] ?? requested;
  const resource = available.find((item) => item.id === selected) ?? available[0];
  const activeId = resource?.id;
  useEffect(() => {
    if (!activeId || requested === activeId) return;
    const url = new URL(window.location.href);
    url.searchParams.set("evidence", activeId);
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, [activeId, requested]);
  if (!resource)
    return (
      <EmptyState title="K této agendě nemáte oprávnění">
        Správce školy vám může přiřadit odpovídající provozní roli.
      </EmptyState>
    );
  return (
    <div className="ui-stack min-w-0">
      <NavList
        ariaLabel="Evidence modulu"
        orientation="horizontal"
        items={available.map((item) => {
          const query = new URLSearchParams(params.toString());
          query.set("evidence", item.id);
          query.delete("record");
          query.delete("section");
          return {
            title: labels[item.id] ?? item.title,
            icon: item.icon ?? List,
            href: `${pathname}?${query}`,
            isActive: () => resource.id === item.id,
          };
        })}
      />
      {beforeResource}
      <div key={resource.id}>
        {renderResource?.(resource) ?? <ResourceManager resource={resource} />}
      </div>
    </div>
  );
}
