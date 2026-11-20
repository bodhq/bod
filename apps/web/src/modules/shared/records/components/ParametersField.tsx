"use client";

import { useState } from "react";

import { Button } from "@/core/ui/actions/Button";
import { Input } from "@/core/ui/forms/Input";

export function ParametersField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const [rows, setRows] = useState(() =>
    (value && typeof value === "object" ? Object.entries(value) : []).map(([name, item]) => ({
      id: crypto.randomUUID(),
      name,
      value: item,
    })),
  );
  const update = (next: typeof rows) => {
    setRows(next);
    onChange(Object.fromEntries(next.map((entry) => [entry.name, entry.value])));
  };
  return (
    <fieldset className="space-y-3 sm:col-span-2">
      <legend className="text-sm font-semibold">{label}</legend>
      {rows.map((entry, index) => (
        <div key={entry.id} className="flex gap-2">
          <Input
            aria-label={`Název nastavení ${index + 1}`}
            value={entry.name}
            onChange={(event) =>
              update(
                rows.map((row) =>
                  row.id === entry.id ? { ...row, name: event.target.value } : row,
                ),
              )
            }
          />
          <Input
            aria-label={`Hodnota nastavení ${index + 1}`}
            value={String(entry.value)}
            onChange={(event) => {
              const raw = event.target.value;
              update(
                rows.map((row) =>
                  row.id === entry.id
                    ? {
                        ...row,
                        value:
                          raw === "true"
                            ? true
                            : raw === "false"
                              ? false
                              : raw !== "" && Number.isFinite(Number(raw))
                                ? Number(raw)
                                : raw,
                      }
                    : row,
                ),
              );
            }}
          />
          <Button
            aria-label={`Odebrat nastavení ${index + 1}`}
            variant="outline"
            onClick={() => update(rows.filter((row) => row.id !== entry.id))}
          >
            Odebrat
          </Button>
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        onClick={() =>
          update([...rows, { id: crypto.randomUUID(), name: `volba${rows.length + 1}`, value: "" }])
        }
      >
        Přidat nastavení
      </Button>
    </fieldset>
  );
}
