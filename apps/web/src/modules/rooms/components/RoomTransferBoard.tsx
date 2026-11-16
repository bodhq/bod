"use client";

import type { RoomsRead } from "@bod/api-client/types.gen";
import type { useTransferSetup } from "../hooks/useTransferSetup";

import { Check, DoorOpen, Undo2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/core/ui/actions/Button";
import { Checkbox } from "@/core/ui/forms/Checkbox";
import { Input } from "@/core/ui/forms/Input";
import { Select } from "@/core/ui/forms/Select";

import { displayCost, pairKey, roomOption } from "../connections";
import { transferLevel, transferLevels } from "../transfer-draft";
import { TransferCostField } from "./TransferCostField";

export function RoomTransferBoard({
  setup,
  rooms,
}: {
  setup: ReturnType<typeof useTransferSetup>;
  rooms: RoomsRead[];
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [custom, setCustom] = useState("2");
  const [announcement, setAnnouncement] = useState("");
  const originId = setup.origin?.id;
  useEffect(() => {
    if (originId) {
      setSelected([]);
      setAnnouncement("");
    }
  }, [originId]);
  if (!setup.origin) return null;
  const origin = setup.origin;
  const index = new Map(setup.effective.map((edge) => [pairKey(edge), edge.relative_cost]));
  const changed = new Set(setup.edits.map(pairKey));
  const getCost = (id: string) => index.get(pairKey({ from_room_id: origin.id, to_room_id: id }));
  const candidates = rooms.filter(
    (room) =>
      room.id !== origin.id &&
      roomOption(room).toLocaleLowerCase("cs").includes(search.toLocaleLowerCase("cs")),
  );
  const visible = candidates.filter((room) => !onlyMissing || getCost(room.id) === undefined);
  const busy = setup.save.isPending || setup.save.submittedAt > 0;
  const assign = (ids: string[], cost: string | null) => {
    if (!ids.length || busy) return;
    setup.assign(ids, cost);
    setSelected([]);
    setAnnouncement(`Upravené cíle: ${ids.length}. Změny ještě nejsou uložené.`);
  };
  const levels = transferLevels.filter(
    (level) =>
      level.id !== "custom" || visible.some((room) => transferLevel(getCost(room.id)) === "custom"),
  );
  return (
    <div className="ui-stack transfer-board">
      <div className="transfer-board-origin">
        <DoorOpen size={24} aria-hidden="true" />
        <Select
          label="Jsem v učebně"
          value={origin.id}
          onChange={(event) => setup.setOriginId(event.target.value)}
          disabled={busy}
        >
          {setup.coverage.map(({ room, counts }) => (
            <option key={room.id} value={room.id}>
              {roomOption(room)} · {counts.missing ? `chybí ${counts.missing}` : "vyplněno"}
            </option>
          ))}
        </Select>
        <Button
          variant="outline"
          disabled={
            busy ||
            !setup.coverage.some((item) => item.room.id !== origin.id && item.counts.missing > 0)
          }
          onClick={setup.nextMissing}
        >
          Další nevyplněná učebna
        </Button>
      </div>
      <div className="transfer-board-toolbar">
        <p className="text-sm">
          Z učebny <strong>{origin.code}</strong> ·{" "}
          <strong>
            {selected.length ? `Vybráno ${selected.length}` : "Vyberte cíle a zařaďte je"}
          </strong>{" "}
          <span className="transfer-drag-hint"> · karty lze také přetáhnout do skupiny.</span>
        </p>
        {selected.length > 0 && (
          <TransferCostField
            label={`Výjimka z učebny ${origin.code}`}
            description={`Do vybraných učeben: ${rooms
              .filter((room) => selected.includes(room.id))
              .slice(0, 6)
              .map((room) => room.code)
              .join(", ")}${selected.length > 6 ? ` a dalších ${selected.length - 6}` : ""}.`}
            value={custom}
            onChange={setCustom}
            disabled={busy}
          />
        )}
        <Checkbox
          label="Úpravy platí i zpět"
          checked={setup.both}
          onChange={(event) => setup.setBoth(event.target.checked)}
          disabled={busy}
        />
        <div className="page-actions">
          <Button
            variant="outline"
            disabled={busy || !selected.length}
            onClick={() => assign(selected, custom)}
          >
            Použít na vybrané ({selected.length})
          </Button>
          <Button
            variant="ghost"
            disabled={busy || !selected.length}
            onClick={() => assign(selected, null)}
          >
            Zrušit zařazení
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={busy || !setup.canUndo}
            onClick={() => {
              setup.undo();
              setSelected([]);
              setAnnouncement("Poslední úprava vrácena.");
            }}
          >
            <Undo2 size={16} /> Vrátit úpravu
          </Button>
        </div>
      </div>
      <div className="transfer-board-filters">
        <Input
          aria-label="Najít cílovou učebnu"
          placeholder="Najít učebnu…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          disabled={busy}
        />
        <Checkbox
          label="Jen nezařazené"
          checked={onlyMissing}
          onChange={(event) => setOnlyMissing(event.target.checked)}
        />
        <Button
          variant="ghost"
          size="sm"
          disabled={busy || !visible.length}
          onClick={() =>
            setSelected((previous) => [
              ...new Set([...previous, ...visible.map((room) => room.id)]),
            ])
          }
        >
          Vybrat zobrazené
        </Button>
        {selected.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setSelected([])}>
            Zrušit výběr
          </Button>
        )}
      </div>
      <fieldset className="transfer-lanes" aria-label={`Přesuny z učebny ${origin.code}`}>
        {levels.map((level) => {
          const targets = visible.filter((room) => transferLevel(getCost(room.id)) === level.id);
          return (
            <section
              key={level.id}
              className="transfer-lane"
              data-level={level.id}
              aria-label={`${level.label} přesuny`}
              onDragOver={(event) => {
                if (
                  level.cost !== undefined &&
                  !busy &&
                  event.dataTransfer.types.includes("application/x-bod-room")
                ) {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                const id = event.dataTransfer.getData("application/x-bod-room");
                if (
                  level.cost === undefined ||
                  !rooms.some((room) => room.id === id) ||
                  id === origin.id
                )
                  return;
                assign(selected.includes(id) ? selected : [id], level.cost);
              }}
            >
              <div className="transfer-lane-heading">
                <h4>{level.label}</h4>
                <span>{targets.length}</span>
              </div>
              <p className="transfer-lane-hint">{level.hint}</p>
              <div className="transfer-lane-cards">
                {targets.map((room) => {
                  const cost = getCost(room.id);
                  const reverse = index.get(
                    pairKey({ from_room_id: room.id, to_room_id: origin.id }),
                  );
                  const differentReverse =
                    reverse !== undefined &&
                    (cost === undefined || Number(reverse) !== Number(cost));
                  const draft =
                    changed.has(`${origin.id}/${room.id}`) ||
                    changed.has(`${room.id}/${origin.id}`);
                  return (
                    <Button
                      key={room.id}
                      variant="choice"
                      className="transfer-target"
                      contentClassName="transfer-target-content"
                      data-draft={draft}
                      aria-pressed={selected.includes(room.id)}
                      aria-label={`Učebna ${room.code}. ${level.label}${cost ? `, náročnost ${displayCost(cost)}` : ""}${differentReverse ? `, zpět ${displayCost(reverse)}` : ""}`}
                      disabled={busy}
                      onClick={() =>
                        setSelected((previous) =>
                          previous.includes(room.id)
                            ? previous.filter((id) => id !== room.id)
                            : [...previous, room.id],
                        )
                      }
                      draggable={!busy}
                      onDragStart={(event) => {
                        event.dataTransfer.setData("application/x-bod-room", room.id);
                        event.dataTransfer.effectAllowed = "move";
                      }}
                    >
                      <span className="transfer-target-heading">
                        <strong>{room.code}</strong>
                        {selected.includes(room.id) && <Check size={16} aria-hidden="true" />}
                      </span>
                      {room.name && room.name !== room.code && <span>{room.name}</span>}
                      <small>
                        {cost !== undefined && `Náročnost ${displayCost(cost)}`}
                        {draft && " · upraveno"}
                        {differentReverse && ` · Zpět: ${displayCost(reverse)}`}
                        {room.is_active ? "" : " · mimo provoz"}
                      </small>
                    </Button>
                  );
                })}
                {!targets.length && (
                  <p className="transfer-lane-empty">
                    {onlyMissing && level.id !== "missing"
                      ? "Zařazené cíle jsou skryté filtrem."
                      : "Žádné učebny"}
                  </p>
                )}
              </div>
            </section>
          );
        })}
      </fieldset>
      {!visible.length && (
        <p className="text-sm">
          Žádné odpovídající cíle. Zkontrolujte hledání nebo filtr nezařazených.
        </p>
      )}
      {announcement && (
        <p role="status" className="text-sm">
          {announcement}
        </p>
      )}
    </div>
  );
}
