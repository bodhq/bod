"use client";

import type { useChildren } from "../hooks/useChildren";

import { Button } from "@/core/ui/actions/Button";
import { EmptyState } from "@/core/ui/feedback/EmptyState";
import { ErrorState } from "@/core/ui/feedback/ErrorState";
import { Select } from "@/core/ui/forms/Select";

export function ChildPicker({
  value,
  onChange,
  query,
  all = false,
}: {
  value: string;
  onChange: (value: string) => void;
  query: ReturnType<typeof useChildren>["children"];
  all?: boolean;
}) {
  if (query.isError)
    return (
      <ErrorState
        title="Děti se nepodařilo načíst"
        error={query.error}
        action={
          <Button variant="outline" onClick={() => query.refetch()}>
            Zkusit znovu
          </Button>
        }
      />
    );
  if (!query.isPending && !query.data?.length)
    return (
      <EmptyState title="Nemáte propojené dítě">
        Propojení rodiče a žáka nastavuje správce školy.
      </EmptyState>
    );
  return (
    <Select
      label="Dítě"
      value={value}
      disabled={query.isPending}
      onChange={(event) => onChange(event.target.value)}
    >
      {query.isPending && <option value="">Načítám děti…</option>}
      {all && <option value="">Všechny děti</option>}
      {(query.data ?? []).map((child) => (
        <option key={child.student_id} value={child.student_id}>
          {child.name}
        </option>
      ))}
    </Select>
  );
}
