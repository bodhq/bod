"use client";

import type { FieldDefinition } from "@/modules/shared/records/types";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useAuthUser } from "@/core/auth/store";
import { Button } from "@/core/ui/actions/Button";
import { Select } from "@/core/ui/forms/Select";
import {
  listAllRows,
  listRows,
  PAGE_SIZE,
  userOptions,
  workspaceKey,
} from "@/modules/shared/records/api";
import { useRecordCatalog } from "@/modules/shared/records/catalog";
import { rowLabel } from "@/modules/shared/records/format";
import {
  useRecordScope,
  useReferenceOptions,
  useReferenceScope,
} from "@/modules/shared/records/scope";

export function ReferenceField({
  field,
  value,
  onChange,
  disabled,
  applyScope = false,
}: {
  field: FieldDefinition;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  applyScope?: boolean;
}) {
  const { resources } = useRecordCatalog();
  const scope = useRecordScope();
  const user = useAuthUser();
  const referenceScope = useReferenceScope();
  const referenceOptions = useReferenceOptions();
  const filter =
    referenceScope[field.reference ?? ""] ??
    (applyScope ? scope?.referenceFilters?.[field.reference ?? ""] : undefined);
  const [offset, setOffset] = useState(0);
  const source = resources.find((resource) => resource.id === field.reference);
  const canRead = user?.permissions?.includes(source?.permission ?? "users.manage") ?? false;
  const query = useQuery({
    queryKey: [...workspaceKey, "reference", field.reference, offset, filter],
    queryFn: ({ signal }) =>
      source
        ? filter
          ? listAllRows(source, signal)
          : listRows(source, offset, signal)
        : userOptions(offset, signal),
    enabled: canRead,
  });
  if (!canRead) {
    const options = referenceOptions[field.reference ?? ""] ?? {};
    return (
      <Select
        label={field.label}
        description={
          Object.keys(options).length
            ? "Nabídka podle dostupného rozvrhu."
            : "Pro tento výběr nemáte dostupné údaje. Požádejte správce školy o jejich zpřístupnění."
        }
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={field.required}
        disabled={disabled}
      >
        <option value="">{field.required ? "Vyberte…" : "Nevybráno"}</option>
        {value && !options[value] && <option value={value}>Aktuální hodnota</option>}
        {Object.entries(options).map(([id, label]) => (
          <option key={id} value={id}>
            {label}
          </option>
        ))}
      </Select>
    );
  }
  const rows = query.data ?? [];
  const choices = filter
    ? rows.filter((row) => Object.entries(filter).every(([key, expected]) => row[key] === expected))
    : rows;
  return (
    <div className="space-y-2">
      <Select
        label={field.label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={field.required}
        disabled={disabled || query.isLoading}
      >
        <option value="">{query.isLoading ? "Načítám…" : "Vyberte…"}</option>
        {value && !choices.some((row) => String(row.id ?? row.code ?? row.group_id) === value) && (
          <option value={value}>{value}</option>
        )}
        {choices.map((row) => {
          const key = String(row.id ?? row.code ?? row.group_id);
          return (
            <option key={key} value={key}>
              {rowLabel(row)}
            </option>
          );
        })}
      </Select>
      {query.isError && (
        <p role="alert" className="text-sm text-(--color-destructive)">
          {query.error.message}{" "}
          <Button variant="outline" size="sm" onClick={() => query.refetch()}>
            Zkusit znovu
          </Button>
        </p>
      )}
      {!query.isLoading && !query.isError && !rows.length && (
        <p className="text-sm text-(--color-muted-foreground)">
          {source
            ? `Evidence „${source.title}“ je prázdná. Nejprve zde založte potřebný záznam.`
            : "Na této stránce nejsou žádné účty."}
        </p>
      )}
      {rows.length > 0 && choices.length === 0 && (
        <p className="text-sm text-(--color-muted-foreground)">
          Na této stránce nejsou záznamy pro vybraný školní rok.
        </p>
      )}
      {!filter && (offset > 0 || rows.length === PAGE_SIZE) && (
        <div className="flex items-center gap-2 text-xs">
          <Button
            size="sm"
            variant="outline"
            disabled={offset === 0 || query.isFetching}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
          >
            Předchozí
          </Button>
          <span>
            {offset + 1}–{offset + rows.length}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={rows.length < PAGE_SIZE || query.isFetching}
            onClick={() => setOffset(offset + PAGE_SIZE)}
          >
            Další
          </Button>
        </div>
      )}
    </div>
  );
}
