"use client";

import type { useTimetableStudio } from "../hooks/useTimetableStudio";

import { Button } from "@/core/ui/actions/Button";
import { Select } from "@/core/ui/forms/Select";
import { Panel } from "@/core/ui/layout/Panel";
import { removeRow } from "@/modules/shared/records/api";
import { rowLabel } from "@/modules/shared/records/format";

import { weekdays } from "../editor";
import { placementIssues } from "../planning";

type Model = Pick<
  ReturnType<typeof useTimetableStudio>,
  | "inspectedAssignment"
  | "label"
  | "selected"
  | "subject"
  | "inspected"
  | "slots"
  | "name"
  | "entries"
  | "assignments"
  | "context"
  | "writable"
  | "setEditor"
  | "setMoving"
  | "setInspectedId"
  | "confirm"
  | "resource"
  | "refresh"
  | "group"
  | "roomId"
  | "moving"
  | "setRoomId"
  | "planning"
  | "preferredTime"
  | "setPreferredTime"
  | "days"
  | "week"
>;
export function PlacementInspector({ model }: { model: Model }) {
  const {
    inspectedAssignment,
    label,
    selected,
    subject,
    inspected,
    slots,
    name,
    entries,
    assignments,
    context,
    writable,
    setEditor,
    setMoving,
    setInspectedId,
    confirm,
    resource,
    refresh,
    group,
    roomId,
    moving,
    setRoomId,
    planning,
    preferredTime,
    setPreferredTime,
    days,
    week,
  } = model;
  if (!week) return null;
  return (
    <Panel
      padded={false}
      as="aside"
      className="min-w-0 space-y-5 p-4"
      aria-label="Souvislosti hodiny"
    >
      <div>
        <p className="ui-eyebrow">Souvislosti</p>
        <h3 className="mt-1 font-semibold">
          {inspectedAssignment
            ? label(inspectedAssignment)
            : selected
              ? subject(selected)
              : "Pomocník při plánování"}
        </h3>
      </div>
      {inspected && inspectedAssignment ? (
        <>
          <p className="text-sm">
            {weekdays[Number(inspected.day_of_week) - 1]} ·{" "}
            {String(slots.find((row) => row.id === inspected.time_slot_id)?.position)}. hodina
          </p>
          <p className="text-sm text-(--color-muted-foreground)">
            {inspected.room_id
              ? name(inspected.room_id, "rooms", "Učebna")
              : "Učebna není přiřazená"}
          </p>
          {placementIssues(inspected, entries, assignments, context).map((issue) => (
            <p key={issue} className="text-sm text-(--color-destructive)">
              ! {issue}
            </p>
          ))}
          {writable && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditor({ initial: inspected, existing: inspected })}
              >
                Upravit hodinu
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setMoving(inspected);
                  setInspectedId("");
                }}
              >
                Přesunout
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  confirm({
                    title: "Odebrat hodinu z rozvrhu?",
                    description:
                      "Přiřazení výuky zůstane zachované. Odeberete pouze toto umístění.",
                    confirmLabel: "Odebrat",
                    destructive: true,
                    onConfirm: async () => {
                      await removeRow(resource, inspected);
                      await refresh();
                      setInspectedId("");
                    },
                  })
                }
              >
                Odebrat
              </Button>
            </div>
          )}
          <Button variant="outline" size="sm" onClick={() => setInspectedId("")}>
            Zpět k výběru výuky
          </Button>
        </>
      ) : selected ? (
        <>
          <p className="text-sm text-(--color-muted-foreground)">
            {group(selected)}
            <br />
            {name(selected.teacher_id, "users", "Vyučující")}
          </p>
          <div className="border-t border-(--color-border) pt-4">
            <Select
              label="Umísťovat do učebny"
              value={roomId}
              disabled={!!moving}
              onChange={(event) => setRoomId(event.target.value)}
            >
              <option value="">Zvolím při umístění</option>
              {planning
                .rows("rooms")
                .filter((row) => row.is_active !== false)
                .map((row) => (
                  <option key={String(row.id)} value={String(row.id)}>
                    {rowLabel(row)} · {String(row.capacity)} míst
                    {row.room_type_code
                      ? ` · ${name(row.room_type_code, "room_types", "Typ")}`
                      : ""}
                  </option>
                ))}
            </Select>
            {!!selected.required_room_type_code && (
              <p className="mt-2 text-xs text-(--color-muted-foreground)">
                Požadavek: {name(selected.required_room_type_code, "room_types", "Typ")}
              </p>
            )}
          </div>
          <Select
            label="Vodítko pro tuto výuku"
            value={preferredTime}
            onChange={(event) => setPreferredTime(event.target.value)}
          >
            <option value="">Bez preference času</option>
            <option value="morning">Ráno · první 3 hodiny</option>
            <option value="afternoon">Později · od 5. hodiny</option>
          </Select>
          <p className="text-xs text-(--color-muted-foreground)">
            Vodítko zvýrazní vhodné časy při ruční práci. Nejde o závazné omezení a platí pro
            aktuální výběr.
          </p>
          <div className="border-t border-(--color-border) pt-4">
            <h4 className="text-sm font-semibold">Rozložení v týdnu</h4>
            <div className="mt-3 flex gap-2">
              {days.map((day, index) => {
                const count = entries.filter(
                  (row) =>
                    row.cycle_week_id === week.id &&
                    row.teaching_assignment_id === selected.id &&
                    Number(row.day_of_week) === index + 1,
                ).length;
                return (
                  <div className="min-w-0 flex-1 text-center" key={day}>
                    <div className="flex h-14 items-end justify-center rounded bg-(--color-surface-200)">
                      <div
                        className="w-full rounded bg-(--color-primary)/50"
                        style={{ height: `${Math.min(100, count * 25)}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs">{day.slice(0, 2)}</p>
                    <p className="text-xs font-semibold">{count}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        <div className="space-y-4 text-sm text-(--color-muted-foreground)">
          <p>1. Vyberte předmět a skupinu v zásobníku.</p>
          <p>2. Zvolte učebnu a časové vodítko.</p>
          <p>3. Plátno ukáže možné kolize ještě před uložením.</p>
          <p className="border-t border-(--color-border) pt-4 text-xs">
            Pro vyšší ročníky použijte filtr skupiny. Údaje o žácích rozhodují o překryvech, samotný
            název skupiny nestačí.
          </p>
        </div>
      )}
    </Panel>
  );
}
