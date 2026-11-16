import type { RoomConnectionsRead, RoomsRead } from "@bod/api-client/types.gen";

export type ConnectionIdentity = Pick<
  RoomConnectionsRead,
  "distance_model_id" | "from_room_id" | "to_room_id"
>;
export type ConnectionOperation = ConnectionIdentity &
  ({ kind: "create" | "update"; cost: string } | { kind: "delete" });

export type ConnectionEdit = Pick<ConnectionIdentity, "from_room_id" | "to_room_id"> & {
  cost: string | null;
  onlyIfMissing?: boolean;
  expectedCost?: string;
};
export interface ConnectionRequest {
  modelId: string;
  edits: ConnectionEdit[];
  sessionVersion?: number;
}
export const pairKey = (edge: Pick<ConnectionIdentity, "from_room_id" | "to_room_id">) =>
  `${edge.from_room_id}/${edge.to_room_id}`;

export function planConnectionEdits(
  modelId: string,
  edits: ConnectionEdit[],
  saved: RoomConnectionsRead[],
): ConnectionOperation[] {
  if (!modelId) throw new Error("Vyberte nastavení přesunů.");
  const index = new Map(
    saved.filter((edge) => edge.distance_model_id === modelId).map((edge) => [pairKey(edge), edge]),
  );
  const unique = new Map(edits.map((edit) => [pairKey(edit), edit]));
  return [...unique.values()].flatMap((edit): ConnectionOperation[] => {
    if (!edit.from_room_id || !edit.to_room_id || edit.from_room_id === edit.to_room_id)
      throw new Error("Přesun musí vést mezi dvěma různými učebnami.");
    const identity = {
      distance_model_id: modelId,
      from_room_id: edit.from_room_id,
      to_room_id: edit.to_room_id,
    };
    const existing = index.get(pairKey(edit));
    if (edit.onlyIfMissing && existing) return [];
    if (
      edit.expectedCost !== undefined &&
      (!existing || Number(existing.relative_cost) !== Number(edit.expectedCost))
    )
      return [];
    if (edit.cost === null) return existing ? [{ ...identity, kind: "delete" }] : [];
    const cost = relativeCost(edit.cost);
    if (existing && Number(existing.relative_cost) === Number(cost)) return [];
    return [{ ...identity, kind: existing ? "update" : "create", cost }];
  });
}

export const roomName = (room: RoomsRead) => room.name || room.code;
export const roomOption = (room: RoomsRead) =>
  room.name && room.name !== room.code ? `${room.code} · ${room.name}` : room.code;
const countLabel = (count: number, one: string, few: string, other: string) =>
  `${count} ${count === 1 ? one : count >= 2 && count <= 4 ? few : other}`;
export const roomCount = (count: number) => countLabel(count, "učebna", "učebny", "učeben");
export const directionCount = (count: number) => countLabel(count, "směr", "směry", "směrů");
export const connectionKey = (edge: ConnectionIdentity) =>
  `${edge.distance_model_id}/${edge.from_room_id}/${edge.to_room_id}`;

export function relativeCost(value: string): string {
  const normalized = value.trim().replace(",", ".");
  const number = Number(normalized);
  if (!/^\d+(?:\.\d{1,3})?$/.test(normalized) || number <= 0 || number > 9_999_999.999)
    throw new Error("Zadejte kladné číslo, nejvýše se třemi desetinnými místy.");
  return String(number);
}

export const displayCost = (value: string) =>
  Number(value).toLocaleString("cs-CZ", { maximumFractionDigits: 3 });

export async function applyConnections(
  operations: ConnectionOperation[],
  write: (operation: ConnectionOperation) => Promise<unknown>,
  progress: (done: number, total: number) => void,
) {
  progress(0, operations.length);
  for (const [index, operation] of operations.entries()) {
    await write(operation);
    progress(index + 1, operations.length);
  }
}
