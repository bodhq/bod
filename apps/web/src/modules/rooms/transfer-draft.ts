import type { RoomConnectionsRead, RoomsRead } from "@bod/api-client/types.gen";
import type { ConnectionEdit } from "./connections";

import { pairKey, relativeCost } from "./connections";

export const transferLevels = [
  { id: "missing", label: "Nezařazené", range: "", cost: null, hint: "Tady ještě přesun neznáme." },
  {
    id: "easy",
    label: "Snadné",
    range: "< 4",
    cost: "1",
    hint: "Pod 4 · Blízko, pohodlný přechod. Přetažením nastavíte 1.",
  },
  {
    id: "medium",
    label: "Střední",
    range: "4–< 7",
    cost: "5",
    hint: "Běžný přechod. Přetažením nastavíte 5.",
  },
  {
    id: "hard",
    label: "Náročné",
    range: "7–10",
    cost: "9",
    hint: "7–10 · Daleko nebo obtížný přechod. Přetažením nastavíte 9.",
  },
  {
    id: "custom",
    label: "Mimo škálu",
    range: "",
    cost: undefined,
    hint: "Dříve uložené hodnoty mimo stupnici 1–10.",
  },
] as const;
export type TransferLevel = (typeof transferLevels)[number]["id"];
export function transferLevel(cost: string | undefined): TransferLevel {
  if (cost === undefined) return "missing";
  const value = Number(cost);
  if (!Number.isFinite(value) || value < 1 || value > 10) return "custom";
  return value < 4 ? "easy" : value < 7 ? "medium" : "hard";
}

export function projectTransfers(
  modelId: string,
  saved: RoomConnectionsRead[],
  edits: ConnectionEdit[],
) {
  const result = new Map(
    saved.filter((edge) => edge.distance_model_id === modelId).map((edge) => [pairKey(edge), edge]),
  );
  for (const edit of edits) {
    if (edit.cost === null) result.delete(pairKey(edit));
    else
      result.set(pairKey(edit), {
        distance_model_id: modelId,
        from_room_id: edit.from_room_id,
        to_room_id: edit.to_room_id,
        relative_cost: relativeCost(edit.cost),
      });
  }
  return [...result.values()];
}

export function assignTransferCost(
  modelId: string,
  previous: ConnectionEdit[],
  from: string,
  targets: string[],
  cost: string | null,
  both: boolean,
  saved: RoomConnectionsRead[],
) {
  const value = cost === null ? null : relativeCost(cost);
  const result = new Map(previous.map((edit) => [pairKey(edit), edit]));
  const original = new Map(
    saved
      .filter((edge) => edge.distance_model_id === modelId)
      .map((edge) => [pairKey(edge), edge.relative_cost]),
  );
  for (const target of new Set(targets)) {
    if (target === from) throw new Error("Učebnu nelze propojit samu se sebou.");
    const pairs = both
      ? [
          [from, target],
          [target, from],
        ]
      : [[from, target]];
    for (const [start = "", end = ""] of pairs) {
      const edit = { from_room_id: start, to_room_id: end, cost: value };
      const base = original.get(pairKey(edit));
      if (
        value === null ? base === undefined : base !== undefined && Number(base) === Number(value)
      )
        result.delete(pairKey(edit));
      else result.set(pairKey(edit), edit);
    }
  }
  return [...result.values()];
}

export function transferCoverage(rooms: RoomsRead[], edges: RoomConnectionsRead[]) {
  const ids = new Set(rooms.map((room) => room.id));
  const outgoing = new Map<string, Map<string, string>>();
  for (const edge of edges) {
    if (
      !ids.has(edge.from_room_id) ||
      !ids.has(edge.to_room_id) ||
      edge.from_room_id === edge.to_room_id
    )
      continue;
    const targets = outgoing.get(edge.from_room_id) ?? new Map<string, string>();
    targets.set(edge.to_room_id, edge.relative_cost);
    outgoing.set(edge.from_room_id, targets);
  }
  return rooms.map((room) => {
    const targets = outgoing.get(room.id) ?? new Map<string, string>();
    const counts = {
      missing: Math.max(0, rooms.length - 1 - targets.size),
      easy: 0,
      medium: 0,
      hard: 0,
      custom: 0,
    };
    for (const cost of targets.values()) counts[transferLevel(cost)]++;
    return { room, counts };
  });
}
export type RoomTransferCoverage = ReturnType<typeof transferCoverage>;
