"use client";

import type { FieldDefinition } from "@/modules/shared/records/types";

import { Checkbox } from "@/core/ui/forms/Checkbox";
import { Input } from "@/core/ui/forms/Input";
import { Select } from "@/core/ui/forms/Select";
import { Textarea } from "@/core/ui/forms/Textarea";
import { ReferenceField } from "@/modules/shared/records/components/ReferenceField";
import { valueLabels } from "@/modules/shared/records/format";

import { ParametersField } from "./ParametersField";

export function RecordField({
  field,
  value,
  onChange,
  applyScope,
}: {
  field: FieldDefinition;
  value: unknown;
  onChange: (value: unknown) => void;
  applyScope?: boolean;
}) {
  if (field.reference)
    return (
      <ReferenceField
        field={field}
        value={String(value ?? "")}
        onChange={onChange}
        applyScope={applyScope}
      />
    );
  if (field.type === "boolean")
    return (
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <Checkbox checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} />
        {field.label}
      </label>
    );
  const options =
    field.options ??
    (field.name === "day_of_week" ? ["1", "2", "3", "4", "5", "6", "7"] : undefined);
  if (options)
    return (
      <Select
        label={field.label}
        value={String(value ?? "")}
        required={field.required}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Vyberte…</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {field.name === "day_of_week"
              ? ["Pondělí", "Úterý", "Středa", "Čtvrtek", "Pátek", "Sobota", "Neděle"][
                  Number(option) - 1
                ]
              : (field.optionLabels?.[option] ?? valueLabels[option] ?? option)}
          </option>
        ))}
      </Select>
    );
  if (field.type === "object")
    return <ParametersField label={field.label} value={value} onChange={onChange} />;
  if (["description", "note", "topic", "reason", "decision_note"].includes(field.name))
    return (
      <Textarea
        label={field.label}
        value={String(value ?? "")}
        onChange={(event) => onChange(event.target.value)}
        required={field.required}
        maxLength={field.maxLength}
      />
    );
  return (
    <Input
      label={field.label}
      type={
        field.type === "date-time"
          ? "datetime-local"
          : ["date", "time"].includes(field.type)
            ? field.type
            : ["integer", "number"].includes(field.type)
              ? "number"
              : "text"
      }
      step={field.type === "number" ? "any" : undefined}
      value={String(value ?? "")}
      onChange={(event) => onChange(event.target.value)}
      required={field.required}
      maxLength={field.maxLength}
      pattern={
        field.type === "uuid"
          ? "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
          : undefined
      }
      min={field.min ?? (field.name === "position" ? 1 : undefined)}
      max={field.max}
    />
  );
}
