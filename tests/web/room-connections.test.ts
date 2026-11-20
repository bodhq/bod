import type { RoomConnectionsRead } from "@bod/api-client/types.gen";

import { describe, expect, it, vi } from "vitest";

import { applyConnections, planConnectionEdits, relativeCost } from "@/modules/rooms/connections";

const edge = (from: string, to: string, cost = "1.000", model = "model"): RoomConnectionsRead => ({
  distance_model_id: model,
  from_room_id: from,
  to_room_id: to,
  relative_cost: cost,
});
const forward = { from_room_id: "a", to_room_id: "b", cost: "3" };
const reverse = { from_room_id: "b", to_room_id: "a", cost: "3" };

describe("room connection editing", () => {
  it.each([
    "0",
    "-1",
    "",
    "NaN",
    "Infinity",
    "1e3",
    "1.0001",
    "10000000",
  ])("rejects invalid relative cost %s", (value) => {
    expect(() => relativeCost(value)).toThrow();
  });
  it("accepts Czech decimal input within the published database precision", () => {
    expect(relativeCost(" 0,125 ")).toBe("0.125");
    expect(relativeCost("9999999.999")).toBe("9999999.999");
  });
  it("does not infer missing or opposite edges", () => {
    expect(planConnectionEdits("model", [forward], [edge("b", "a", "7")])).toEqual([
      { distance_model_id: "model", from_room_id: "a", to_room_id: "b", kind: "create", cost: "3" },
    ]);
  });
  it("preserves asymmetric reverse costs unless explicitly edited", () => {
    const saved = [edge("a", "b", "2"), edge("b", "a", "8")];
    expect(planConnectionEdits("model", [forward], saved)).toMatchObject([
      { kind: "update", from_room_id: "a", to_room_id: "b", cost: "3" },
    ]);
    expect(planConnectionEdits("model", [forward, reverse], saved)).toHaveLength(2);
  });
  it("skips equivalent decimal values and writes only this model", () => {
    expect(
      planConnectionEdits(
        "model",
        [{ ...forward, cost: "1" }, reverse],
        [edge("a", "b"), edge("b", "a", "9", "other")],
      ),
    ).toMatchObject([{ kind: "create", from_room_id: "b", to_room_id: "a" }]);
  });
  it("keeps the last explicit edit for a repeated direction", () => {
    expect(
      planConnectionEdits("model", [forward, reverse, { ...forward, cost: "5" }], []),
    ).toMatchObject([
      { from_room_id: "a", to_room_id: "b", cost: "5" },
      { from_room_id: "b", to_room_id: "a", cost: "3" },
    ]);
  });
  it("refuses self-edges, missing room identities and a missing model", () => {
    expect(() => planConnectionEdits("model", [{ ...forward, to_room_id: "a" }], [])).toThrow();
    expect(() => planConnectionEdits("model", [{ ...forward, from_room_id: "" }], [])).toThrow();
    expect(() => planConnectionEdits("", [forward], [])).toThrow();
  });
  it("deletes only stored explicitly selected directions", () => {
    const plan = planConnectionEdits(
      "model",
      [
        { ...forward, cost: null },
        { ...reverse, cost: null },
      ],
      [edge("a", "b"), edge("b", "a"), edge("a", "c")],
    );
    expect(plan).toHaveLength(2);
    expect(plan.every((operation) => operation.kind === "delete")).toBe(true);
  });
  it("stops after a failed write, reports real progress and can resume from persisted data", async () => {
    const plan = planConnectionEdits("model", [forward, reverse], []);
    const writer = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("Offline"));
    const progress = vi.fn();
    await expect(applyConnections(plan, writer, progress)).rejects.toThrow("Offline");
    expect(progress.mock.calls).toEqual([
      [0, 2],
      [1, 2],
    ]);
    const remaining = planConnectionEdits("model", [forward, reverse], [edge("a", "b", "3")]);
    expect(remaining).toMatchObject([{ kind: "create", from_room_id: "b", to_room_id: "a" }]);
  });
});
