"use client";
import type { FieldDefinition, Row } from "@/modules/shared/records/types";

import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { useUnsavedChanges } from "@/core/hooks/useUnsavedChanges";
import { addDays } from "@/modules/shared/records/format";
import { useRecordScope } from "@/modules/shared/records/scope";

import { formDefaults, formPayload } from "../form-values";

export function useRecordForm({
  fields,
  initial = {},
  onSave,
  editing = false,
  onDirtyChange,
  useScopeDefaults = true,
}: {
  fields: FieldDefinition[];
  initial?: Row;
  onSave: (body: Row) => Promise<unknown>;
  editing?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
  useScopeDefaults?: boolean;
}) {
  const scope = useRecordScope();
  const [values, setValues] = useState<Row>(() =>
    formDefaults(
      fields,
      editing || !useScopeDefaults ? initial : { ...scope?.defaults, ...initial },
    ),
  );
  const interval =
    scope?.interval &&
    fields.some((field) => field.name === "valid_from") &&
    fields.some((field) => field.name === "valid_to") &&
    (!editing ||
      (String(initial.valid_from) >= scope.interval.start &&
        String(initial.valid_from) < scope.interval.end))
      ? scope.interval
      : null;
  const [wholeYear, setWholeYear] = useState(
    () =>
      !!interval &&
      values.valid_from === interval.start &&
      values.valid_to === addDays(interval.end, -1),
  );
  const [dirty, setDirty] = useState(false);
  useUnsavedChanges(dirty);
  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);
  const save = useMutation({
    mutationFn: async () => {
      try {
        return await onSave(formPayload(fields, values, editing));
      } catch (error) {
        if (
          error &&
          typeof error === "object" &&
          "issues" in error &&
          Array.isArray(error.issues)
        ) {
          const labels = error.issues.map(
            (issue: { path?: unknown[] }) =>
              fields.find((field) => field.name === issue.path?.[0])?.label ?? "Formulář",
          );
          throw new Error(`Zkontrolujte zadané hodnoty: ${[...new Set(labels)].join(", ")}.`);
        }
        throw error;
      }
    },
    onSuccess: () => setDirty(false),
  });
  const change = (field: string, value: unknown) => {
    setDirty(true);
    setValues((previous) => ({ ...previous, [field]: value }));
  };
  return {
    scope,
    values,
    setValues,
    interval,
    wholeYear,
    setWholeYear,
    dirty,
    setDirty,
    save,
    change,
  };
}
