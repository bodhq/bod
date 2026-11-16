"use client";
import type { Row } from "@/modules/shared/records/types";

import { Button } from "@/core/ui/actions/Button";
import { ErrorState } from "@/core/ui/feedback/ErrorState";
import { LoadingState } from "@/core/ui/feedback/LoadingState";
import { PanelHeader } from "@/core/ui/layout/Panel";

import { usePlanningPreferences } from "../hooks/usePlanningPreferences";
import { options } from "../preference-options";
import { PriorityEditor } from "./PriorityEditor";

export function PlanningPreferences({ version }: { version: Row }) {
  const { query } = usePlanningPreferences({ version });
  if (query.isPending) return <LoadingState>Načítám priority návrhu…</LoadingState>;
  if (query.isError)
    return (
      <ErrorState
        error={query.error}
        action={
          <Button variant="outline" onClick={() => query.refetch()}>
            Zkusit znovu
          </Button>
        }
      />
    );
  return (
    <section className="ui-stack">
      <PanelHeader
        eyebrow="Pravidla návrhu"
        title="Priority rozvrhu"
        description="Uložte důležitost jednotlivých priorit pro tento návrh. Samotné nastavení hodiny nepřesouvá. Rozložení předmětů a vhodné časy sledujte při ruční práci na plátně."
      />
      <div className="grid gap-4 lg:grid-cols-3">
        {options.map((option) => {
          const current = query.data.find(
            (row) => row.timetable_version_id === version.id && row.code === option.code,
          );
          return (
            <PriorityEditor
              key={`${option.code}:${current?.weight}`}
              option={option}
              current={current}
              version={version}
            />
          );
        })}
      </div>
    </section>
  );
}
