import type { ReactNode } from "react";

import { ModuleLayout } from "@/core/ui/layout/Page";

import { AccountNavigation } from "./AccountNavigation";

export default function AccountLayout({ children }: { children: ReactNode }) {
  return children;
}

export function AccountPage({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <ModuleLayout
      title={title}
      description={description}
      actions={actions}
      navigation={<AccountNavigation />}
    >
      {children}
    </ModuleLayout>
  );
}
