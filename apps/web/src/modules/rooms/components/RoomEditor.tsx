"use client";
import type { Row } from "@/modules/shared/records/types";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import { useUnsavedChanges } from "@/core/hooks/useUnsavedChanges";
import { ErrorState } from "@/core/ui/feedback/ErrorState";
import { Checkbox } from "@/core/ui/forms/Checkbox";
import { FormActions } from "@/core/ui/forms/FormActions";
import { Input } from "@/core/ui/forms/Input";
import { Select } from "@/core/ui/forms/Select";
import { useConfirm } from "@/core/ui/overlays/ConfirmProvider";
import { Dialog } from "@/core/ui/overlays/Dialog";
import { rowLabel } from "@/modules/shared/records/format";

export function RoomEditor({
  initial,
  types,
  onSave,
  onClose,
}: {
  initial?: Row;
  types: Row[];
  onSave: (values: Row) => Promise<void>;
  onClose: () => void;
}) {
  const [code, setCode] = useState(String(initial?.code ?? "")),
    [name, setName] = useState(String(initial?.name ?? "")),
    [capacity, setCapacity] = useState(String(initial?.capacity ?? 30)),
    [type, setType] = useState(String(initial?.room_type_code ?? "")),
    [active, setActive] = useState(initial?.is_active !== false);
  const confirm = useConfirm();
  const changed =
    code !== String(initial?.code ?? "") ||
    name !== String(initial?.name ?? "") ||
    capacity !== String(initial?.capacity ?? 30) ||
    type !== String(initial?.room_type_code ?? "") ||
    active !== (initial?.is_active !== false);
  const save = useMutation({
    mutationFn: () =>
      onSave({
        code: code.trim(),
        name: name.trim() || null,
        capacity: Number(capacity),
        room_type_code: type,
        is_active: active,
      }),
  });
  useUnsavedChanges(changed && !save.isSuccess);
  const close = () => {
    if (save.isPending) return;
    if (changed && !save.isSuccess)
      confirm({
        title: "Zahodit rozpracovanou učebnu?",
        description: "Změny nejsou uložené.",
        confirmLabel: "Zahodit změny",
        onConfirm: onClose,
      });
    else onClose();
  };
  return (
    <Dialog open title={initial ? "Upravit učebnu" : "Nová učebna"} onClose={close}>
      <form
        className="ui-stack mt-5"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Zkratka"
            placeholder="Např. 201"
            required
            maxLength={30}
            value={code}
            disabled={save.isPending}
            onChange={(event) => setCode(event.target.value)}
          />
          <Input
            label="Název"
            placeholder="Např. Chemická laboratoř"
            maxLength={100}
            value={name}
            disabled={save.isPending}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <Select
          label="Typ učebny"
          required
          value={type}
          disabled={save.isPending}
          onChange={(event) => setType(event.target.value)}
        >
          <option value="">Vyberte využití prostoru…</option>
          {type && !types.some((row) => row.code === type) && <option value={type}>{type}</option>}
          {types.map((row) => (
            <option key={String(row.code)} value={String(row.code)}>
              {rowLabel(row)}
            </option>
          ))}
        </Select>
        {!types.length && (
          <p className="text-sm text-(--color-warning)">
            Nejprve založte typ učebny v přehledu učeben. Potom sem prostor zařaďte.
          </p>
        )}
        <Input
          label="Kapacita"
          type="number"
          min={1}
          step={1}
          required
          value={capacity}
          disabled={save.isPending}
          onChange={(event) => setCapacity(event.target.value)}
        />
        <Checkbox
          label="Učebna je v provozu"
          checked={active}
          disabled={save.isPending}
          onChange={(event) => setActive(event.target.checked)}
        />
        {save.isError && <ErrorState error={save.error} />}
        <FormActions
          onCancel={close}
          pending={save.isPending}
          disabled={
            !code.trim() || !type || !Number.isInteger(Number(capacity)) || Number(capacity) < 1
          }
          submitLabel="Uložit učebnu"
        />
      </form>
    </Dialog>
  );
}
