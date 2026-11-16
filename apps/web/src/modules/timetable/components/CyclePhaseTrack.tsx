"use client";

import type { CyclePhase } from "../cycle";
import type { useCycleSequence } from "../hooks/useCycleSequence";

import { Button } from "@/core/ui/actions/Button";
import { Input } from "@/core/ui/forms/Input";
import { Select } from "@/core/ui/forms/Select";

type Model = Pick<
  ReturnType<typeof useCycleSequence>,
  "phases" | "tone" | "locked" | "save" | "change" | "weeks"
>;
export function CyclePhaseTrack({ model }: { model: Model }) {
  const { phases, tone, locked, save, change, weeks } = model;
  return (
    <div className="visual-cycle-track">
      {phases.map((phase, index) => (
        <div
          key={phase.key}
          className="visual-phase visual-cycle-step"
          data-tone={tone(phase.weekId)}
        >
          <p className="ui-eyebrow mb-3">Krok {index + 1}</p>
          <Select
            label="Podoba rozvrhu"
            value={phase.weekId}
            disabled={locked || save.isPending}
            onChange={(event) =>
              change(
                phases.map((item) =>
                  item.key === phase.key ? { ...item, weekId: event.target.value } : item,
                ),
              )
            }
          >
            {weeks.map((week) => (
              <option key={String(week.id)} value={String(week.id)}>
                Týden {String(week.code)}
              </option>
            ))}
          </Select>
          <Input
            className="mt-3"
            label="Týdnů za sebou"
            type="number"
            min={1}
            step={1}
            value={phase.duration || ""}
            disabled={locked || save.isPending}
            onChange={(event) =>
              change(
                phases.map((item) =>
                  item.key === phase.key ? { ...item, duration: Number(event.target.value) } : item,
                ),
              )
            }
          />
          {!locked && (
            <div className="mt-3 flex flex-wrap gap-1">
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Posunout krok ${index + 1} doleva`}
                disabled={index === 0 || save.isPending}
                onClick={() => {
                  const next = [...phases];
                  [next[index - 1], next[index]] = [phase, phases[index - 1] as CyclePhase];
                  change(next);
                }}
              >
                ←
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={save.isPending}
                onClick={() => change(phases.filter((item) => item.key !== phase.key))}
              >
                Odebrat
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
