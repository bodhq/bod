"use client";
import type { Row } from "@/modules/shared/records/types";

import { useState } from "react";

import { Button } from "@/core/ui/actions/Button";
import { EmptyState } from "@/core/ui/feedback/EmptyState";
import { ErrorState } from "@/core/ui/feedback/ErrorState";
import { LoadingState } from "@/core/ui/feedback/LoadingState";
import { FormActions } from "@/core/ui/forms/FormActions";
import { Input } from "@/core/ui/forms/Input";
import { StepProgress } from "@/core/ui/navigation/StepProgress";
import { Dialog } from "@/core/ui/overlays/Dialog";
import { removeRow, request, resourcePath } from "@/modules/shared/records/api";
import { RecordDialog } from "@/modules/shared/records/components/RecordDialog";

import { clockMinutes, clockTime } from "../bell-schedule";
import { useBellSchedule } from "../hooks/useBellSchedule";

export function BellSchedule({ grid, readOnly = false }: { grid: Row; readOnly?: boolean }) {
  const [review, setReview] = useState(false);
  const {
    resource,
    refresh,
    confirm,
    query,
    slots,
    building,
    setBuilding,
    started,
    start,
    setStart,
    count,
    setCount,
    duration,
    setDuration,
    pause,
    setPause,
    longPause,
    setLongPause,
    longAfter,
    setLongAfter,
    editor,
    setEditor,
    preview,
    previewError,
    create,
    add,
  } = useBellSchedule({ grid, readOnly });
  if (query.isPending) return <LoadingState>Načítám zvonění…</LoadingState>;
  if (query.isError) return <ErrorState error={query.error} />;
  return (
    <section className="ui-stack">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold">Průběh vyučovacího dne</h3>
          <p className="mt-2 text-sm text-(--color-muted-foreground)">
            Hodiny a přestávky v pořadí, v jakém za sebou následují. Toto zvonění se použije v
            návrhu rozvrhu.
          </p>
        </div>
        {!readOnly && (
          <div className="flex flex-wrap gap-2">
            {(!slots.length || started) && (
              <Button
                onClick={() => {
                  setReview(started);
                  setBuilding(true);
                  create.reset();
                }}
              >
                {started ? "Dokončit vytvoření dne" : "Připravit celý den"}
              </Button>
            )}
            <Button variant="outline" disabled={started} onClick={add}>
              Přidat jednu hodinu
            </Button>
          </div>
        )}
      </div>
      {!slots.length ? (
        <EmptyState title="Zvonění zatím není nastavené">
          Zvolte začátek výuky, počet hodin a délku přestávek. Celý den nejprve uvidíte v náhledu.
        </EmptyState>
      ) : (
        <ol className="space-y-2">
          {slots.map((slot, index) => {
            const gap =
              index > 0
                ? clockMinutes(String(slot.start_time)) -
                  clockMinutes(String(slots[index - 1]?.end_time))
                : 0;
            return (
              <li key={String(slot.id)}>
                {gap > 0 && (
                  <p className="px-5 py-2 text-sm text-(--color-muted-foreground)">
                    Přestávka {gap} min
                  </p>
                )}
                <div className="ui-panel flex flex-wrap items-center justify-between gap-3 p-5">
                  <div className="flex items-center gap-5">
                    <span className="flex size-11 items-center justify-center rounded-full bg-(--color-surface-200) font-semibold">
                      {String(slot.position)}.
                    </span>
                    <div>
                      <p className="font-semibold tabular-nums">
                        {String(slot.start_time).slice(0, 5)} – {String(slot.end_time).slice(0, 5)}
                      </p>
                      <p className="mt-1 text-sm text-(--color-muted-foreground)">
                        {clockMinutes(String(slot.end_time)) -
                          clockMinutes(String(slot.start_time))}{" "}
                        minut výuky
                      </p>
                    </div>
                  </div>
                  {!readOnly && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setEditor({ row: slot, initial: slot })}
                      >
                        Upravit čas
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() =>
                          confirm({
                            title: "Odebrat vyučovací hodinu?",
                            description:
                              "Hodinu odeberete ze zvonění. Pokud už je použitá v rozvrhu, aplikace změnu nepovolí.",
                            confirmLabel: "Odebrat",
                            destructive: true,
                            onConfirm: async () => {
                              await removeRow(resource, slot);
                              await refresh();
                            },
                          })
                        }
                      >
                        Odebrat
                      </Button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
      <Dialog
        open={building}
        title="Připravit celý vyučovací den"
        description="Nastavte obvyklý průběh dne. Před uložením zkontrolujte náhled níže."
        onClose={() => {
          if (!create.isPending) setBuilding(false);
        }}
      >
        <div className="mt-5 space-y-5">
          <StepProgress
            steps={["Nastavit den", "Zkontrolovat zvonění"]}
            current={review || started ? 1 : 0}
          />
          {!review && !started && (
            <fieldset
              disabled={create.isPending || started}
              className="grid gap-(--section-gap) sm:grid-cols-2"
            >
              <Input
                label="Začátek výuky"
                type="time"
                value={start}
                onChange={(event) => setStart(event.target.value)}
              />
              <Input
                label="Počet hodin"
                type="number"
                min={1}
                max={12}
                value={count}
                onChange={(event) => setCount(Number(event.target.value))}
              />
              <Input
                label="Délka hodiny (minuty)"
                type="number"
                min={15}
                max={180}
                value={duration}
                onChange={(event) => setDuration(Number(event.target.value))}
              />
              <Input
                label="Běžná přestávka (minuty)"
                type="number"
                min={0}
                max={90}
                value={pause}
                onChange={(event) => setPause(Number(event.target.value))}
              />
              <Input
                label="Velká přestávka po hodině"
                type="number"
                min={0}
                max={count}
                value={longAfter}
                description="Nula znamená bez velké přestávky."
                onChange={(event) => setLongAfter(Number(event.target.value))}
              />
              <Input
                label="Velká přestávka (minuty)"
                type="number"
                min={0}
                max={120}
                value={longPause}
                onChange={(event) => setLongPause(Number(event.target.value))}
              />
            </fieldset>
          )}
          <div className="ui-panel p-4">
            <h4 className="font-semibold">Náhled dne</h4>
            <ol className="mt-3 grid gap-2 sm:grid-cols-2">
              {preview.map((row) => (
                <li key={row.position} className="text-sm tabular-nums">
                  {row.position}. hodina · {row.start_time.slice(0, 5)}–{row.end_time.slice(0, 5)}
                </li>
              ))}
            </ol>
            {previewError && (
              <p role="alert" className="mt-2 text-sm text-(--color-destructive)">
                {previewError}
              </p>
            )}
          </div>
          {create.isError && (
            <ErrorState
              title="Den se nepodařilo dokončit. Uložené hodiny zůstaly zachované; můžete pokračovat."
              error={create.error}
            />
          )}
          <FormActions
            onCancel={() => setBuilding(false)}
            onBack={review && !started ? () => setReview(false) : undefined}
            backLabel="Zpět k nastavení"
            disabled={!!previewError}
            pending={create.isPending}
            onSubmit={() => (review || started ? create.mutate() : setReview(true))}
            submitLabel={
              started ? "Dokončit uložení" : review ? "Použít toto zvonění" : "Zkontrolovat zvonění"
            }
          />
        </div>
      </Dialog>
      {editor && (
        <RecordDialog
          title={editor.row ? "Upravit vyučovací hodinu" : "Přidat vyučovací hodinu"}
          fields={[
            {
              name: "start_time",
              label: "Začátek hodiny",
              type: "time",
              required: true,
              nullable: false,
            },
            {
              name: "end_time",
              label: "Konec hodiny",
              type: "time",
              required: true,
              nullable: false,
            },
          ]}
          initial={editor.initial}
          editing={!!editor.row}
          useScopeDefaults={false}
          onClose={() => setEditor(null)}
          onSave={async (body) => {
            const begins = clockMinutes(String(body.start_time)),
              ends = clockMinutes(String(body.end_time));
            if (ends <= begins) throw new Error("Hodina musí skončit později, než začíná.");
            if (
              slots.some(
                (slot) =>
                  slot.id !== editor.row?.id &&
                  begins < clockMinutes(String(slot.end_time)) &&
                  clockMinutes(String(slot.start_time)) < ends,
              )
            )
              throw new Error("Čas se překrývá s jinou vyučovací hodinou.");
            const values = { start_time: clockTime(begins), end_time: clockTime(ends) };
            if (editor.row && resource.parsePatch)
              await request("PATCH", resourcePath(resource, editor.row), {
                body: resource.parsePatch(values),
              });
            else
              await request("POST", resource.path, {
                body: resource.parseCreate({
                  ...values,
                  time_grid_id: grid.id,
                  position: editor.initial.position,
                }),
              });
            await refresh();
            setEditor(null);
          }}
        />
      )}
    </section>
  );
}
