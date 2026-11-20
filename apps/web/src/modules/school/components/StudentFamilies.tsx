"use client";
import { createAccount } from "@/core/accounts/api";
import { IssuedCredentials } from "@/core/accounts/components/IssuedCredentials";
import { Button } from "@/core/ui/actions/Button";
import { EmptyState } from "@/core/ui/feedback/EmptyState";
import { ErrorState } from "@/core/ui/feedback/ErrorState";
import { LoadingState } from "@/core/ui/feedback/LoadingState";
import { Input } from "@/core/ui/forms/Input";
import { Select } from "@/core/ui/forms/Select";
import { Panel } from "@/core/ui/layout/Panel";
import { removeRow, workspaceKey } from "@/modules/shared/records/api";
import { RecordDialog } from "@/modules/shared/records/components/RecordDialog";
import { rowLabel } from "@/modules/shared/records/format";

import { useStudentFamilies } from "../hooks/useStudentFamilies";

export function StudentFamilies() {
  const {
    queryClient,
    resource,
    refresh,
    confirm,
    creatingFor,
    setCreatingFor,
    issued,
    setIssued,
    search,
    setSearch,
    studentId,
    setStudentId,
    parentId,
    setParentId,
    accounts,
    links,
    assign,
  } = useStudentFamilies();
  if (accounts.isPending || links.isPending)
    return <LoadingState>Načítám žáky a rodinné vazby…</LoadingState>;
  if (accounts.isError || links.isError)
    return (
      <ErrorState
        error={accounts.error ?? links.error}
        action={
          <Button
            onClick={() => {
              accounts.refetch();
              links.refetch();
            }}
          >
            Zkusit znovu
          </Button>
        }
      />
    );
  const students = accounts.data.filter((user) => user.roles?.includes("student"));
  const selected = students.find((user) => user.id === studentId);
  const relatives = links.data.filter((link) => link.student_id === studentId);
  const parents = accounts.data.filter(
    (user) =>
      user.is_active &&
      user.roles?.includes("parent") &&
      !relatives.some((link) => link.parent_id === user.id),
  );
  const filtered = students.filter((user) =>
    `${rowLabel(user)} ${user.username}`
      .toLocaleLowerCase("cs")
      .includes(search.toLocaleLowerCase("cs")),
  );
  return (
    <section className="ui-stack">
      <IssuedCredentials
        accounts={
          issued ? [{ username: issued.user.username, password: issued.temporary_password }] : []
        }
        onDismiss={() => setIssued(null)}
      />
      {creatingFor && (
        <RecordDialog
          title="Nový rodič"
          description="Vytvoříte rodičovský účet a přiřadíte jej k vybranému žákovi."
          fields={[
            {
              name: "first_name",
              label: "Jméno",
              type: "string",
              required: true,
              nullable: false,
              maxLength: 100,
            },
            {
              name: "last_name",
              label: "Příjmení",
              type: "string",
              required: true,
              nullable: false,
              maxLength: 100,
            },
            { name: "email", label: "E-mail", type: "string", required: false, nullable: true },
            { name: "phone", label: "Telefon", type: "string", required: false, nullable: true },
          ]}
          onClose={() => setCreatingFor(null)}
          onSave={async (body) => {
            const account = await createAccount({ ...body, role_codes: ["parent"] });
            // Keep credentials even if the separate relationship request fails.
            setIssued(account);
            setCreatingFor(null);
            setParentId(account.user.id);
            queryClient.setQueryData(
              [...workspaceKey, "family-directory"],
              [...accounts.data, account.user],
            );
            assign.mutate({ student: creatingFor, parent: account.user.id });
          }}
          label="Vytvořit a přiřadit"
        />
      )}

      <div>
        <h2 className="text-xl font-semibold">Žáci a rodiče</h2>
        <p className="mt-1 text-sm text-(--color-muted-foreground)">
          Vyberte žáka a přiřaďte mu rodiče. Jeden rodič může být přiřazen k více dětem.
        </p>
      </div>
      <Input
        label="Hledat žáka"
        fieldWidth="standard"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Jméno nebo uživatelské jméno"
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
        <nav className="max-h-96 space-y-1 overflow-y-auto" aria-label="Žáci">
          {filtered.map((user) => (
            <Button
              key={user.id}
              variant="choice"
              className="w-full justify-start"
              contentClassName="w-full justify-start gap-3"
              aria-pressed={studentId === user.id}
              onClick={() => {
                setStudentId(user.id);
                setParentId("");
                assign.reset();
              }}
            >
              {rowLabel(user)}
              <span className="ml-auto text-xs opacity-70">
                {links.data.filter((link) => link.student_id === user.id).length} rodičů
              </span>
            </Button>
          ))}
          {!filtered.length && (
            <EmptyState title="Žádní odpovídající žáci">
              Žákovské účty se zakládají ve správě přístupů.
            </EmptyState>
          )}
        </nav>
        {selected ? (
          <Panel as="div" className="ui-stack">
            <div className="visual-family-student">
              <span className="visual-avatar mb-3" aria-hidden="true">
                {rowLabel(selected)
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((word) => word[0])
                  .join("")}
              </span>
              <h3 className="text-lg font-semibold">{rowLabel(selected)}</h3>
              <p className="text-sm text-(--color-muted-foreground)">{selected.username}</p>
            </div>
            <h4 className="font-semibold">Přiřazení rodiče</h4>
            {!relatives.length && (
              <p className="text-sm text-(--color-muted-foreground)">
                Tento žák zatím nemá přiřazeného rodiče.
              </p>
            )}
            <div className="visual-family-branches">
              {relatives.map((link) => {
                const parent = accounts.data.find((user) => user.id === link.parent_id);
                return (
                  <div
                    key={String(link.parent_id)}
                    className="visual-family-parent flex flex-wrap items-center justify-between gap-3"
                  >
                    <div>
                      <p className="font-medium">
                        {parent ? rowLabel(parent) : "Nedostupný účet rodiče"}
                      </p>
                      <p className="text-sm text-(--color-muted-foreground)">
                        {[parent?.email, parent?.phone].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      disabled={assign.isPending}
                      onClick={() =>
                        confirm({
                          title: "Odebrat přiřazení rodiče?",
                          description: `Zrušíte vazbu k žákovi ${rowLabel(selected)}. Účet rodiče i vazby k ostatním dětem zůstanou zachované.`,
                          confirmLabel: "Odebrat přiřazení",
                          destructive: true,
                          onConfirm: async () => {
                            await removeRow(resource, link);
                            await refresh();
                          },
                        })
                      }
                    >
                      Odebrat přiřazení
                    </Button>
                  </div>
                );
              })}
            </div>
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                if (parentId) assign.mutate({ student: studentId, parent: parentId });
              }}
            >
              <Select
                label="Přidat rodiče"
                value={parentId}
                disabled={assign.isPending}
                onChange={(event) => setParentId(event.target.value)}
                required
              >
                <option value="">Vyberte existujícího rodiče…</option>
                {parents.map((parent) => (
                  <option key={parent.id} value={parent.id}>
                    {rowLabel(parent)} · {parent.email ?? parent.username}
                  </option>
                ))}
              </Select>
              <Button type="submit" disabled={!parentId || assign.isPending}>
                {assign.isPending ? "Přiřazuji…" : "Přiřadit k žákovi"}
              </Button>
              <p className="text-sm text-(--color-muted-foreground)">
                Pokud rodič účet ještě nemá, založte jej přímo zde. Vygenerované přihlašovací údaje
                pak předejte rodiči.
              </p>
              <Button
                type="button"
                variant="outline"
                disabled={assign.isPending || !!issued}
                onClick={() => setCreatingFor(studentId)}
              >
                Nový rodič
              </Button>
              {assign.isError && (
                <ErrorState
                  title="Přiřazení se nepodařilo uložit"
                  error={assign.error}
                  message={
                    issued
                      ? "Účet rodiče už existuje a přihlašovací údaje zůstávají zobrazené. Zkuste znovu tlačítko Přiřadit k žákovi; další účet nezakládejte."
                      : undefined
                  }
                />
              )}
            </form>
          </Panel>
        ) : (
          <EmptyState title="Vyberte žáka">Zobrazí se jeho rodiče a možnost přiřazení.</EmptyState>
        )}
      </div>
    </section>
  );
}
