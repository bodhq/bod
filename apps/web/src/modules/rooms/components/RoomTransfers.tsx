"use client";

import { ArrowRight, LockKeyhole, Map as MapIcon, Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { useAuthStore } from "@/core/auth/store";
import { Button } from "@/core/ui/actions/Button";
import { Badge } from "@/core/ui/feedback/Badge";
import { EmptyState } from "@/core/ui/feedback/EmptyState";
import { ErrorState } from "@/core/ui/feedback/ErrorState";
import { LoadingState } from "@/core/ui/feedback/LoadingState";
import { Select } from "@/core/ui/forms/Select";
import { Panel, PanelHeader } from "@/core/ui/layout/Panel";

import { directionCount, roomCount } from "../connections";
import { useRoomTransfers } from "../hooks/useRoomTransfers";
import { transferCoverage } from "../transfer-draft";
import "../transfers.css";
import { DistanceModelDialog } from "./DistanceModelDialog";
import { TransferCoverage, TransferLegend } from "./TransferCoverage";
import { TransferDetails } from "./TransferDetails";
import { TransferSetup } from "./TransferSetup";

export function RoomTransfers() {
  const editor = useRoomTransfers();
  const sessionVersion = useAuthStore((state) => state.sessionVersion);
  const [setup, setSetup] = useState<"new" | "existing" | null>(null);
  const [rename, setRename] = useState(false);
  const [startRoomId, setStartRoomId] = useState<string>();
  const { model, rooms, models, locked, mutation } = editor;
  if (!editor.allowed) return <EmptyState title="K přesunům učeben nemáte oprávnění" />;
  if (editor.loading) return <LoadingState>Načítám učebny a jejich přesuny…</LoadingState>;
  if (editor.error)
    return (
      <ErrorState
        title="Přesuny se nepodařilo načíst"
        error={editor.error}
        action={
          <Button variant="outline" onClick={editor.retry}>
            Zkusit znovu
          </Button>
        }
      />
    );
  if (rooms.length < 2)
    return (
      <EmptyState
        title="Nejprve přidejte alespoň dvě učebny"
        description="Potom vás provedeme nastavením přesunů mezi nimi."
        action={
          <Link href="/app/rooms?evidence=rooms" className="nav-link">
            Přejít na učebny <ArrowRight size={16} />
          </Link>
        }
      />
    );
  const ids = new Set(rooms.map((room) => room.id));
  const connections = editor.connections.filter(
    (edge) => ids.has(edge.from_room_id) && ids.has(edge.to_room_id),
  );
  const possible = rooms.length * (rooms.length - 1);
  const missing = Math.max(0, possible - connections.length);
  const coverage = transferCoverage(rooms, connections);
  const openSetup = (mode: "new" | "existing", id?: string) => {
    setStartRoomId(id);
    setSetup(mode);
  };
  return (
    <section className="ui-stack transfer-studio" aria-label="Vizuální editor přesunů">
      <PanelHeader title="Přesuny mezi učebnami" />
      {!model ? (
        <Panel>
          <EmptyState
            icon={<MapIcon size={28} />}
            title="Postavte plán školy"
            description="Rozmístěte učebny do budov a pater. Několik pravidel oblastí připraví přesuny pro celou školu; zvláštní případy upravíte jako výjimky."
            action={<Button onClick={() => openSetup("new")}>Nastavit přesuny</Button>}
          />
        </Panel>
      ) : (
        <>
          <div className="transfer-model-bar">
            {models.length > 1 ? (
              <Select
                label="Nastavení přesunů"
                value={model.id}
                onChange={(event) => editor.chooseModel(event.target.value)}
                disabled={mutation.isPending}
              >
                {models.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                    {item.frozen_at ? " · uzamčené" : ""}
                  </option>
                ))}
              </Select>
            ) : (
              <h3 className="font-semibold">{model.name}</h3>
            )}
            <div className="page-actions transfer-model-actions">
              {!locked && (
                <Button
                  variant="ghost"
                  disabled={mutation.isPending}
                  onClick={() => setRename(true)}
                >
                  <Pencil size={16} /> Přejmenovat
                </Button>
              )}
              <Button
                variant="outline"
                disabled={mutation.isPending}
                onClick={() => openSetup("new")}
              >
                <Plus size={16} /> Nové nastavení
              </Button>
            </div>
          </div>
          <div className="ui-stack transfer-overview">
            <div className="ui-stack">
              <div>
                <p className="ui-eyebrow">
                  {locked
                    ? "Uzamčené nastavení"
                    : missing
                      ? "Rozpracované přesuny"
                      : "Všechny směry jsou vyplněné"}
                </p>
                <h3 className="transfer-step-title">
                  {connections.length} z {possible} směrů nastaveno
                </h3>
                <p className="text-sm text-(--color-muted-foreground)">
                  {roomCount(rooms.length)}.{" "}
                  {missing
                    ? `Zbývá doplnit ${directionCount(missing)}. Nenastavený přesun není nulová náročnost.`
                    : "Náročnější přechody můžete upravit jednotlivě."}
                </p>
              </div>
              {locked ? (
                <Badge>
                  <LockKeyhole size={14} /> Pouze ke čtení
                </Badge>
              ) : (
                <Button className="self-start" onClick={() => openSetup("existing")}>
                  {connections.length ? "Upravit přesuny" : "Doplnit přesuny"}{" "}
                  <ArrowRight size={16} />
                </Button>
              )}
            </div>
            <TransferLegend />
            <TransferCoverage
              coverage={[...coverage]
                .sort((a, b) => b.counts.missing - a.counts.missing)
                .slice(0, 6)}
              onSelect={locked ? undefined : (id) => openSetup("existing", id)}
            />
            <p className="text-xs text-(--color-muted-foreground)">
              Každý pruh ukazuje náročnosti cest z dané učebny. Šrafování označuje chybějící směr.
              {rooms.length > 6 &&
                ` Zobrazeno 6 z ${rooms.length} učeben, nejprve ty s chybějícími přesuny.`}
            </p>
          </div>
          <details className="transfer-individual" key={model.id}>
            <summary>Prohlédnout uložené přesuny</summary>
            <TransferDetails
              rooms={rooms}
              connections={connections}
              onEdit={locked ? undefined : (id) => openSetup("existing", id)}
            />
          </details>
          {locked && (
            <p className="text-sm text-(--color-muted-foreground)">
              Toto nastavení je uzamčené. Pro další přípravu můžete vytvořit nové.
            </p>
          )}
          {locked && mutation.isError && (
            <ErrorState title="Změny nebylo možné dokončit" error={mutation.error} />
          )}
          {editor.notice && (
            <p role="status" className="text-sm text-(--color-success)">
              {editor.notice}
            </p>
          )}
        </>
      )}
      {setup && (
        <TransferSetup
          key={`${sessionVersion}:${setup}:${setup === "existing" ? model?.id : "new"}`}
          editor={editor}
          initial={setup === "existing" ? model : undefined}
          onClose={() => setSetup(null)}
          startRoomId={startRoomId}
        />
      )}
      {rename && model && (
        <DistanceModelDialog
          initial={model}
          onSave={editor.saveModel}
          onClose={() => setRename(false)}
        />
      )}
    </section>
  );
}
