"use client";

import type { RoomConnectionsRead, RoomsRead } from "@bod/api-client/types.gen";

import { useState } from "react";

import { Button } from "@/core/ui/actions/Button";
import { EmptyState } from "@/core/ui/feedback/EmptyState";
import { Input } from "@/core/ui/forms/Input";
import { Select } from "@/core/ui/forms/Select";

import { displayCost, pairKey, roomOption } from "../connections";
import { transferLevel } from "../transfer-draft";

/** Inspect persisted values. All editing belongs to TransferSetup. */
export function TransferDetails({
  rooms,
  connections,
  onEdit,
}: {
  rooms: RoomsRead[];
  connections: RoomConnectionsRead[];
  onEdit?: (roomId: string) => void;
}) {
  const [originId, setOriginId] = useState(rooms[0]?.id ?? "");
  const [search, setSearch] = useState("");
  const origin = rooms.find((room) => room.id === originId) ?? rooms[0];
  if (!origin) return null;
  const index = new Map(connections.map((edge) => [pairKey(edge), edge.relative_cost]));
  const targets = rooms.filter(
    (room) =>
      room.id !== origin.id &&
      roomOption(room).toLocaleLowerCase("cs").includes(search.toLocaleLowerCase("cs")),
  );
  const costLabel = (cost: string | undefined) =>
    cost === undefined ? "Nenastaveno" : displayCost(cost);
  return (
    <div className="ui-stack transfer-details">
      <div className="page-actions transfer-detail-controls">
        <Select
          label="Výchozí učebna"
          value={origin.id}
          onChange={(event) => setOriginId(event.target.value)}
        >
          {rooms.map((room) => (
            <option key={room.id} value={room.id}>
              {roomOption(room)}
            </option>
          ))}
        </Select>
        <Input
          aria-label="Najít cílovou učebnu"
          placeholder="Najít učebnu…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {onEdit && (
          <Button variant="outline" onClick={() => onEdit(origin.id)}>
            Upravit výjimky
          </Button>
        )}
      </div>
      <ul className="transfer-detail-cards" aria-label={`Uložené přesuny z učebny ${origin.code}`}>
        {targets.map((room) => {
          const forward = index.get(`${origin.id}/${room.id}`);
          const reverse = index.get(`${room.id}/${origin.id}`);
          return (
            <li key={room.id} data-level={transferLevel(forward)}>
              <strong>{roomOption(room)}</strong>
              <span>Tam: {costLabel(forward)}</span>
              <span>Zpět: {costLabel(reverse)}</span>
            </li>
          );
        })}
      </ul>
      {!targets.length && <EmptyState title="Žádná odpovídající učebna" />}
    </div>
  );
}
