"use client";

import type { AuditEventRead } from "@bod/api-client/types.gen";
import type { useAccessManagement } from "../hooks/useAccessManagement";

import { roleLabel } from "@/core/auth/roles";
import { useAuthUser } from "@/core/auth/store";
import { Button } from "@/core/ui/actions/Button";
import { EmptyState } from "@/core/ui/feedback/EmptyState";
import { ErrorState } from "@/core/ui/feedback/ErrorState";
import { Pagination } from "@/core/ui/navigation/Pagination";
import { useRecordCatalog } from "@/modules/shared/records/catalog";
import { dateLabel, valueLabels } from "@/modules/shared/records/format";

const operations: Record<string, string> = {
  create: "Vytvořeno",
  insert: "Vytvořeno",
  update: "Upraveno",
  patch: "Upraveno",
  delete: "Odstraněno",
  login: "Přihlášení",
  logout: "Odhlášení",
};
const entities: Record<string, string> = { users: "Účet", roles: "Role", sessions: "Přihlášení" };
const commonFields: Record<string, string> = {
  username: "Přihlašovací jméno",
  first_name: "Jméno",
  last_name: "Příjmení",
  display_name: "Zobrazované jméno",
  role_codes: "Role",
  permission_codes: "Oprávnění",
  is_active: "Aktivní",
  email: "E-mail",
  phone: "Telefon",
  created_at: "Vytvořeno",
  updated_at: "Změněno",
  correction_reason: "Důvod opravy",
};
const sensitive = /password|secret|token|cookie/i;
const display = (value: unknown): string =>
  value == null
    ? "—"
    : typeof value === "boolean"
      ? value
        ? "Ano"
        : "Ne"
      : Array.isArray(value)
        ? value.map(display).join(", ") || "—"
        : typeof value === "object"
          ? JSON.stringify(value, (key, item) => (sensitive.test(key) ? "[skryto]" : item))
          : (valueLabels[String(value)] ?? String(value));
function changes(event: AuditEventRead) {
  const before = event.before_data ?? {},
    after = event.after_data ?? {};
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter(
      (key) => !sensitive.test(key) && JSON.stringify(before[key]) !== JSON.stringify(after[key]),
    )
    .map((key) => ({ key, before: display(before[key]), after: display(after[key]) }));
}
export function AuditPanel({ model }: { model: ReturnType<typeof useAccessManagement> }) {
  const { auditQuery, auditOffset, setAuditOffset, auditActors, auditScope } = model;
  const { resources } = useRecordCatalog();
  const user = useAuthUser();
  return (
    <div className="ui-stack">
      {(auditScope.entity || auditScope.record) && (
        <p>
          Historie vybraného záznamu ·{" "}
          <a href="/app/settings/access?section=audit" className="underline">
            Celá historie
          </a>
        </p>
      )}
      {auditQuery.isLoading ? (
        <p>Načítám historii…</p>
      ) : auditQuery.isError ? (
        <ErrorState
          error={auditQuery.error}
          action={
            <Button variant="outline" onClick={() => auditQuery.refetch()}>
              Zkusit znovu
            </Button>
          }
        />
      ) : !auditQuery.data?.length ? (
        <EmptyState title="Na této stránce nejsou žádné změny" />
      ) : (
        <ol className="record-list">
          {auditQuery.data.map((event) => {
            const resource = resources.find((item) => item.id === event.entity_type);
            const fields = {
              ...commonFields,
              ...Object.fromEntries(
                (resource?.readFields ?? []).map((field) => [field.name, field.label]),
              ),
            };
            const actor =
              event.actor_user_id === user?.id
                ? user.display_name || user.username
                : event.actor_user_id
                  ? (auditActors.data?.[event.actor_user_id] ?? "Uživatel")
                  : "Systém";
            return (
              <li key={event.id} className="p-3 border-b border-(--color-border) last:border-0">
                <p className="font-semibold">
                  {operations[event.operation.toLowerCase()] ?? "Změna"} ·{" "}
                  {resource?.title ?? entities[event.entity_type] ?? "Záznam"}
                </p>
                <p className="text-sm text-(--color-muted-foreground)">
                  {actor}
                  {event.actor_role_code ? ` · ${roleLabel(event.actor_role_code)}` : ""} ·{" "}
                  <time dateTime={event.created_at}>{dateLabel(event.created_at, true)}</time>
                </p>
                <details className="mt-1">
                  <summary className="min-h-11 cursor-pointer py-3">Zobrazit změnu</summary>
                  {changes(event).length ? (
                    <dl className="audit-changes">
                      {changes(event).map((change) => (
                        <div key={change.key}>
                          <dt>{fields[change.key] ?? change.key}</dt>
                          <dd>
                            <span>Před: {change.before}</span>
                            <span>Po: {change.after}</span>
                          </dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <p>Podrobnosti hodnot nejsou u této události k dispozici.</p>
                  )}
                  <details className="mt-2 text-sm">
                    <summary className="min-h-11 cursor-pointer py-3">Technické údaje</summary>
                    <p className="break-all">
                      Událost: {event.event_code}
                      <br />
                      Záznam: {event.entity_type} · {event.entity_id ?? "—"}
                      <br />
                      Uživatel: {event.actor_user_id ?? "Systém"}
                    </p>
                  </details>
                </details>
              </li>
            );
          })}
        </ol>
      )}
      <Pagination
        label="Stránkování historie"
        offset={auditOffset}
        count={auditQuery.data?.length ?? 0}
        pending={auditQuery.isFetching}
        onChange={setAuditOffset}
      />
    </div>
  );
}
