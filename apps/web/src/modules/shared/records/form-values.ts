import type { FieldDefinition, Row } from "@/modules/shared/records/types";

import { addDays, localInstant, schoolInstant } from "@/modules/shared/records/format";

export function formDefaults(fields: FieldDefinition[], initial: Row): Row {
  return Object.fromEntries(
    fields.map((field) => {
      const value =
        initial[field.name] ?? field.defaultValue ?? (field.type === "boolean" ? false : "");
      return [
        field.name,
        field.type === "date-time" && value
          ? localInstant(String(value))
          : field.exclusiveEnd && value
            ? addDays(String(value), -1)
            : value,
      ];
    }),
  );
}

export function normalizeTime(value: string, label: string): string {
  const match = /^(\d{2}):(\d{2})(?::(\d{2})(\.\d+)?)?$/.exec(value);
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59 || Number(match[3] ?? 0) > 59)
    throw new Error(`Pole „${label}“ musí obsahovat platný čas.`);
  return `${match[1]}:${match[2]}:${match[3] ?? "00"}${match[4] ?? ""}`;
}

export function formPayload(fields: FieldDefinition[], values: Row, editing = false): Row {
  const result: Row = {};
  for (const field of fields) {
    const value = values[field.name];
    if (value === "" || value === undefined) {
      if (editing && field.nullable) result[field.name] = null;
      else if (field.required) throw new Error(`Vyplňte pole „${field.label}“.`);
      continue;
    }
    result[field.name] =
      field.type === "integer" || field.type === "number"
        ? Number(value)
        : field.type === "date-time"
          ? schoolInstant(String(value))
          : field.type === "time"
            ? normalizeTime(String(value), field.label)
            : field.exclusiveEnd
              ? addDays(String(value), 1)
              : value;
    if (field.type === "integer" && !Number.isInteger(result[field.name]))
      throw new Error(`Pole „${field.label}“ vyžaduje celé číslo.`);
    if (field.name === "position" && Number(result[field.name]) < 1)
      throw new Error(`Pole „${field.label}“ musí být alespoň 1.`);
  }
  if (
    typeof result.start_time === "string" &&
    typeof result.end_time === "string" &&
    result.end_time <= result.start_time
  )
    throw new Error("Konec hodiny musí být později než její začátek.");
  for (const [start, end] of [
    ["starts_on", "ends_on"],
    ["valid_from", "valid_to"],
  ] as const) {
    if (
      typeof result[start] === "string" &&
      typeof result[end] === "string" &&
      String(result[end]) <= String(result[start])
    )
      throw new Error("Poslední den nesmí předcházet prvnímu dni platnosti.");
  }
  return result;
}
