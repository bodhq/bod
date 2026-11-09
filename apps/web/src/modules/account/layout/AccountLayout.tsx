import type { ReactNode } from "react";

import { Page } from "@/core/ui/layout/Page";

import { AccountNavigation } from "./AccountNavigation";

export default function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <Page>
      <AccountNavigation />
      <div className="account-content">{children}</div>
    </Page>
  );
}
