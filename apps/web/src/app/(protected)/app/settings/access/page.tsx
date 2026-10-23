"use client";

import type {
  AuditEventRead,
  IssuedAccount,
  PermissionRead,
  RoleRead,
  UserPatch,
  UserRead,
} from "@bod/api-client/types.gen";

import {
  auditApiV1AdminAuditGet,
  createRoleApiV1AdminRolesPost,
  createUserApiV1AdminUsersPost,
  deleteRoleApiV1AdminRolesCodeDelete,
  deleteUserApiV1AdminUsersUserIdDelete,
  generateUsersApiV1AdminUsersGeneratePost,
  permissionsApiV1AdminPermissionsGet,
  resetPasswordApiV1AdminUsersUserIdResetPasswordPost,
  rolesApiV1AdminRolesGet,
  updateRoleApiV1AdminRolesCodePut,
  updateUserApiV1AdminUsersUserIdPatch,
  usersApiV1AdminUsersGet,
} from "@bod/api-client/sdk.gen";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { parseApiError } from "@/core/api/api-errors";
import { useAuthUser } from "@/core/auth/store";
import { Button } from "@/core/ui/Button";
import { Input } from "@/core/ui/Input";
import { toast } from "@/core/ui/toast";

import { SettingsPageHeading } from "../components/SettingsPageHeading";

type Section = "accounts" | "roles" | "audit";

async function readData<T>(request: Promise<{ data?: T; error?: unknown }>) {
  const { data, error } = await request;
  if (error) throw parseApiError(error);
  return data ?? ([] as T);
}

