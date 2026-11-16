"use client";

import type { useRoomStudio } from "../hooks/useRoomStudio";

import { Button } from "@/core/ui/actions/Button";
import { Badge } from "@/core/ui/feedback/Badge";
import { Panel, PanelHeader } from "@/core/ui/layout/Panel";
import { removeRow } from "@/modules/shared/records/api";
import { rowLabel } from "@/modules/shared/records/format";

import { roomCount } from "../connections";

type Model = Pick<
  ReturnType<typeof useRoomStudio>,
  "types" | "rooms" | "setTypeOpen" | "confirm" | "getResource" | "refresh"
>;
export function RoomTypes({ model }: { model: Model }) {
  const { types, rooms, setTypeOpen, confirm, getResource, refresh } = model;
  return (
    <div className="ui-stack">
      {types.map((roomType) => (
        <Panel key={String(roomType.code)} className="ui-stack">
          <PanelHeader
            title={rowLabel(roomType)}
            level="h3"
            eyebrow={String(roomType.code)}
            actions={
              <>
                <Badge>
                  {roomCount(rooms.filter((row) => row.room_type_code === roomType.code).length)}
                </Badge>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTypeOpen({ row: roomType })}
                  >
                    Upravit typ
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      confirm({
                        title: "Odstranit typ učebny?",
                        description: `Odstraníte typ ${rowLabel(roomType)}. Používaný typ server odmítne odstranit.`,
                        confirmLabel: "Odstranit typ",
                        destructive: true,
                        onConfirm: async () => {
                          await removeRow(getResource("room_types"), roomType);
                          await refresh();
                        },
                      })
                    }
                  >
                    Odstranit typ
                  </Button>
                </div>
              </>
            }
          />
        </Panel>
      ))}
    </div>
  );
}
