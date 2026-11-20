import type { ReactNode } from "react";
import type { FieldDefinition, ResourceDefinition, Row } from "../types";

import { Badge } from "@/core/ui/feedback/Badge";

import { dateLabel, rowLabel } from "../format";

/** A compact comparison list; the record dialog retains every field. */
export function ResourceCanvas({
  resource,
  rows,
  columns,
  format,
  actions,
}: {
  resource: ResourceDefinition;
  rows: Row[];
  columns: FieldDefinition[];
  format: (field: FieldDefinition, value: unknown) => string;
  actions: (row: Row) => ReactNode;
}) {
  return (
    <ul className="record-list" aria-label={`Přehled: ${resource.title}`}>
      {rows.map((row) => {
        const key = resource.keys.map((field) => String(row[field])).join(":");
        const reference = columns.find((field) => field.reference && row[field.name] != null);
        const heading =
          row.name || row.topic || row.reason || row.code
            ? rowLabel(row)
            : reference
              ? format(reference, row[reference.name])
              : row.calendar_date
                ? dateLabel(String(row.calendar_date))
                : resource.title;
        const facts = columns
          .filter(
            (field) =>
              !["id", "name", "topic", "reason", "status"].includes(field.name) &&
              row[field.name] != null &&
              field !== reference,
          )
          .slice(0, 4);
        return (
          <li key={key} className="record-list-item">
            <div className="record-list-content">
              <div className="record-list-heading">
                <h3>{heading}</h3>
                {row.status != null && (
                  <Badge>
                    {format(
                      {
                        name: "status",
                        label: "Stav",
                        type: "string",
                        required: false,
                        nullable: false,
                      },
                      row.status,
                    )}
                  </Badge>
                )}
              </div>
              <dl className="record-list-facts">
                {facts.map((field) => (
                  <div key={field.name}>
                    <dt>{field.label}</dt>
                    <dd>{format(field, row[field.name])}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <fieldset className="record-list-actions">
              <legend className="sr-only">{`Akce: ${heading}`}</legend>
              {actions(row)}
            </fieldset>
          </li>
        );
      })}
    </ul>
  );
}
