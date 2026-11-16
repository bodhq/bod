"use client";

import type { LessonStudent, MarkAttendance } from "@bod/api-client/types.gen";

import { Check, Clock3, Ellipsis, LogOut, X } from "lucide-react";
import { Fragment, useState } from "react";

import { Button } from "@/core/ui/actions/Button";
import { Checkbox } from "@/core/ui/forms/Checkbox";
import { ChoiceGroup } from "@/core/ui/forms/ChoiceGroup";
import { Input } from "@/core/ui/forms/Input";
import { Select } from "@/core/ui/forms/Select";

const statuses = [
  { id: "present", title: "Přítomen", icon: Check },
  { id: "absent", title: "Chybí", icon: X },
  { id: "late", title: "Pozdě", icon: Clock3 },
  { id: "released_early", title: "Odchod", icon: LogOut },
] as const;

export function AttendanceRoster({
  participants,
  records,
  onChange,
  disabled = false,
}: {
  participants: LessonStudent[];
  records: MarkAttendance[];
  onChange: (id: string, patch: Partial<MarkAttendance>) => void;
  disabled?: boolean;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const byId = new Map(records.map((record) => [record.student_id, record]));
  const absent = records.filter((record) => record.status === "absent").length;
  const late = records.filter((record) => record.status === "late").length;
  const early = records.filter((record) => record.status === "released_early").length;
  return (
    <section className="attendance-roster" aria-label="Docházka hodiny">
      <div className="attendance-heading">
        <h3>
          Žáci a docházka <span>{participants.length}</span>
        </h3>
        <p role="status">
          {records.filter((record) => record.status === "present").length} přítomno
          {absent > 0 && (
            <>
              {" "}
              · <strong>{absent} chybí</strong>
            </>
          )}
          {late > 0 && <> · {late} pozdě</>}
          {early > 0 && <> · {early} odchod</>}
        </p>
      </div>
      <table className="attendance-table">
        <thead>
          <tr>
            <th scope="col" className="attendance-number">
              #
            </th>
            <th scope="col">Jméno žáka</th>
            <th scope="col">Účast</th>
            <th scope="col" className="attendance-minutes">
              Min.
            </th>
            <th scope="col">
              <span className="sr-only">Podrobnosti</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {participants.map((person, index) => {
            const value = byId.get(person.student_id);
            if (!value) return null;
            const locked = disabled || !!person.attendance?.is_excused;
            const showDetails = expanded[person.student_id] ?? false;
            const minutes =
              value.status === "late"
                ? "late_minutes"
                : value.status === "released_early"
                  ? "missed_minutes"
                  : null;
            const changeStatus = (status: MarkAttendance["status"]) =>
              onChange(person.student_id, {
                status,
                late_minutes: status === "late" ? (value.late_minutes ?? 5) : null,
                missed_minutes: status === "released_early" ? (value.missed_minutes ?? 5) : null,
              });
            const minuteInput = minutes && (
              <Input
                className="attendance-minute-input"
                type="number"
                aria-label={`${value.status === "late" ? "Zpoždění" : "Zameškané minuty"}: ${person.name}`}
                min={1}
                required
                disabled={locked}
                value={value[minutes] ?? ""}
                onChange={(event) =>
                  onChange(person.student_id, {
                    [minutes]: event.target.value === "" ? null : Number(event.target.value),
                  })
                }
              />
            );
            return (
              <Fragment key={person.student_id}>
                <tr data-status={value.status}>
                  <td className="attendance-number">{index + 1}</td>
                  <th scope="row" className="attendance-name">
                    {person.name}
                    {person.attendance?.is_excused ? (
                      <span className="attendance-excused">Omluveno</span>
                    ) : (
                      minutes && (
                        <span className="attendance-mobile-status">
                          {value.status === "late" ? "Pozdě" : "Odchod"} · {value[minutes] ?? "?"}{" "}
                          min
                        </span>
                      )
                    )}
                  </th>
                  <td className="attendance-choices">
                    <div className="attendance-desktop-choices">
                      <ChoiceGroup
                        label={`Účast: ${person.name}`}
                        optionContext={person.name}
                        value={value.status}
                        disabled={locked}
                        options={statuses.map((status) => ({
                          value: status.id,
                          label: status.title,
                          icon: <status.icon size={16} aria-hidden="true" />,
                          tone:
                            status.id === "absent"
                              ? "danger"
                              : status.id === "late"
                                ? "warning"
                                : status.id === "released_early"
                                  ? "info"
                                  : undefined,
                        }))}
                        onChange={changeStatus}
                      />
                    </div>
                    <div className="attendance-mobile-choice">
                      <Checkbox
                        label="Chybí"
                        aria-label={`Chybí: ${person.name}`}
                        checked={value.status === "absent"}
                        disabled={locked}
                        onChange={(event) =>
                          changeStatus(event.target.checked ? "absent" : "present")
                        }
                      />
                    </div>
                  </td>
                  <td className="attendance-minutes">
                    {minutes && (
                      <span className="attendance-mobile-minutes-label">
                        {value.status === "late" ? "Zpoždění (min)" : "Zameškané minuty"}
                      </span>
                    )}
                    {minuteInput}
                  </td>
                  <td className="attendance-note-toggle">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Podrobnosti: ${person.name}`}
                      aria-expanded={showDetails}
                      disabled={disabled}
                      onClick={() =>
                        setExpanded((current) => ({
                          ...current,
                          [person.student_id]: !showDetails,
                        }))
                      }
                    >
                      <Ellipsis size={18} aria-hidden="true" />
                      {value.note && <span className="attendance-note-dot" />}
                    </Button>
                  </td>
                </tr>
                {showDetails && (
                  <tr className="attendance-note-row">
                    <td colSpan={5}>
                      <div className="attendance-mobile-details">
                        <Select
                          label={`Stav docházky: ${person.name}`}
                          value={value.status}
                          disabled={locked}
                          onChange={(event) =>
                            changeStatus(event.target.value as MarkAttendance["status"])
                          }
                        >
                          {statuses.map((status) => (
                            <option key={status.id} value={status.id}>
                              {status.title}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <Input
                        label={`Interní poznámka: ${person.name}`}
                        value={value.note ?? ""}
                        maxLength={10000}
                        disabled={disabled}
                        onChange={(event) =>
                          onChange(person.student_id, { note: event.target.value || null })
                        }
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      {!disabled && (
        <p className="attendance-hint">
          Přítomnost je předvyplněná. U nepřítomných označte Chybí. Zpoždění, odchod a poznámku
          najdete v podrobnostech žáka.
        </p>
      )}
    </section>
  );
}
