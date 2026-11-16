"use client";

import type { useTimetableStudio } from "../hooks/useTimetableStudio";

import { Button } from "@/core/ui/actions/Button";
import { Checkbox } from "@/core/ui/forms/Checkbox";
import { Input } from "@/core/ui/forms/Input";
import { Panel } from "@/core/ui/layout/Panel";

import { assignmentProgress } from "../editor";

type Model = Pick<
  ReturnType<typeof useTimetableStudio>,
  | "search"
  | "setSearch"
  | "remainingOnly"
  | "setRemainingOnly"
  | "backlog"
  | "week"
  | "data"
  | "selected"
  | "setAssignmentId"
  | "setMoving"
  | "setInspectedId"
  | "setRoomId"
  | "setPreferredTime"
  | "subject"
  | "group"
  | "name"
>;
export function TeachingBacklog({ model }: { model: Model }) {
  const {
    search,
    setSearch,
    remainingOnly,
    setRemainingOnly,
    backlog,
    week,
    data,
    selected,
    setAssignmentId,
    setMoving,
    setInspectedId,
    setRoomId,
    setPreferredTime,
    subject,
    group,
    name,
  } = model;
  if (!week) return null;
  return (
    <Panel
      padded={false}
      as="aside"
      className="min-w-0 space-y-4 p-4"
      aria-label="Výuka k rozmístění"
    >
      <div>
        <p className="ui-eyebrow">Zásobník výuky</p>
        <h3 className="mt-1 font-semibold">Co ještě umístit</h3>
      </div>
      <Input
        label="Hledat výuku"
        placeholder="Předmět nebo skupina…"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <label className="flex items-center gap-2 text-xs">
        <Checkbox
          checked={remainingOnly}
          onChange={(event) => setRemainingOnly(event.target.checked)}
        />
        Jen neumístěné
      </label>
      <div className="planner-backlog">
        {backlog.map((assignment) => {
          const item = assignmentProgress(assignment.id, week.id, data.workloads);
          return (
            <Button
              key={String(assignment.id)}
              variant="choice"
              aria-pressed={assignment.id === selected?.id}
              className="w-full justify-start py-3"
              contentClassName="w-full flex-col items-start gap-1"
              onClick={() => {
                setAssignmentId(String(assignment.id));
                setMoving(null);
                setInspectedId("");
                setRoomId("");
                setPreferredTime("");
              }}
            >
              <span className="block w-full text-sm font-semibold">{subject(assignment)}</span>
              <span className="flex w-full flex-wrap justify-between gap-2 text-xs">
                <span>Umístěno</span>
                <span className="tabular-nums">
                  {item.placed} / {item.required ?? "?"}
                </span>
              </span>
              <span className="text-xs">{group(assignment)}</span>
              <span className="text-xs opacity-75">
                {name(assignment.teacher_id, "users", "Vyučující")}
              </span>
              {!!assignment.required_room_type_code && (
                <span className="planner-room-tag">
                  {name(assignment.required_room_type_code, "room_types", "Typ")}
                </span>
              )}
            </Button>
          );
        })}
      </div>
      {!backlog.length && (
        <p className="text-sm text-(--color-muted-foreground)">
          Výběru neodpovídá žádná výuka. Úvazky nastavíte v přípravě.
        </p>
      )}
    </Panel>
  );
}
