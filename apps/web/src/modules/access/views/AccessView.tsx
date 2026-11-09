"use client";

import { Button } from "@/core/ui/actions/Button";
import { PageHeader } from "@/core/ui/layout/Page";

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
      <PageHeader title="Správa přístupů" description="K této části nemáte potřebné oprávnění." />
    );
  }
  return (
    <section className="w-full max-w-4xl">
      <PageHeader title="Správa přístupů" description="Spravujte účty, role a historii změn." />
      <fieldset className="mb-6 flex flex-wrap gap-2 border-0 p-0">
        <legend className="sr-only">Sekce správy přístupů</legend>
        {visibleSections.map((item) => (
          <Button
            key={item.id}
            aria-pressed={activeSection === item.id}
            variant="choice"
            onClick={() => setSection(item.id)}
          >
            {item.title}
          </Button>
        ))}
      </fieldset>

      {activeSection === "accounts" && canManageUsers && <AccountsPanel model={model} />}

      {activeSection === "roles" && canManageRoles && <RolesPanel model={model} />}

      {activeSection === "audit" && canReadAudit && <AuditPanel model={model} />}
    </section>
  );
}