export default function AccessSettingsPage() {
  const user = useAuthUser();
  const queryClient = useQueryClient();
  const [section, setSection] = useState<Section>("accounts");
  const [username, setUsername] = useState("");
  const [batchUsernames, setBatchUsernames] = useState("");
  const [selectedRole, setSelectedRole] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const [batchIssuedAccounts, setBatchIssuedAccounts] = useState<IssuedAccount[]>([]);
  const [roleCode, setRoleCode] = useState("");
  const [roleName, setRoleName] = useState("");
  const [roleDescription, setRoleDescription] = useState("");
  const [rolePermissions, setRolePermissions] = useState<string[]>([]);
  const [editingRole, setEditingRole] = useState<string | null>(null);

  const canManageUsers = user?.permissions?.includes("users.manage") ?? false;
  const canManageRoles = user?.permissions?.includes("roles.manage") ?? false;
  const canReadAudit = user?.permissions?.includes("audit.read") ?? false;
  const activeSection: Section =
    (section === "accounts" && canManageUsers) ||
    (section === "roles" && canManageRoles) ||
    (section === "audit" && canReadAudit)
      ? section
      : canManageUsers
        ? "accounts"
        : canManageRoles
          ? "roles"
          : "audit";

  const accountsQuery = useQuery({
    queryKey: ["access", "users"],
    queryFn: () => readData<UserRead[]>(usersApiV1AdminUsersGet()),
    enabled: canManageUsers && activeSection === "accounts",
  });
  const rolesQuery = useQuery({
    queryKey: ["access", "roles"],
    queryFn: () => readData<RoleRead[]>(rolesApiV1AdminRolesGet()),
    enabled: canManageRoles && (activeSection === "roles" || activeSection === "accounts"),
  });
  const permissionsQuery = useQuery({
    queryKey: ["access", "permissions"],
    queryFn: () => readData<PermissionRead[]>(permissionsApiV1AdminPermissionsGet()),
    enabled: canManageRoles && activeSection === "roles",
  });
  const auditQuery = useQuery({
    queryKey: ["access", "audit"],
    queryFn: () => readData<AuditEventRead[]>(auditApiV1AdminAuditGet()),
    enabled: canReadAudit && activeSection === "audit",
  });

  const refresh = async (...keys: string[][]) => {
    await Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
  };
  const createAccount = useMutation({
    mutationFn: async () => {
      const { data, error } = await createUserApiV1AdminUsersPost({
        body: { username: username.trim(), role_codes: selectedRole ? [selectedRole] : [] },
      });
      if (error) throw parseApiError(error);
      if (!data) throw new Error("Server nevrátil vytvořený účet.");
      return data;
    },
    onSuccess: async ({ temporary_password }) => {
      setTemporaryPassword(temporary_password);
      setUsername("");
      await refresh(["access", "users"]);
      toast.success("Účet byl vytvořen.");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const createAccounts = useMutation({
    mutationFn: async () => {
      const usernames = batchUsernames
        .split(/[\n,;]/)
        .map((name) => name.trim())
        .filter(Boolean);
      if (usernames.length < 1 || usernames.length > 100) {
        throw new Error("Zadejte 1 až 100 uživatelských jmen.");
      }
      const { data, error } = await generateUsersApiV1AdminUsersGeneratePost({
        body: {
          users: usernames.map((name) => ({
            username: name,
            role_codes: selectedRole ? [selectedRole] : [],
          })),
        },
      });
      if (error) throw parseApiError(error);
      if (!data) throw new Error("Server nevrátil vytvořené účty.");
      return data;
    },
    onSuccess: async (accounts) => {
      setBatchIssuedAccounts(accounts);
      setBatchUsernames("");
      await refresh(["access", "users"]);
      toast.success(`Vytvořeno účtů: ${accounts.length}.`);
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const updateAccount = useMutation({
    mutationFn: async ({ account, patch }: { account: UserRead; patch: UserPatch }) => {
      const { error } = await updateUserApiV1AdminUsersUserIdPatch({
        path: { user_id: account.id },
        body: patch,
      });
      if (error) throw parseApiError(error);
    },
    onSuccess: () => refresh(["access", "users"]),
    onError: (error: Error) => toast.error(error.message),
  });
  const deleteAccount = useMutation({
    mutationFn: async (account: UserRead) => {
      const { error } = await deleteUserApiV1AdminUsersUserIdDelete({
        path: { user_id: account.id },
      });
      if (error) throw parseApiError(error);
    },
    onSuccess: async () => {
      await refresh(["access", "users"]);
      toast.success("Účet byl odstraněn.");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const resetPassword = useMutation({
    mutationFn: async (account: UserRead) => {
      const { data, error } = await resetPasswordApiV1AdminUsersUserIdResetPasswordPost({
        path: { user_id: account.id },
      });
      if (error) throw parseApiError(error);
      if (!data) throw new Error("Server nevrátil nové heslo.");
      return data;
    },
    onSuccess: ({ temporary_password }) => setTemporaryPassword(temporary_password),
    onError: (error: Error) => toast.error(error.message),
  });
  const saveRole = useMutation({
    mutationFn: async () => {
      if (editingRole) {
        const { error } = await updateRoleApiV1AdminRolesCodePut({
          path: { code: editingRole },
          body: {
            name: roleName.trim(),
            description: roleDescription.trim() || null,
            permission_codes: rolePermissions,
          },
        });
        if (error) throw parseApiError(error);
      } else {
        const { error } = await createRoleApiV1AdminRolesPost({
          body: {
            code: roleCode.trim(),
            name: roleName.trim(),
            description: roleDescription.trim() || null,
            permission_codes: rolePermissions,
          },
        });
        if (error) throw parseApiError(error);
      }
    },
    onSuccess: async () => {
      setEditingRole(null);
      setRoleCode("");
      setRoleName("");
      setRoleDescription("");
      setRolePermissions([]);
      await refresh(["access", "roles"], ["access", "permissions"], ["access", "users"]);
      toast.success("Role byla uložena.");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const deleteRole = useMutation({
    mutationFn: async (role: RoleRead) => {
      const { error } = await deleteRoleApiV1AdminRolesCodeDelete({ path: { code: role.code } });
      if (error) throw parseApiError(error);
    },
    onSuccess: async () => {
      await refresh(["access", "roles"], ["access", "users"]);
      toast.success("Role byla odstraněna.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const beginEditRole = (role: RoleRead) => {
    setEditingRole(role.code);
    setRoleCode(role.code);
    setRoleName(role.name);
    setRoleDescription(role.description ?? "");
    setRolePermissions(role.permission_codes ?? []);
  };

  const sections: { id: Section; title: string; visible: boolean }[] = [
    { id: "accounts", title: "Účty", visible: canManageUsers },
    { id: "roles", title: "Role a oprávnění", visible: canManageRoles },
    { id: "audit", title: "Záznamy změn", visible: canReadAudit },
  ];
  const visibleSections = sections.filter((item) => item.visible);

  if (!visibleSections.length) {
    return (
      <SettingsPageHeading
        title="Správa přístupů"
        description="K této části nemáte potřebné oprávnění."
      />
    );
  }

  return (
    <section className="w-full max-w-4xl">
      <SettingsPageHeading
        title="Správa přístupů"
        description="Spravujte účty, role a historii změn."
      />
      <fieldset className="mb-6 flex flex-wrap gap-2 border-0 p-0">
        <legend className="sr-only">Sekce správy přístupů</legend>
        {visibleSections.map((item) => (
          <Button
            key={item.id}
            aria-pressed={activeSection === item.id}
            variant={activeSection === item.id ? "default" : "outline"}
            onClick={() => setSection(item.id)}
          >
            {item.title}
          </Button>
        ))}
      </fieldset>

      {activeSection === "accounts" && canManageUsers && (
        <div className="space-y-5">
          <form
            className="flex flex-col gap-3 rounded-[var(--radius)] border border-(--color-border) bg-(--color-surface-100) p-4 sm:flex-row sm:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              createAccount.mutate();
            }}
          >
            <Input
              className="flex-1"
              label="Nové uživatelské jméno"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
              minLength={3}
              maxLength={64}
            />
            <label className="flex min-w-36 flex-col gap-1.5 text-[13px] font-medium">
              Role
              <select
                className="h-10 rounded-[var(--radius)] border border-(--color-border) bg-(--color-background) px-3 text-sm"
                value={selectedRole}
                onChange={(event) => setSelectedRole(event.target.value)}
              >
                <option value="">Bez role</option>
                {(rolesQuery.data ?? []).map((role) => (
                  <option key={role.code} value={role.code}>
                    {role.name}
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit" isLoading={createAccount.isPending}>
              Vytvořit účet
            </Button>
          </form>
          <form
            className="space-y-3 rounded-[var(--radius)] border border-(--color-border) p-4"
            onSubmit={(event) => {
              event.preventDefault();
              createAccounts.mutate();
            }}
          >
            <div>
              <h2 className="text-sm font-semibold">Hromadné vytvoření</h2>
              <p className="mt-1 text-xs text-(--color-muted-foreground)">
                Zadejte jména oddělená novým řádkem, čárkou nebo středníkem (nejvýše 100).
              </p>
            </div>
            <textarea
              className="min-h-24 w-full resize-y rounded-[var(--radius)] border border-(--color-border) bg-(--color-background) p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-ring)"
              value={batchUsernames}
              onChange={(event) => setBatchUsernames(event.target.value)}
              placeholder="novak.jan\nsvobodova.anna"
              aria-label="Uživatelská jména, každé na novém řádku"
              required
            />
            <div className="flex justify-end">
              <Button type="submit" isLoading={createAccounts.isPending}>
                Vytvořit účty
              </Button>
            </div>
          </form>
          {temporaryPassword && (
            <div
              className="rounded-[var(--radius)] border border-(--color-border) bg-(--color-surface-100) p-4"
              role="status"
            >
              <p className="text-sm font-semibold">Dočasné heslo (zobrazí se pouze nyní)</p>
              <code className="mt-2 block break-all text-sm">{temporaryPassword}</code>
              <Button
                className="mt-3"
                size="sm"
                variant="outline"
                onClick={() => {
                  void navigator.clipboard?.writeText(temporaryPassword);
                  toast.success("Heslo zkopírováno.");
                }}
              >
                Kopírovat
              </Button>
              <Button
                className="ml-2 mt-3"
                size="sm"
                variant="ghost"
                onClick={() => setTemporaryPassword(null)}
              >
                Skrýt
              </Button>
            </div>
          )}
          {batchIssuedAccounts.length > 0 && (
            <div
              className="space-y-3 rounded-[var(--radius)] border border-(--color-border) bg-(--color-surface-100) p-4"
              role="status"
            >
              <p className="text-sm font-semibold">
                Nové dočasné přihlašovací údaje (zobrazí se pouze nyní)
              </p>
              <ul className="space-y-2">
                {batchIssuedAccounts.map(({ user: issuedUser, temporary_password: password }) => (
                  <li
                    key={issuedUser.id}
                    className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-sm"
                  >
                    <span>{issuedUser.username}</span>
                    <code className="break-all">{password}</code>
                  </li>
                ))}
              </ul>
              <Button size="sm" variant="ghost" onClick={() => setBatchIssuedAccounts([])}>
                Skrýt
              </Button>
            </div>
          )}
          {accountsQuery.isLoading ? (
            <p className="text-sm text-(--color-muted-foreground)">Načítám účty…</p>
          ) : accountsQuery.isError ? (
            <p className="text-sm text-(--color-destructive)">{accountsQuery.error.message}</p>
          ) : (
            <div className="divide-y divide-(--color-border) rounded-[var(--radius)] border border-(--color-border)">
              {(accountsQuery.data ?? []).map((account) => (
                <article
                  key={account.id}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {account.display_name || account.username}
                    </p>
                    <p className="mt-1 text-xs text-(--color-muted-foreground)">
                      {account.username}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {rolesQuery.data && canManageRoles && (
                      <fieldset className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <legend className="sr-only">Role účtu {account.username}</legend>
                        {rolesQuery.data.map((role) => (
                          <label
                            key={role.code}
                            className="flex items-center gap-1 text-xs text-(--color-muted-foreground)"
                          >
                            <input
                              type="checkbox"
                              className="accent-(--color-primary)"
                              checked={account.roles?.includes(role.code) ?? false}
                              disabled={updateAccount.isPending}
                              onChange={(event) => {
                                const nextRoles = new Set(account.roles ?? []);
                                if (event.target.checked) nextRoles.add(role.code);
                                else nextRoles.delete(role.code);
                                updateAccount.mutate({
                                  account,
                                  patch: { role_codes: [...nextRoles] },
                                });
                              }}
                            />
                            {role.name}
                          </label>
                        ))}
                      </fieldset>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => resetPassword.mutate(account)}
                      disabled={resetPassword.isPending}
                    >
                      Resetovat heslo
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        updateAccount.mutate({ account, patch: { is_active: !account.is_active } })
                      }
                      disabled={updateAccount.isPending}
                    >
                      {account.is_active ? "Deaktivovat" : "Aktivovat"}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() =>
                        toast.confirm(
                          `Opravdu chcete odstranit účet ${account.username}?`,
                          () => deleteAccount.mutateAsync(account),
                          { variant: "error", confirmText: "Odstranit" },
                        )
                      }
                      disabled={deleteAccount.isPending}
                    >
                      Odstranit
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {activeSection === "roles" && canManageRoles && (
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
                    <code className="text-xs text-(--color-muted-foreground)">
                      {permission.code}
                    </code>
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
                    variant="destructive"
                    onClick={() =>
                      toast.confirm(
                        `Opravdu chcete odstranit roli ${role.name}?`,
                        () => deleteRole.mutateAsync(role),
                        { variant: "error", confirmText: "Odstranit" },
                      )
                    }
                  >
                    Odstranit
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {activeSection === "audit" && canReadAudit && (
        <div className="divide-y divide-(--color-border) rounded-[var(--radius)] border border-(--color-border)">
          {auditQuery.isLoading ? (
            <p className="p-4 text-sm text-(--color-muted-foreground)">Načítám historii…</p>
          ) : auditQuery.isError ? (
            <p className="p-4 text-sm text-(--color-destructive)">{auditQuery.error.message}</p>
          ) : (
            (auditQuery.data ?? []).map((event) => (
              <article
                key={event.id}
                className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="break-words text-sm font-semibold">{event.event_code}</p>
                  <p className="text-xs text-(--color-muted-foreground)">
                    {event.entity_type}
                    {event.entity_id ? ` · ${event.entity_id}` : ""} · {event.operation}
                  </p>
                </div>
                <time
                  className="shrink-0 text-xs tabular-nums text-(--color-muted-foreground)"
                  dateTime={event.created_at}
                >
                  {new Date(event.created_at).toLocaleString("cs-CZ")}
                </time>
              </article>
            ))
          )}
          {!auditQuery.isLoading && !auditQuery.isError && auditQuery.data?.length === 0 && (
            <p className="p-4 text-sm text-(--color-muted-foreground)">
              Zatím zde nejsou žádné změny.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
