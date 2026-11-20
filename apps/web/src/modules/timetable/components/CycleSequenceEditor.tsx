"use client";
import type { Row } from "@/modules/shared/records/types";

import { monday } from "@/core/time/school";
import { Button } from "@/core/ui/actions/Button";
import { EmptyState } from "@/core/ui/feedback/EmptyState";
import { ErrorState } from "@/core/ui/feedback/ErrorState";
import { LoadingState } from "@/core/ui/feedback/LoadingState";
import { Input } from "@/core/ui/forms/Input";
import { Panel, PanelHeader } from "@/core/ui/layout/Panel";
import { request, resourcePath } from "@/modules/shared/records/api";
import { RecordDialog } from "@/modules/shared/records/components/RecordDialog";

import { cyclePhases } from "../cycle";
import { useCycleSequence } from "../hooks/useCycleSequence";
import { CommonTeachingBlocks } from "./CommonTeachingBlocks";
import { CyclePhaseTrack } from "./CyclePhaseTrack";
import { CyclePreview } from "./CyclePreview";

export function CycleSequenceEditor({
  plan,
  weeks,
  steps,
  onDirtyChange,
}: {
  plan: Row;
  weeks: Row[];
  steps: Row[];
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const studio = useCycleSequence({ plan, weeks, steps, onDirtyChange });
  const {
    getResource,
    refresh,
    draft,
    setDraft,
    anchor,
    setAnchor,
    editor,
    setEditor,
    saved,
    setSaved,
    phases,
    locked,
    positionsValid,
    valid,
    dirty,
    change,
    save,
  } = studio;
  return (
    <section className="ui-stack" aria-label="Návrhář opakování týdnů">
      <PanelHeader
        eyebrow="Rytmus školního roku"
        title="Opakování týdnů"
        description="Typ týdne je jedna podoba rozvrhu. Opakování určuje, kdy se která podoba použije. Běžná škola může mít jen týden A; při střídání výuky použijte A a B."
      />
      <Panel className="ui-stack">
        <PanelHeader
          title={
            <>
              <span className="visual-step-number">1</span>Jaké podoby rozvrhu potřebujete?
            </>
          }
          level="h3"
          description="Každý typ má vlastní hodiny a týdenní dotace."
          actions={
            !locked && (
              <Button variant="outline" onClick={() => setEditor({})}>
                Nový typ týdne
              </Button>
            )
          }
        />
        <div className="visual-cycle-types">
          {weeks.map((week, index) => (
            <article key={String(week.id)} className="visual-phase" data-tone={index % 3}>
              <strong className="text-3xl">{String(week.code)}</strong>
              <p className="mt-1 text-sm">{String(week.name ?? "Samostatná podoba rozvrhu")}</p>
              {!locked && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 self-start"
                  onClick={() => setEditor({ row: week })}
                >
                  Upravit typ
                </Button>
              )}
            </article>
          ))}
        </div>
        {!weeks.length && (
          <EmptyState title="Začněte jedním typem týdne">
            Pojmenujte ho třeba A. Další typ přidejte pouze tehdy, když se výuka mezi týdny liší.
          </EmptyState>
        )}
      </Panel>
      {weeks.length > 0 && (
        <>
          <div className="grid items-start gap-(--section-gap) xl:grid-cols-[minmax(0,1fr)_280px]">
            <Panel className="ui-stack min-w-0">
              {!positionsValid && draft === null && (
                <div className="ui-stack">
                  <p role="alert" className="text-sm text-(--color-warning)">
                    V uloženém pořadí chybí krok. Nejdřív opravte návaznost, potom bude náhled
                    odpovídat platnému cyklu.
                  </p>
                  {!locked && (
                    <Button variant="outline" onClick={() => change(cyclePhases(steps))}>
                      Opravit pořadí kroků
                    </Button>
                  )}
                </div>
              )}
              <div>
                <h3 className="font-semibold">
                  <span className="visual-step-number">2</span>Poskládejte opakování
                </h3>
                <p className="mt-2 text-sm text-(--color-muted-foreground)">
                  Čtěte zleva doprava. Za posledním krokem se cyklus vrací na začátek.
                </p>
              </div>
              {!locked && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    disabled={save.isPending}
                    onClick={() =>
                      change([
                        { key: crypto.randomUUID(), weekId: String(weeks[0]?.id), duration: 1 },
                      ])
                    }
                  >
                    Každý týden {String(weeks[0]?.code)}
                  </Button>
                  {weeks.length > 1 && (
                    <Button
                      variant="outline"
                      disabled={save.isPending}
                      onClick={() =>
                        change(
                          weeks.slice(0, 2).map((week) => ({
                            key: crypto.randomUUID(),
                            weekId: String(week.id),
                            duration: 1,
                          })),
                        )
                      }
                    >
                      Střídat {String(weeks[0]?.code)} / {String(weeks[1]?.code)}
                    </Button>
                  )}
                </div>
              )}
              <CyclePhaseTrack model={studio} />
              {!locked && (
                <Button
                  variant="outline"
                  className="self-start"
                  disabled={save.isPending}
                  onClick={() =>
                    change([
                      ...phases,
                      { key: crypto.randomUUID(), weekId: String(weeks[0]?.id), duration: 1 },
                    ])
                  }
                >
                  Přidat další krok
                </Button>
              )}
              <div className="flex flex-wrap items-end gap-4">
                <Input
                  label="První pondělí cyklu"
                  type="date"
                  fieldWidth="standard"
                  value={anchor}
                  disabled={locked || save.isPending}
                  onChange={(event) => {
                    setAnchor(event.target.value);
                    setSaved(false);
                  }}
                />
                <p className="pb-2 text-sm text-(--color-muted-foreground)">
                  Celé opakování: {phases.reduce((sum, phase) => sum + phase.duration, 0)} týdnů ↻
                </p>
              </div>
              {anchor && monday(anchor) !== anchor && (
                <p role="alert" className="text-sm text-(--color-warning)">
                  Zvolte pondělí. Vybrané datum je jiný den v týdnu.
                </p>
              )}
              {!locked && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    isLoading={save.isPending}
                    disabled={!valid || !dirty}
                    onClick={() => save.mutate()}
                  >
                    Uložit opakování
                  </Button>
                  {dirty && (
                    <Button
                      variant="outline"
                      disabled={save.isPending}
                      onClick={() => {
                        setDraft(null);
                        setAnchor(String(plan.cycle_anchor_monday ?? ""));
                      }}
                    >
                      Zahodit změny
                    </Button>
                  )}
                </div>
              )}
              {save.isError && (
                <ErrorState
                  title="Opakování není celé uložené. Nastavení zůstává rozepsané; uložení můžete opakovat."
                  error={save.error}
                />
              )}
              {saved && <LoadingState>Opakování je uložené.</LoadingState>}
            </Panel>
            <CyclePreview model={studio} />
          </div>
          <CommonTeachingBlocks model={studio} />
        </>
      )}
      {locked && (
        <p className="text-sm text-(--color-muted-foreground)">
          Plán je uzamčený. Cyklus je pouze ke čtení.
        </p>
      )}
      {editor && (
        <RecordDialog
          title={editor.row ? "Upravit typ týdne" : "Nový typ týdne"}
          editing={!!editor.row}
          initial={
            editor.row ?? {
              position: Math.max(0, ...weeks.map((week) => Number(week.position))) + 1,
            }
          }
          fields={getResource("teaching_cycle_weeks").fields.filter(
            (field) => field.name !== "teaching_plan_id",
          )}
          onClose={() => setEditor(null)}
          onSave={async (body) => {
            const resource = getResource("teaching_cycle_weeks");
            if (editor.row && resource.parsePatch)
              await request("PATCH", resourcePath(resource, editor.row), {
                body: resource.parsePatch(body),
              });
            else
              await request("POST", resource.path, {
                body: resource.parseCreate({ ...body, teaching_plan_id: plan.id }),
              });
            await refresh();
            setEditor(null);
          }}
        />
      )}
    </section>
  );
}
