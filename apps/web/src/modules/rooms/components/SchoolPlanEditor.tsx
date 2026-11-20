"use client";

import type { RoomsRead } from "@bod/api-client/types.gen";
import type { useTransferSetup } from "../hooks/useTransferSetup";
import type { SchoolAreaTarget } from "./SchoolAreaDialog";

import { Building2, ChevronDown, Download, Ellipsis, Plus, Undo2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/core/ui/actions/Button";
import { ErrorState } from "@/core/ui/feedback/ErrorState";
import { Checkbox } from "@/core/ui/forms/Checkbox";
import { Input } from "@/core/ui/forms/Input";
import { Select } from "@/core/ui/forms/Select";
import { useConfirm } from "@/core/ui/overlays/ConfirmProvider";

import { displayCost } from "../connections";
import { placeRooms, planLocations } from "../school-plan";
import { SchoolAreaDialog } from "./SchoolAreaDialog";
import { SchoolCanvas } from "./SchoolCanvas";
import { SchoolRoomChip } from "./SchoolRoomChip";

export function SchoolPlanEditor({
  setup,
  rooms,
  existing,
}: {
  setup: ReturnType<typeof useTransferSetup>;
  rooms: RoomsRead[];
  existing: boolean;
}) {
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [target, setTarget] = useState<SchoolAreaTarget | null>(null);
  const [error, setError] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const options = useRef<HTMLDetailsElement>(null);
  const confirm = useConfirm();
  useEffect(() => {
    const closeOptions = (event: PointerEvent) => {
      if (
        options.current?.open &&
        event.target instanceof Node &&
        !options.current.contains(event.target)
      )
        options.current.open = false;
    };
    document.addEventListener("pointerdown", closeOptions);
    return () => document.removeEventListener("pointerdown", closeOptions);
  }, []);
  const { plan } = setup;
  const disabled = setup.save.submittedAt > 0;
  const locations = planLocations(plan);
  const unplaced = rooms.filter((room) => !locations.has(room.id));
  const matches = unplaced.filter((room) =>
    `${room.code} ${room.name ?? ""}`
      .toLocaleLowerCase("cs")
      .includes(search.toLocaleLowerCase("cs")),
  );
  const pages = Math.max(1, Math.ceil(matches.length / 12));
  const currentPage = Math.min(page, pages - 1);
  const visible = matches.slice(currentPage * 12, (currentPage + 1) * 12);
  const select = (id: string) =>
    setSelected((previous) =>
      previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id],
    );
  const move = (floorId: string | null, draggedId?: string) => {
    if (disabled) return;
    const ids = draggedId && !selected.includes(draggedId) ? [draggedId] : selected;
    if (!ids.length || ids.some((id) => !rooms.some((room) => room.id === id))) return;
    setup.changePlan(placeRooms(plan, ids, floorId));
    setSelected([]);
    setLibraryOpen(false);
  };
  const remove = (buildingId: string, floorId?: string) => {
    const building = plan.buildings.find((item) => item.id === buildingId);
    if (!building) return;
    const area = floorId ? building.floors.find((item) => item.id === floorId) : building;
    if (!area) return;
    confirm({
      title: `Odebrat ${area.name} z plánu?`,
      description: "Učebny se vrátí mezi neumístěné. Jejich záznamy ve škole zůstanou zachované.",
      confirmLabel: "Odebrat z plánu",
      destructive: true,
      onConfirm: () => {
        setup.changePlan(
          floorId
            ? {
                ...plan,
                buildings: plan.buildings.map((item) =>
                  item.id === buildingId
                    ? { ...item, floors: item.floors.filter((floor) => floor.id !== floorId) }
                    : item,
                ),
              }
            : {
                ...plan,
                buildings: plan.buildings.filter((item) => item.id !== buildingId),
                links: plan.links.filter(
                  (item) => item.from !== buildingId && item.to !== buildingId,
                ),
              },
        );
        setSelected([]);
      },
    });
  };
  return (
    <div className="ui-stack school-plan-editor">
      <div
        className="page-actions school-plan-toolbar"
        data-has-buildings={plan.buildings.length > 0}
      >
        {plan.buildings.length > 0 && (
          <Button
            variant="outline"
            disabled={disabled || plan.buildings.length >= 30}
            onClick={() => setTarget({ kind: "building" })}
          >
            <Plus size={16} /> Přidat budovu
          </Button>
        )}
        {plan.buildings.length > 0 && (
          <Button
            variant="choice"
            disabled={disabled}
            onClick={() => setTarget({ kind: "betweenBuildings" })}
          >
            <Building2 size={16} /> Mezi budovami školy{" "}
            <strong className="school-cost-value">{displayCost(plan.betweenBuildings)}</strong>
          </Button>
        )}
        {(plan.buildings.length > 0 || setup.canUndo) && (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Vrátit úpravu"
            title="Vrátit úpravu"
            disabled={!setup.canUndo || disabled}
            onClick={() => {
              setup.undo();
              setSelected([]);
            }}
          >
            <Undo2 size={16} />
          </Button>
        )}
        <details
          ref={options}
          className="school-plan-options"
          onKeyDown={(event) => {
            if (event.key === "Escape" && event.currentTarget.open) {
              event.stopPropagation();
              event.currentTarget.open = false;
            }
          }}
        >
          <summary className="nav-link" aria-label="Další možnosti" title="Další možnosti">
            <Ellipsis size={20} />
            <span className="sr-only">Další možnosti</span>
          </summary>
          <div className="school-plan-options-content ui-stack">
            <Button
              variant="ghost"
              size="sm"
              disabled={!plan.buildings.length}
              onClick={() => {
                setup.exportPlan();
                if (options.current) options.current.open = false;
              }}
            >
              <Download size={14} /> Exportovat rozložení
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={disabled}
              onClick={() => {
                file.current?.click();
                if (options.current) options.current.open = false;
              }}
            >
              <Upload size={14} /> Načíst rozložení
            </Button>
            {existing && (
              <div className="ui-stack">
                <Checkbox
                  label="Přepočítat pravidly i již uložené přesuny"
                  checked={setup.applyExisting}
                  disabled={disabled}
                  onChange={(event) => setup.changeApplyExisting(event.target.checked)}
                />
                <p className="text-sm text-(--color-muted-foreground)">
                  {setup.applyExisting
                    ? "Před uložením uvidíte všechny přepsané hodnoty. Ručně zadané výjimky v této přípravě mají přednost."
                    : setup.hasBaseline
                      ? "Přesuny původně odvozené z tohoto plánu se aktualizují. Ostatní uložené náročnosti zůstanou zachované."
                      : "Pravidla doplní chybějící směry; uložené náročnosti zůstanou zachované."}
                </p>
              </div>
            )}
            <p className="school-local-note">
              Budovy, patra a umístění učeben se uloží do sdílené evidence školy. Pravidla
              náročnosti patří k tomuto nastavení přesunů.
            </p>
          </div>
        </details>
        <input
          ref={file}
          className="sr-only"
          type="file"
          accept=".json,application/json"
          aria-label="Soubor rozložení školy"
          disabled={disabled}
          onChange={async (event) => {
            const uploaded = event.target.files?.[0];
            event.target.value = "";
            if (!uploaded) return;
            try {
              if (uploaded.size > 2_000_000) throw new Error("Soubor rozložení je příliš velký.");
              setup.importPlan(await uploaded.text());
              setError("");
              setSelected([]);
            } catch (cause) {
              setError(
                cause instanceof Error && cause.name === "Error"
                  ? cause.message
                  : "Soubor rozložení není platný. Použijte export z této školy.",
              );
            }
          }}
        />
      </div>
      {error && <ErrorState title="Rozložení se nepodařilo načíst" message={error} />}
      {setup.localNotice && (
        <p role="status" className="text-sm text-(--color-warning)">
          {setup.localNotice}
        </p>
      )}
      <div className="school-plan-workspace" data-empty={!plan.buildings.length}>
        {plan.buildings.length > 0 && (
          <section
            className="school-room-tray"
            data-expanded={libraryOpen}
            aria-label="Neumístěné učebny"
            onDragOver={(event) => {
              if (!disabled && event.dataTransfer.types.includes("application/x-bod-school-room"))
                event.preventDefault();
            }}
            onDrop={(event) => {
              event.preventDefault();
              move(null, event.dataTransfer.getData("application/x-bod-school-room"));
            }}
          >
            <Button
              variant="ghost"
              className="school-room-tray-toggle"
              aria-expanded={libraryOpen}
              onClick={() => setLibraryOpen(!libraryOpen)}
            >
              {unplaced.length ? `Učebny k umístění · ${unplaced.length}` : "Najít učebnu"}{" "}
              <ChevronDown size={16} />
            </Button>
            <div className="school-room-tray-content">
              <div className="school-room-tray-heading">
                <strong>
                  {unplaced.length
                    ? `Neumístěné učebny: ${unplaced.length}`
                    : "Všechny učebny jsou umístěné"}
                </strong>
                <span>
                  Budovy: {plan.buildings.length} · patra:{" "}
                  {plan.buildings.reduce((sum, item) => sum + item.floors.length, 0)}
                </span>
              </div>
              <div className="school-assignment-controls">
                <Input
                  aria-label="Najít učebnu v plánu"
                  placeholder="Najít učebnu…"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(0);
                  }}
                  disabled={disabled}
                />
                {matches.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={disabled}
                    onClick={() =>
                      setSelected((previous) => [
                        ...new Set([...previous, ...matches.map((room) => room.id)]),
                      ])
                    }
                  >
                    Vybrat nalezené ({matches.length})
                  </Button>
                )}
                {selected.length > 0 && (
                  <>
                    <Select
                      aria-label="Umístit vybrané do patra"
                      value=""
                      disabled={disabled}
                      onChange={(event) =>
                        move(event.target.value === "unplaced" ? null : event.target.value || null)
                      }
                    >
                      <option value="">Umístit vybrané ({selected.length})…</option>
                      {plan.buildings.flatMap((building) =>
                        building.floors.map((floor) => (
                          <option key={floor.id} value={floor.id}>
                            {building.name} · {floor.name}
                          </option>
                        )),
                      )}
                      <option value="unplaced">Zpět mezi neumístěné</option>
                    </Select>
                    <Button variant="ghost" size="sm" onClick={() => setSelected([])}>
                      Zrušit výběr
                    </Button>
                  </>
                )}
              </div>
              <div className="school-room-chips">
                {visible.map((room) => (
                  <SchoolRoomChip
                    key={room.id}
                    room={room}
                    showName
                    selected={selected.includes(room.id)}
                    disabled={disabled}
                    onSelect={() => select(room.id)}
                  />
                ))}
              </div>
              {pages > 1 && (
                <div className="page-actions">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={currentPage === 0}
                    onClick={() => setPage(currentPage - 1)}
                  >
                    Předchozí
                  </Button>
                  <span>
                    {currentPage + 1} / {pages}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={currentPage + 1 >= pages}
                    onClick={() => setPage(currentPage + 1)}
                  >
                    Další
                  </Button>
                </div>
              )}
              {unplaced.length > 0 && (
                <p className="text-xs text-(--color-muted-foreground)">
                  Přetáhněte učebny do patra nebo vyberte více najednou.
                </p>
              )}
            </div>
          </section>
        )}
        <SchoolCanvas
          plan={plan}
          rooms={rooms}
          selected={selected}
          search={search}
          disabled={disabled}
          onSelect={select}
          onMove={move}
          onChange={setup.changePlan}
          onEdit={setTarget}
          onRemove={remove}
        />
      </div>
      {target &&
        createPortal(
          <SchoolAreaDialog
            plan={plan}
            target={target}
            onSave={setup.changePlan}
            onClose={() => setTarget(null)}
          />,
          document.body,
        )}
    </div>
  );
}
