"use client";

import type { RoomConnectionsRead, RoomsRead } from "@bod/api-client/types.gen";
import type { useTransferSetup } from "../hooks/useTransferSetup";

import { useState } from "react";

import { Button } from "@/core/ui/actions/Button";

import { connectionKey, directionCount, displayCost } from "../connections";
import { TransferCoverage, TransferLegend } from "./TransferCoverage";

export function TransferReview({
  setup,
  rooms,
  saved,
  onInspect,
}: {
  setup: ReturnType<typeof useTransferSetup>;
  rooms: RoomsRead[];
  saved: RoomConnectionsRead[];
  onInspect: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(setup.operations.length / 100));
  const currentPage = Math.min(page, pageCount - 1);
  const byId = new Map(rooms.map((room) => [room.id, room.code]));
  const original = new Map(saved.map((edge) => [connectionKey(edge), edge.relative_cost]));
  const counts = { create: 0, update: 0, delete: 0 };
  for (const operation of setup.operations) counts[operation.kind]++;
  const frozen = setup.save.submittedAt > 0;
  const missing = setup.coverage.filter((item) => item.counts.missing > 0);
  return (
    <div className="ui-stack">
      {setup.plan.buildings.length > 0 && (
        <div className="transfer-review-status">
          <strong>
            Budovy: {setup.plan.buildings.length} · patra:{" "}
            {setup.plan.buildings.reduce((sum, item) => sum + item.floors.length, 0)} · neumístěné
            učebny: {setup.unplaced.length}
          </strong>
          <p>
            {setup.unplaced.length
              ? `Mimo plán zůstávají: ${setup.unplaced
                  .slice(0, 12)
                  .map((room) => room.code)
                  .join(
                    ", ",
                  )}${setup.unplaced.length > 12 ? "…" : ""}. Pravidla pro ně přesuny nedoplní.`
              : "Všechny učebny jsou rozmístěné. Přesuny se odvozují z pravidel oblastí a ručních výjimek."}
          </p>
          <p>
            Rozložení budov a pater zůstává v tomto prohlížeči. Do školy se uloží výsledné
            náročnosti.
          </p>
          <Button variant="ghost" onClick={setup.exportPlan}>
            Exportovat rozložení
          </Button>
        </div>
      )}
      {setup.operations.length > 500 && (
        <p className="text-sm">
          Uložení zahrnuje {setup.operations.length} změn. Nechte aplikaci otevřenou; průběh uvidíte
          při ukládání.
        </p>
      )}
      <div className="transfer-review-status" data-incomplete={setup.missing > 0}>
        <strong>
          {setup.missing
            ? `Ještě chybí ${directionCount(setup.missing)}`
            : "Všechny směry jsou zařazené"}
        </strong>
        <p>
          {setup.missing
            ? "Zkontrolujte označené učebny. Nastavení můžete uložit i rozpracované; chybějící přesuny zůstanou neznámé."
            : "V přehledu vidíte rozložení náročností u každé učebny. Kliknutím se můžete vrátit k její úpravě."}
        </p>
        {missing[0] && (
          <Button
            variant="outline"
            disabled={frozen}
            onClick={() => onInspect(missing[0]?.room.id ?? "")}
          >
            Doplnit chybějící přesuny
          </Button>
        )}
      </div>
      <TransferLegend />
      <TransferCoverage coverage={setup.coverage} onSelect={frozen ? undefined : onInspect} />
      <p className="text-sm">
        Nové směry: <strong>{counts.create}</strong> · změna náročnosti:{" "}
        <strong>{counts.update}</strong> · odstranění: <strong>{counts.delete}</strong>
      </p>
      {counts.delete > 0 && (
        <p className="text-sm text-(--color-warning)">
          Odstraněné směry budou znovu nezařazené. Neznamenají snadný ani nulový přesun.
        </p>
      )}
      <details onToggle={(event) => setExpanded(event.currentTarget.open)}>
        <summary className="cursor-pointer text-sm">
          Konkrétní změny ({setup.operations.length})
        </summary>
        {expanded && (
          <ul className="transfer-change-list">
            {setup.operations.slice(currentPage * 100, (currentPage + 1) * 100).map((operation) => {
              const previous = original.get(connectionKey(operation));
              return (
                <li key={connectionKey(operation)}>
                  <span>
                    {byId.get(operation.from_room_id)} → {byId.get(operation.to_room_id)}
                  </span>
                  <span>
                    {previous !== undefined ? displayCost(previous) : "Nezařazeno"} →{" "}
                    <strong>
                      {operation.kind === "delete" ? "Odstranit" : displayCost(operation.cost)}
                    </strong>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        {expanded && pageCount > 1 && (
          <div className="page-actions">
            <Button
              variant="ghost"
              size="sm"
              disabled={!currentPage}
              onClick={() => setPage(currentPage - 1)}
            >
              Předchozí změny
            </Button>
            <span>
              {currentPage + 1} / {pageCount}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={currentPage + 1 >= pageCount}
              onClick={() => setPage(currentPage + 1)}
            >
              Další změny
            </Button>
          </div>
        )}
      </details>
    </div>
  );
}
