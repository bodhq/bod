import type { RoomConnectionsRead, RoomsRead } from "@bod/api-client/types.gen";

import { describe, expect, it } from "vitest";

import { planConnectionEdits } from "@/modules/rooms/connections";
import {
  assignTransferCost,
  projectTransfers,
  transferCoverage,
  transferLevel,
} from "@/modules/rooms/transfer-draft";

const edge = (from: string, to: string, cost: string, modelId = "school"): RoomConnectionsRead => ({
  distance_model_id: modelId,
  from_room_id: from,
  to_room_id: to,
  relative_cost: cost,
});
const rooms = ["a", "b", "c"].map((id) => ({
  id,
  code: id,
  name: null,
  room_type_code: "normal",
  is_active: true,
  capacity: 30,
})) satisfies RoomsRead[];

describe("room transfer draft", () => {
  it("keeps different weights together without changing unrelated pairs or models", () => {
    const saved = [edge("b", "c", "7"), edge("a", "b", "99", "other")];
    let edits = assignTransferCost("school", [], "a", ["b"], "1", true, saved);
    edits = assignTransferCost("school", edits, "a", ["c"], "5", true, saved);
    const operations = planConnectionEdits("school", edits, saved);
    expect(operations).toHaveLength(4);
    expect(operations.every((operation) => operation.distance_model_id === "school")).toBe(true);
    expect(
      operations.map((operation) => (operation.kind === "delete" ? "delete" : operation.cost)),
    ).toEqual(["1", "1", "5", "5"]);
    expect(projectTransfers("school", saved, edits)).toContainEqual(edge("b", "c", "7"));
  });

  it("does not infer a reverse edge or a zero cost for a missing direction", () => {
    const projected = projectTransfers("school", [edge("a", "b", "1")], []);
    const summary = transferCoverage(rooms, projected);
    expect(summary.map((item) => item.counts.missing)).toEqual([1, 2, 2]);
    expect(summary[0]?.counts.easy).toBe(1);
    expect(summary[1]?.counts.easy).toBe(0);
    expect(transferLevel(undefined)).toBe("missing");
  });

  it("keeps asymmetric and custom values until explicitly changed", () => {
    const saved = [edge("a", "b", "3.000"), edge("b", "a", "7.125")];
    const edits = assignTransferCost("school", [], "a", ["b"], "1", false, saved);
    const projected = projectTransfers("school", saved, edits);
    expect(projected).toContainEqual(edge("b", "a", "7.125"));
    expect(transferCoverage(rooms, projected)[1]?.counts.hard).toBe(1);
    expect(planConnectionEdits("school", edits, saved)).toHaveLength(1);
  });

  it("returns to an unchanged draft when a value is restored", () => {
    const saved = [edge("a", "b", "3.000")];
    const first = assignTransferCost("school", [], "a", ["b"], "1", false, saved);
    expect(assignTransferCost("school", first, "a", ["b"], "3", false, saved)).toEqual([]);
  });

  it("removes explicit directions without replacing them with a small cost", () => {
    const saved = [edge("a", "b", "1"), edge("b", "a", "5")];
    const edits = assignTransferCost("school", [], "a", ["b"], null, false, saved);
    expect(planConnectionEdits("school", edits, saved)).toEqual([
      { kind: "delete", distance_model_id: "school", from_room_id: "a", to_room_id: "b" },
    ]);
    expect(projectTransfers("school", saved, edits)).toEqual([edge("b", "a", "5")]);
  });

  it("uses the last choice for an edited pair and only plans unfinished writes", () => {
    const edits = [
      { from_room_id: "a", to_room_id: "b", cost: "1" },
      { from_room_id: "a", to_room_id: "b", cost: "5" },
      { from_room_id: "a", to_room_id: "c", cost: "3" },
    ];
    expect(planConnectionEdits("school", edits, [edge("a", "b", "5.000")])).toEqual([
      {
        kind: "create",
        distance_model_id: "school",
        from_room_id: "a",
        to_room_id: "c",
        cost: "3",
      },
    ]);
  });

  it.each([
    ["1", "easy"],
    ["3", "easy"],
    ["3.9", "easy"],
    ["4.1", "medium"],
    ["6.9", "medium"],
    ["9.9", "hard"],
    ["4", "medium"],
    ["6", "medium"],
    ["7", "hard"],
    ["10", "hard"],
    ["0.5", "custom"],
    ["11", "custom"],
    ["7.125", "hard"],
  ])("classifies the 1–10 scale and keeps legacy value %s as %s", (cost, level) => {
    expect(transferLevel(cost)).toBe(level);
  });

  it("counts each valid target once and ignores unknown rooms", () => {
    const summary = transferCoverage(rooms, [
      edge("a", "b", "1"),
      edge("a", "b", "5"),
      edge("a", "a", "1"),
      edge("a", "deleted", "3"),
    ]);
    expect(summary[0]?.counts).toEqual({ missing: 1, easy: 0, medium: 1, hard: 0, custom: 0 });
  });

  it("rejects invalid or self-directed edits before planning writes", () => {
    expect(() =>
      planConnectionEdits("school", [{ from_room_id: "a", to_room_id: "a", cost: "1" }], []),
    ).toThrow("různými");
    expect(() =>
      planConnectionEdits("school", [{ from_room_id: "a", to_room_id: "b", cost: "0" }], []),
    ).toThrow("kladné");
  });
});
