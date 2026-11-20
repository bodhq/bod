"use client";

import type { useCycleSequence } from "../hooks/useCycleSequence";

import { dateLabel } from "@/core/time/school";

import { cyclePreview } from "../cycle";

type Model = Pick<
  ReturnType<typeof useCycleSequence>,
  "dirty" | "valid" | "anchor" | "phases" | "tone" | "code"
>;
export function CyclePreview({ model }: { model: Model }) {
  const { dirty, valid, anchor, phases, tone, code } = model;
  return (
    <section className="ui-stack xl:sticky xl:top-4">
      <div>
        <h3 className="font-semibold">
          <span className="visual-step-number">3</span>Náhled opakování
        </h3>
        <p className="mt-2 text-sm text-(--color-muted-foreground)">
          {dirty ? "Náhled rozepsaného nastavení" : "Náhled uloženého opakování"} · první pondělí
          každého týdne. Výjimky a prázdniny nastavíte v Kalendáři.
        </p>
      </div>
      {valid ? (
        <section className="visual-ribbon visual-cycle-preview" aria-label="Náhled dvanácti týdnů">
          {cyclePreview(anchor, phases).map((item) => (
            <div key={item.date} className="visual-phase" data-tone={tone(item.weekId ?? "")}>
              <span className="text-xs text-(--color-muted-foreground)">
                {dateLabel(item.date)}
              </span>
              <strong className="mt-2 text-2xl">{code(item.weekId ?? "")}</strong>
            </div>
          ))}
        </section>
      ) : (
        <p className="text-sm text-(--color-muted-foreground)">
          Poskládejte opakování a zvolte počáteční pondělí pro náhled.
        </p>
      )}
    </section>
  );
}
