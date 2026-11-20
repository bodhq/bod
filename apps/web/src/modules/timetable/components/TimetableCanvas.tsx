"use client";

import type { useTimetableStudio } from "../hooks/useTimetableStudio";

import { placementAdvice, placementIssues } from "../planning";

type Model = Pick<
  ReturnType<typeof useTimetableStudio>,
  | "days"
  | "visibleEntries"
  | "slots"
  | "candidate"
  | "selected"
  | "entries"
  | "assignments"
  | "context"
  | "preferredTime"
  | "inspectedId"
  | "setInspectedId"
  | "subject"
  | "group"
  | "name"
  | "writable"
  | "moving"
  | "place"
>;
export function TimetableCanvas({ model }: { model: Model }) {
  const {
    days,
    visibleEntries,
    slots,
    candidate,
    selected,
    entries,
    assignments,
    context,
    preferredTime,
    inspectedId,
    setInspectedId,
    subject,
    group,
    name,
    writable,
    moving,
    place,
  } = model;
  return (
    <div className="planner-canvas">
      <table
        aria-label="Editor týdenního rozvrhu"
        className="w-full min-w-[680px] table-fixed border-collapse text-left"
      >
        <thead>
          <tr>
            <th scope="col" className="w-16 p-3 text-xs text-(--color-muted-foreground)">
              Hodina
            </th>
            {days.map((day, index) => (
              <th key={day} scope="col" className="p-3 text-center text-sm font-semibold">
                <span>{day}</span>
                <span className="mt-1 block text-xs font-normal text-(--color-muted-foreground)">
                  {visibleEntries.filter((row) => Number(row.day_of_week) === index + 1).length}{" "}
                  hodin
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {slots.map((slot) => (
            <tr key={String(slot.id)} className="border-t border-(--color-border)">
              <th scope="row" className="p-2 align-top">
                <p className="text-sm font-semibold">{String(slot.position)}.</p>
                <p className="mt-1 text-xs font-normal tabular-nums text-(--color-muted-foreground)">
                  {String(slot.start_time).slice(0, 5)}
                  <br />
                  {String(slot.end_time).slice(0, 5)}
                </p>
              </th>
              {days.map((day, index) => {
                const cell = visibleEntries.filter(
                  (row) => Number(row.day_of_week) === index + 1 && row.time_slot_id === slot.id,
                );
                const preview = candidate(index + 1, String(slot.id));
                const issues = selected
                  ? placementIssues(preview, entries, assignments, context)
                  : [];
                const advice = selected
                  ? placementAdvice(preview, entries, assignments, context, preferredTime)
                  : [];
                return (
                  <td key={day} className="p-1 align-top">
                    <div
                      className={`planner-slot ${selected ? (issues.length ? "planner-slot-conflict" : advice.length ? "planner-slot-advice" : "planner-slot-clear") : ""}`}
                    >
                      {cell.map((entry) => {
                        const assignment = assignments.find(
                          (row) => row.id === entry.teaching_assignment_id,
                        );
                        const warnings = placementIssues(entry, entries, assignments, context);
                        return (
                          <button
                            key={String(entry.id)}
                            type="button"
                            aria-pressed={inspectedId === entry.id}
                            className={`planner-lesson ${warnings.length ? "planner-lesson-conflict" : ""}`}
                            onClick={() => setInspectedId(String(entry.id))}
                          >
                            <span className="flex items-start justify-between gap-1">
                              <strong>{assignment ? subject(assignment) : "Výuka"}</strong>
                              {!!entry.is_locked && <span title="Zamčené umístění">●</span>}
                            </span>
                            <span>{assignment ? group(assignment) : "Skupina"}</span>
                            <span className="opacity-75">
                              {entry.room_id
                                ? name(entry.room_id, "rooms", "Učebna")
                                : "Bez učebny"}
                            </span>
                            {warnings.length > 0 && (
                              <span className="font-semibold text-(--color-destructive)">
                                ! {warnings[0]}
                              </span>
                            )}
                          </button>
                        );
                      })}
                      {writable && (
                        <button
                          type="button"
                          aria-label={`${moving ? "Přesunout do" : "Přidat hodinu"}: ${day}, ${slot.position}. hodina`}
                          title={[...issues, ...advice].join(". ") || "Otevřít umístění hodiny"}
                          className="planner-place"
                          disabled={!assignments.length}
                          onClick={() => place(index + 1, String(slot.id))}
                        >
                          <span>
                            {selected
                              ? issues.length
                                ? "! Prověřit místo"
                                : moving
                                  ? "Sem přesunout"
                                  : "+ Umístit"
                              : "+"}
                          </span>
                          {selected && (issues.length > 0 || advice.length > 0) && (
                            <span className="text-[11px] font-normal">
                              {issues[0] ?? advice[0]}
                            </span>
                          )}
                        </button>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
