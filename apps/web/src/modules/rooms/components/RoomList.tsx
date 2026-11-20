"use client";
import type { useRoomStudio } from "../hooks/useRoomStudio";

import { Pencil, Trash2 } from "lucide-react";

import { Button } from "@/core/ui/actions/Button";
import { Badge } from "@/core/ui/feedback/Badge";
import { removeRow } from "@/modules/shared/records/api";
import { rowLabel } from "@/modules/shared/records/format";

type Model = Pick<
  ReturnType<typeof useRoomStudio>,
  "visible" | "typeName" | "setSelectedId" | "setEditor" | "confirm" | "getResource" | "refresh"
>;
export function RoomList({ model }: { model: Model }) {
  const { visible, typeName, setSelectedId, setEditor, confirm, getResource, refresh } = model;
  return (
    <ul className="record-list">
      {visible.map((row) => (
        <li className="record-list-item" key={String(row.id)}>
          <div className="record-list-content">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="ui-eyebrow">{typeName(row.room_type_code)}</p>
                <h3 className="mt-1 font-semibold">{rowLabel(row)}</h3>
              </div>
              <Badge>{String(row.capacity)} míst</Badge>
            </div>
            <p className="text-xs text-(--color-muted-foreground)">
              {row.is_active === false ? "Mimo provoz" : "Aktivní učebna"} · {String(row.code)}
            </p>
          </div>
          <div className="flex flex-wrap gap-1">
            <Button variant="outline" onClick={() => setSelectedId(String(row.id))}>
              Otevřít
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Upravit učebnu ${rowLabel(row)}`}
              onClick={() => setEditor({ row })}
            >
              <Pencil size={16} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Odstranit učebnu ${rowLabel(row)}`}
              onClick={() =>
                confirm({
                  title: "Odstranit učebnu?",
                  description: `Odstraníte učebnu ${rowLabel(row)}. Pokud ji používá výuka, server odstranění odmítne.`,
                  confirmLabel: "Odstranit",
                  destructive: true,
                  onConfirm: async () => {
                    await removeRow(getResource("rooms"), row);
                    await refresh();
                  },
                })
              }
            >
              <Trash2 size={16} />
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
