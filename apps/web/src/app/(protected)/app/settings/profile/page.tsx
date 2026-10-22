"use client";

import { useAuthUser } from "@/core/auth/store";

import { SettingsPageHeading } from "../components/SettingsPageHeading";

function getRoleLabel(role: string | undefined) {
  switch (role) {
    case "admin":
      return "Administrátor";
    case "teacher":
      return "Učitel";
    case "student":
      return "Student";
    default:
      return "—";
  }
}

export default function ProfileSettingsPage() {
  const user = useAuthUser();

  return (
    <section className="w-full max-w-2xl">
      <SettingsPageHeading
        title="Osobní údaje"
        description="Základní informace spojené s vaším účtem."
      />

      <dl className="divide-y divide-(--color-border)">
        <div className="flex flex-col gap-1 py-4 first:pt-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <dt className="text-sm text-(--color-muted-foreground)">Uživatelské jméno</dt>
          <dd className="break-all text-sm font-medium">{user?.username ?? "—"}</dd>
        </div>
        <div className="flex flex-col gap-1 py-4 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <dt className="text-sm text-(--color-muted-foreground)">Role v systému</dt>
          <dd className="text-sm font-medium">{getRoleLabel(user?.role)}</dd>
        </div>
      </dl>
    </section>
  );
}
