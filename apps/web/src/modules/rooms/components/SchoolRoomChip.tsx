import type { RoomsRead } from "@bod/api-client/types.gen";

import { Check } from "lucide-react";

import { Button } from "@/core/ui/actions/Button";

export function SchoolRoomChip({
  room,
  selected,
  showName,
  muted,
  disabled,
  onSelect,
}: {
  room: RoomsRead;
  selected: boolean;
  showName?: boolean;
  muted?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <Button
      variant="choice"
      size="sm"
      className="school-room-chip"
      contentClassName="min-w-0"
      data-muted={muted || undefined}
      aria-label={`Učebna ${room.code}${room.name ? ` · ${room.name}` : ""}`}
      title={room.name || room.code}
      aria-pressed={selected}
      disabled={disabled}
      onClick={onSelect}
      draggable={!disabled}
      onDragStart={(event) => {
        event.dataTransfer.setData("application/x-bod-school-room", room.id);
        event.dataTransfer.effectAllowed = "move";
      }}
    >
      {selected && <Check size={12} aria-hidden="true" />}
      <span className="school-room-chip-label">
        <strong>{room.code}</strong>
        {showName && room.name && room.name !== room.code && <small>{room.name}</small>}
      </span>
    </Button>
  );
}
