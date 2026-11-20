"use client";

import type { ReactNode } from "react";

import { usePathname, useSearchParams } from "next/navigation";

import { schoolRole } from "@/core/auth/roles";
import { useAuthUser } from "@/core/auth/store";
import { AppShell } from "@/core/shell/AppShell";
import { RecordCatalogProvider } from "@/modules/shared/records/catalog";
import "@/modules/shared/records/records.css";

import { resources, workflows } from "./catalog";
import { workspaceBreadcrumbs } from "./navigation";

const catalog = { resources, workflows };
export function ModuleProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const user = useAuthUser();
  const can = (permission: string) =>
    !user?.must_change_password && !!user?.permissions?.includes(permission);
  const breadcrumbs = workspaceBreadcrumbs(
    pathname,
    new URLSearchParams(params.toString()),
    resources,
    can,
    schoolRole(user),
  );
  return (
    <RecordCatalogProvider catalog={catalog}>
      <AppShell breadcrumbs={breadcrumbs}>{children}</AppShell>
    </RecordCatalogProvider>
  );
}
