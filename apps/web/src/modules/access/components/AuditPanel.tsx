"use client";

import type { useAccessManagement } from "../hooks/useAccessManagement";

import { EmptyState } from "@/core/ui/feedback/EmptyState";
import { ErrorState } from "@/core/ui/feedback/ErrorState";
export function AuditPanel({ model }: { model: ReturnType<typeof useAccessManagement> }) {
  const { auditQuery } = model;
  return (
    <div className="divide-y divide-(--color-border) rounded-[var(--radius)] border border-(--color-border)">
      {auditQuery.isLoading ? (
        <p className="p-4 text-sm text-(--color-muted-foreground)">Načítám historii…</p>
      ) : auditQuery.isError ? (
        <ErrorState error={auditQuery.error} />
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
        <EmptyState title="Zatím zde nejsou žádné změny." />
      )}
    </div>
  );
}
