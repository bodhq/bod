import type { ReactNode } from "react";

import { PageLayout } from "@/core/ui/layout/PageLayout";

import { SettingsSidebar } from "./SettingsSidebar";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <PageLayout variant="dual" title="Nastavení" sidebar={<SettingsSidebar />}>
      {children}
    </PageLayout>
  );
}
