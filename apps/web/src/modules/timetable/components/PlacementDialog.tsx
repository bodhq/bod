"use client";

import type { Row } from "@/modules/shared/records/types";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/core/ui/actions/Button";
import { ErrorState } from "@/core/ui/feedback/ErrorState";
import { Checkbox } from "@/core/ui/forms/Checkbox";
import { Input } from "@/core/ui/forms/Input";
import { Select } from "@/core/ui/forms/Select";
import { Dialog } from "@/core/ui/overlays/Dialog";
import { rowLabel } from "@/modules/shared/records/format";

import { weekdays } from "../editor";
import { type PlanningContext, placementAdvice, placementIssues } from "../planning";

export function PlacementDialog({
  initial,
  existing,
  assignments,
  entries,
  context,
  roomsAvailable,
  label,
  preferredTime,
  onClose,
  onSave,
}: {
  initial: Row;
  existing?: Row;
  assignments: Row[];
  entries: Row[];
  context: PlanningContext;
  roomsAvailable: boolean;
  label: (row: Row) => string;
  preferredTime: string;
  onClose: () => void;
  onSave: (values: Row) => Promise<void>;
}) {
  const [assignmentId, setAssignmentId] = useState(String(initial.teaching_assignment_id ?? ""));
  const [roomId, setRoomId] = useState(String(initial.room_id ?? ""));
  const [locked, setLocked] = useState(Boolean(initial.is_locked));
  const values = {
    ...initial,
    teaching_assignment_id: assignmentId,
    room_id: roomId || null,
    is_locked: locked,
  };
  const issues = assignmentId ? placementIssues(values, entries, assignments, context) : [];
  const advice = placementAdvice(values, entries, assignments, context, preferredTime);
  const slot = context.slots.find((row) => row.id === initial.time_slot_id);
  const save = useMutation({ mutationFn: () => onSave(values) });
  return (
    <Dialog
      open
      title={existing ? "Upravit hodinu" : "Umístit hodinu"}
      description={`${weekdays[Number(initial.day_of_week) - 1]} · ${slot?.position}. hodina · ${String(slot?.start_time).slice(0, 5)}–${String(slot?.end_time).slice(0, 5)}`}
      onClose={() => {
        if (!save.isPending) onClose();
      }}
    >
      <form
        className="mt-5 space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        <Select
          label="Výuka"
          required
          value={assignmentId}
          disabled={save.isPending}
          onChange={(event) => setAssignmentId(event.target.value)}
        >
          <option value="">Vyberte výuku…</option>
          {assignments.map((row) => (
            <option key={String(row.id)} value={String(row.id)}>
              {label(row)}
            </option>
          ))}
        </Select>
        {roomsAvailable ? (
          <Select
            label="Učebna"
            value={roomId}
            disabled={save.isPending}
            onChange={(event) => setRoomId(event.target.value)}
          >
            <option value="">Bez přiřazené učebny</option>
            {context.rooms.map((row) => (
              <option key={String(row.id)} value={String(row.id)}>
                {rowLabel(row)} · {String(row.capacity)} míst · {String(row.room_type_code)}
              </option>
            ))}
          </Select>
        ) : (
          <Input
            label="Učebna"
            description="Jmenný seznam učeben není pro tuto roli dostupný. Pole můžete ponechat prázdné."
            value={roomId}
            disabled={save.isPending}
            onChange={(event) => setRoomId(event.target.value)}
          />
        )}
        {issues.length > 0 && (
          <div role="alert" className="rounded-lg bg-(--color-destructive)/5 p-4">
            <p className="font-semibold text-(--color-destructive)">Tady vzniká kolize</p>
            <ul className="mt-2 list-inside list-disc text-sm text-(--color-destructive)">
              {issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs">
              Upravte výuku či učebnu, nebo vyberte jiné místo na plátně.
            </p>
          </div>
        )}
        {advice.map((item) => (
          <p key={item} className="text-sm text-(--color-warning)">
            {item}
          </p>
        ))}
        <label className="flex items-center gap-3 text-sm">
          <Checkbox
            checked={locked}
            disabled={save.isPending}
            onChange={(event) => setLocked(event.target.checked)}
          />
          Zamknout umístění pro další plánování
        </label>
        {save.isError && <ErrorState error={save.error} />}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" disabled={save.isPending} onClick={onClose}>
            Zrušit
          </Button>
          <Button
            type="submit"
            disabled={!assignmentId || !!issues.length}
            isLoading={save.isPending}
          >
            Uložit
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
