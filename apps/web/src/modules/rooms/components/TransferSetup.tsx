"use client";

import type { RoomDistanceModelsRead } from "@bod/api-client/types.gen";
import type { useRoomTransfers } from "../hooks/useRoomTransfers";

import { Building2, Check, GitBranch } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/core/ui/actions/Button";
import { ErrorState } from "@/core/ui/feedback/ErrorState";
import { FormActions } from "@/core/ui/forms/FormActions";
import { Input } from "@/core/ui/forms/Input";
import { StepProgress } from "@/core/ui/navigation/StepProgress";
import { ViewSwitcher } from "@/core/ui/navigation/ViewSwitcher";
import { useConfirm } from "@/core/ui/overlays/ConfirmProvider";
import { Dialog } from "@/core/ui/overlays/Dialog";

import { useTransferSetup } from "../hooks/useTransferSetup";
import "../school-plan.css";
import { RoomTransferBoard } from "./RoomTransferBoard";
import { SchoolPlanEditor } from "./SchoolPlanEditor";
import { TransferReview } from "./TransferReview";

const titles = [
  "Pojmenujte nastavení",
  "Rozmístěte školu a nastavte pravidla oblastí",
  "Zkontrolujte přesuny celé školy",
];
export function TransferSetup({
  editor,
  initial,
  onClose,
  startRoomId,
}: {
  editor: ReturnType<typeof useRoomTransfers>;
  initial?: RoomDistanceModelsRead;
  onClose: () => void;
  startRoomId?: string;
}) {
  const setup = useTransferSetup(editor, initial, onClose, startRoomId);
  const [view, setView] = useState(startRoomId ? "exceptions" : "plan");
  const heading = useRef<HTMLHeadingElement>(null);
  const confirm = useConfirm();
  const { stage, step, stages, save } = setup;
  useEffect(() => {
    if (stage >= 0) heading.current?.focus();
  }, [stage]);
  const close = () => {
    if (save.isPending) return;
    if (save.isSuccess) {
      onClose();
      return;
    }
    if (setup.started)
      confirm({
        title: "Zavřít rozpracované nastavení?",
        description:
          setup.persisted || editor.progress.done > 0
            ? "Dosud uložené přesuny zůstanou zachované. Zbytek přesunů bude nutné dokončit; rozložení si můžete exportovat."
            : "Příprava zatím není uložená.",
        confirmLabel: "Zavřít přípravu",
        onConfirm: onClose,
      });
    else onClose();
  };
  const inspect = (id: string) => {
    setView("exceptions");
    setup.setOriginId(id);
    setup.setStep(initial ? 0 : 1);
  };
  const total = editor.rooms.length * (editor.rooms.length - 1);
  return (
    <Dialog
      open
      title={initial ? "Upravit přesuny" : "Nastavit přesuny ve škole"}
      onClose={close}
      className={`transfer-setup-dialog ${stage === 1 && view === "plan" ? "school-plan-dialog" : ""}`}
    >
      <form
        className="transfer-setup ui-stack"
        onSubmit={(event) => {
          event.preventDefault();
          if (!setup.canContinue || save.isPending) return;
          if (stage === 2) save.mutate();
          else setup.setStep(step + 1);
        }}
      >
        <StepProgress steps={stages} current={step} />
        <div className="ui-stack transfer-setup-content">
          <div className={stage === 1 ? "sr-only" : undefined}>
            <h3 ref={heading} tabIndex={-1} className="transfer-step-title">
              {titles[stage]}
            </h3>
            <p className="text-sm text-(--color-muted-foreground)">
              {
                [
                  "Nastavení pak vyberete při přípravě rozvrhu. Školu popíšete budovami a patry; přesuny se odvodí z jejich pravidel.",
                  "Přidejte budovy a patra, rozmístěte učebny. Pravidla uvnitř patra, mezi patry a mezi budovami pokryjí celou školu. Jednotlivé přesuny upravíte ve výjimkách.",
                  "Barvy ukazují náročnost, šrafování chybějící směry. Zkontrolujte výjimky a případná místa, která jste přehlédli.",
                ][stage]
              }
            </p>
          </div>
          {stage === 0 && (
            <Input
              label="Název nastavení"
              required
              maxLength={100}
              value={setup.name}
              onChange={(event) => setup.setName(event.target.value)}
            />
          )}
          {stage === 1 && (
            <>
              <div className="transfer-setup-nav">
                <ViewSwitcher
                  label="Způsob přípravy přesunů"
                  items={[
                    { id: "plan", title: "Plán školy", icon: Building2 },
                    { id: "exceptions", title: "Jednotlivé výjimky", icon: GitBranch },
                  ]}
                  value={view}
                  onChange={setView}
                />
                <p className="transfer-board-progress" role="status">
                  {view === "plan" ? "Učebny v plánu:" : "Zařazeno"}{" "}
                  <strong>
                    {view === "plan"
                      ? editor.rooms.length - setup.unplaced.length
                      : total - setup.missing}{" "}
                    / {view === "plan" ? editor.rooms.length : total}
                  </strong>{" "}
                  {view === "plan" ? "· bez umístění" : "směrů · chybí"}{" "}
                  <strong>{view === "plan" ? setup.unplaced.length : setup.missing}</strong>
                </p>
              </div>
              {setup.localReady &&
                (view === "plan" ? (
                  <SchoolPlanEditor
                    setup={setup}
                    rooms={editor.rooms}
                    existing={!!initial && editor.connections.length > 0}
                  />
                ) : (
                  <RoomTransferBoard setup={setup} rooms={editor.rooms} />
                ))}
            </>
          )}
          {stage === 2 && (
            <TransferReview
              setup={setup}
              rooms={editor.rooms}
              saved={editor.connections}
              onInspect={inspect}
            />
          )}
          {save.isError && (
            <ErrorState
              title="Přípravu se nepodařilo dokončit"
              message={`${save.error.message} Potvrzené změny zůstanou uložené. Opakováním se ověří stav a dokončí zbytek.`}
            />
          )}
          {setup.storageFailed && (
            <ErrorState
              title="Plán a přesuny se uložily, místní kopie nastavení ne"
              message="Prohlížeč odmítl uložení pravidel a výjimek pro toto nastavení. Před zavřením si je exportujte."
              action={
                <Button variant="outline" onClick={setup.exportPlan}>
                  Exportovat rozložení
                </Button>
              }
            />
          )}
          {save.isPending && (
            <p role="status" className="text-sm">
              {editor.mutation.isPending
                ? `Ukládám ${editor.progress.done} z ${editor.progress.total} směrů…`
                : "Připravuji nastavení…"}
            </p>
          )}
        </div>
        <FormActions
          className="transfer-setup-actions"
          onCancel={save.isSuccess ? undefined : close}
          onBack={step > 0 ? () => setup.setStep(step - 1) : undefined}
          backDisabled={save.submittedAt > 0}
          pending={save.isPending}
          disabled={!save.isSuccess && !setup.canContinue}
          onSubmit={save.isSuccess ? onClose : undefined}
          submitLabel={
            save.isSuccess ? (
              "Hotovo"
            ) : stage === 2 ? (
              <>
                <Check size={16} aria-hidden="true" />{" "}
                {save.isError
                  ? "Dokončit uložení"
                  : setup.missing
                    ? "Uložit rozpracované"
                    : "Uložit přesuny"}
              </>
            ) : (
              "Pokračovat"
            )
          }
        />
      </form>
    </Dialog>
  );
}
