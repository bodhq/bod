"use client";

import { ModuleLayout } from "@/core/ui/layout/Page";
import { ViewSwitcher } from "@/core/ui/navigation/ViewSwitcher";
import { AccountNavigation } from "@/modules/account/layout/AccountNavigation";

import { AccountsPanel } from "../components/AccountsPanel";
import { AuditPanel } from "../components/AuditPanel";
import { RolesPanel } from "../components/RolesPanel";
import { useAccessManagement } from "../hooks/useAccessManagement";

export default function AccessView() {
  const model = useAccessManagement();
  const {
    setSection,
    canManageUsers,
    canManageRoles,
    canReadAudit,
    activeSection,
    visibleSections,
  } = model;
  if (!visibleSections.length) {
    return (
      <ModuleLayout
        title="Správa přístupů"
        description="K této části nemáte potřebné oprávnění."
        navigation={<AccountNavigation />}
      />
    );
  }
  return (
    <ModuleLayout
      title="Správa přístupů"
      description="Spravujte účty, role a historii změn."
      className="max-w-4xl"
      navigation={
        <div className="ui-stack">
          <AccountNavigation />
          <ViewSwitcher
            label="Sekce správy přístupů"
            items={visibleSections}
            value={activeSection}
            onChange={(value) => {
              const section = visibleSections.find((item) => item.id === value);
              if (section) setSection(section.id);
            }}
          />
        </div>
      }
    >
      {activeSection === "accounts" && canManageUsers && <AccountsPanel model={model} />}

      {activeSection === "roles" && canManageRoles && <RolesPanel model={model} />}

      {activeSection === "audit" && canReadAudit && <AuditPanel model={model} />}
    </ModuleLayout>
  );
}
