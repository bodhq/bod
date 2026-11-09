"use client";

import type { useAccessManagement } from "../hooks/useAccessManagement";

import { Button } from "@/core/ui/actions/Button";
import { Input } from "@/core/ui/forms/Input";
import { useConfirm } from "@/core/ui/overlays/ConfirmProvider";
export function RolesPanel({ model }: { model: ReturnType<typeof useAccessManagement> }) {
  const confirm = useConfirm();
  const {
    roleCode,
    setRoleCode,
    roleName,
    setRoleName,
    roleDescription,
    setRoleDescription,
    rolePermissions,
    setRolePermissions,
    editingRole,
    setEditingRole,
    rolesQuery,
    permissionsQuery,
    saveRole,
    deleteRole,
    beginEditRole,
  } = model;
  return (
    <div className="space-y-6">
      <form
        className="space-y-4 rounded-[var(--radius)] border border-(--color-border) bg-(--color-surface-100) p-4"
        onSubmit={(event) => {
          event.preventDefault();
          saveRole.mutate();
        }}
      >
        <h2 className="font-semibold">
          {editingRole ? `Upravit roli ${editingRole}` : "Nová role"}
        </h2>
        {!editingRole && (
          <Input
            label="Kód role"
            value={roleCode}
            onChange={(event) => setRoleCode(event.target.value)}
            required
            pattern="[a-z][a-z0-9_-]*"
            maxLength={64}
          />
        )}
        <Input
          label="Název role"
          value={roleName}
          onChange={(event) => setRoleName(event.target.value)}
          required
          maxLength={100}
        />
        <Input
          label="Popis"
          value={roleDescription}
          onChange={(event) => setRoleDescription(event.target.value)}
          maxLength={255}
        />
        <fieldset className="grid gap-2 sm:grid-cols-2">
          <legend className="mb-2 text-sm font-medium">Oprávnění</legend>
          {(permissionsQuery.data ?? []).map((permission) => (
            <label
              key={permission.code}
              className="flex min-w-0 items-start gap-2 rounded-lg border border-(--color-border) p-3 text-sm"
            >
              <input
                type="checkbox"
                className="mt-1 accent-(--color-primary)"
                checked={rolePermissions.includes(permission.code)}
                onChange={(event) =>
                  setRolePermissions((current) =>
                    event.target.checked
                      ? [...current, permission.code]
                      : current.filter((code) => code !== permission.code),
                  )
                }
              />
              <span className="min-w-0">
                <span className="block font-medium">{permission.description}</span>
                <code className="text-xs text-(--color-muted-foreground)">{permission.code}</code>
              </span>
            </label>
          ))}
        </fieldset>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" isLoading={saveRole.isPending}>
            Uložit roli
          </Button>
          {editingRole && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditingRole(null);
                setRoleCode("");
                setRoleName("");
                setRoleDescription("");
                setRolePermissions([]);
              }}
            >
              Zrušit úpravy
            </Button>
          )}
        </div>
      </form>
      <div className="divide-y divide-(--color-border) rounded-[var(--radius)] border border-(--color-border)">
        {(rolesQuery.data ?? []).map((role) => (
          <article
            key={role.code}
            className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="font-semibold">
                {role.name}{" "}
                <code className="ml-1 text-xs font-normal text-(--color-muted-foreground)">
                  {role.code}
                </code>
              </p>
              <p className="mt-1 text-sm text-(--color-muted-foreground)">
                {role.description || `${role.permission_codes?.length ?? 0} oprávnění`}
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => beginEditRole(role)}>
                Upravit
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  confirm({
                    title: "Odstranit roli?",
                    description: `Opravdu chcete odstranit roli ${role.name}?`,
                    confirmLabel: "Odstranit",
                    destructive: true,
                    onConfirm: () => deleteRole.mutateAsync(role),
                  })
                }
              >
                Odstranit
              </Button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
