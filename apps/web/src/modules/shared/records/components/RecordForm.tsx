"use client";
import type { FieldDefinition, Row } from "@/modules/shared/records/types";

import { ErrorState } from "@/core/ui/feedback/ErrorState";
import { SaveStatus } from "@/core/ui/feedback/SaveStatus";
import { Checkbox } from "@/core/ui/forms/Checkbox";
import { FormActions } from "@/core/ui/forms/FormActions";
import { addDays, dateLabel } from "@/modules/shared/records/format";

import { useRecordForm } from "../hooks/useRecordForm";
import { RecordField } from "./RecordField";

export function RecordForm({
  fields,
  initial = {},
  onSave,
  onCancel,
  label = "Uložit",
  editing = false,
  onDirtyChange,
  useScopeDefaults = true,
}: {
  fields: FieldDefinition[];
  initial?: Row;
  onSave: (body: Row) => Promise<unknown>;
  onCancel: () => void;
  label?: string;
  editing?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
  useScopeDefaults?: boolean;
}) {
  const {
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
  } = useRecordForm({ fields, initial, onSave, editing, onDirtyChange, useScopeDefaults });
  return (
    <form
      className="ui-stack"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <fieldset disabled={save.isPending} className="grid min-w-0 gap-4 sm:grid-cols-2">
        {interval && (
          <div className="space-y-2 sm:col-span-2">
            <label className="flex min-h-11 items-center gap-3 text-sm font-semibold">
              <Checkbox
                checked={wholeYear}
                onChange={(event) => {
                  setWholeYear(event.target.checked);
                  setDirty(true);
                  if (event.target.checked)
                    setValues((current) => ({
                      ...current,
                      valid_from: interval.start,
                      valid_to: addDays(interval.end, -1),
                    }));
                }}
              />
              Celý školní rok {interval.label}
            </label>
            <p className="text-sm text-(--color-muted-foreground)">
              {wholeYear
                ? `${dateLabel(interval.start)} – ${dateLabel(addDays(interval.end, -1))}.`
                : "Vlastní období použijte například při přestupu, změně skupiny nebo kratší platnosti rozvrhu."}
            </p>
          </div>
        )}
        {fields
          .filter(
            (field) => !wholeYear || !interval || !["valid_from", "valid_to"].includes(field.name),
          )
          .map((field) =>
            !editing && scope && field.name === "school_year_id" ? (
              <p key={field.name} className="text-sm sm:col-span-2">
                <span className="text-(--color-muted-foreground)">Školní rok: </span>
                {scope.interval.label}
              </p>
            ) : (
              <RecordField
                key={field.name}
                field={field}
                value={values[field.name]}
                onChange={(value) => change(field.name, value)}
                applyScope={!editing}
              />
            ),
          )}
      </fieldset>
      {save.isError && <ErrorState title="Změnu se nepodařilo uložit" error={save.error} />}
      <FormActions
        status={
          <SaveStatus
            dirty={dirty}
            pending={save.isPending}
            saved={save.isSuccess}
            error={save.isError}
          />
        }
        onCancel={onCancel}
        pending={save.isPending}
        submitLabel={save.isPending ? "Ukládám…" : label}
      />
    </form>
  );
}
