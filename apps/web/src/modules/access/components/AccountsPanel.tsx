"use client";
import type { UserRead } from "@bod/api-client/types.gen";
import type { useAccessManagement } from "../hooks/useAccessManagement";

import { useState } from "react";

import { searchText } from "@/core/search";
import { Button } from "@/core/ui/actions/Button";
import { EmptyState } from "@/core/ui/feedback/EmptyState";
import { ErrorState } from "@/core/ui/feedback/ErrorState";
import { toast } from "@/core/ui/feedback/toast";
import { Checkbox } from "@/core/ui/forms/Checkbox";
import { Input } from "@/core/ui/forms/Input";
import { Select } from "@/core/ui/forms/Select";
import { Pagination } from "@/core/ui/navigation/Pagination";
import { useConfirm } from "@/core/ui/overlays/ConfirmProvider";

import { AccountProfileDialog } from "./AccountProfileDialog";
export function AccountsPanel({ model }: { model: ReturnType<typeof useAccessManagement> }) {
  const confirm = useConfirm();
  const [editing, setEditing] = useState<UserRead | null>(null);
  const {
    accountsOffset,
    setAccountsOffset,
    accountsSearch,
    setAccountsSearch,
    username,
    setUsername,
    batchUsernames,
    setBatchUsernames,
    selectedRole,
    setSelectedRole,
    temporaryPassword,
    setTemporaryPassword,
    batchIssuedAccounts,
    setBatchIssuedAccounts,
    canManageRoles,
    accountsQuery,
    rolesQuery,
    createAccount,
    createAccounts,
    updateAccount,
    deleteAccount,
    resetPassword,
  } = model;
  const accounts = (accountsQuery.data ?? []).filter(
    (account) =>
      !accountsSearch.trim() ||
      [
        account.username,
        account.display_name,
        account.first_name,
        account.last_name,
        account.email,
      ].some((value) => searchText(value).includes(searchText(accountsSearch))),
  );
  return (
    <div className="ui-stack">
      <div className="ui-panel ui-stack p-4">
        <Input
          type="search"
          label="Hledat účet"
          value={accountsSearch}
          onChange={(event) => setAccountsSearch(event.target.value)}
          placeholder="Jméno nebo přihlašovací jméno…"
        />
        <details className="account-create">
          <summary className="min-h-11 cursor-pointer py-3 font-semibold">
            Nový účet / hromadné vytvoření
          </summary>
          <form
            className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
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
            <Select
              label="Role"
              className="sm:max-w-48"
              value={selectedRole}
              onChange={(event) => setSelectedRole(event.target.value)}
            >
              <option value="">Bez role</option>
              {(rolesQuery.data ?? []).map((role) => (
                <option key={role.code} value={role.code}>
                  {role.name}
                </option>
              ))}
            </Select>
            <Button type="submit" isLoading={createAccount.isPending}>
              Vytvořit účet
            </Button>
          </form>
          <form
            className="mt-4 space-y-3"
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
              className="ui-control min-h-24 resize-y"
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
        </details>
      </div>
      {temporaryPassword && (
        <div className="ui-panel p-4" role="status">
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
        <div className="ui-panel space-y-3 p-4" role="status">
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
        <ErrorState error={accountsQuery.error} />
      ) : (
        <div className="record-list divide-y divide-(--color-border)">
          {accounts.map((account) => (
            <article
              key={account.id}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {account.display_name || account.username}
                </p>
                <p className="mt-1 text-xs text-(--color-muted-foreground)">{account.username}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditing(account)}>
                  Upravit profil
                </Button>
                <details>
                  <summary className="min-h-11 cursor-pointer py-3 text-sm">
                    Oprávnění a další úkony
                  </summary>
                  <div className="flex flex-wrap gap-2 py-2">
                    {rolesQuery.data && canManageRoles && (
                      <fieldset className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <legend className="sr-only">Role účtu {account.username}</legend>
                        {rolesQuery.data.map((role) => (
                          <label key={role.code} className="checkbox-field">
                            <Checkbox
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
                      variant="secondary"
                      onClick={() =>
                        confirm({
                          title: "Odstranit účet?",
                          description: `Opravdu chcete odstranit účet ${account.username}?`,
                          confirmLabel: "Odstranit",
                          destructive: true,
                          onConfirm: () => deleteAccount.mutateAsync(account),
                        })
                      }
                      disabled={deleteAccount.isPending}
                    >
                      Odstranit
                    </Button>
                  </div>
                </details>
              </div>
            </article>
          ))}
        </div>
      )}
      {accountsQuery.isSuccess && !accounts.length && (
        <EmptyState
          title={
            accountsSearch ? "Žádný účet neodpovídá hledání" : "Na této stránce nejsou žádné účty"
          }
        />
      )}
      {!accountsSearch.trim() && (
        <Pagination
          label="Stránkování účtů"
          offset={accountsOffset}
          count={accountsQuery.data?.length ?? 0}
          pending={accountsQuery.isFetching}
          onChange={setAccountsOffset}
        />
      )}
      {editing && (
        <AccountProfileDialog
          key={editing.id}
          account={editing}
          model={model}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
