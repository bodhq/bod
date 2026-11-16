import type { SchoolPlan } from "@/modules/rooms/school-plan";

import { describe, expect, it } from "vitest";

import { pairKey, planConnectionEdits } from "@/modules/rooms/connections";
import {
  compileSchoolPlan,
  emptySchoolPlan,
  placeRooms,
  planLocations,
  pruneSchoolPlan,
  schoolPlanDocumentSchema,
  schoolPlanSchema,
  schoolPlanStorageKey,
} from "@/modules/rooms/school-plan";
import { projectTransfers } from "@/modules/rooms/transfer-draft";

function school(): SchoolPlan {
  return {
    version: 1,
    betweenBuildings: "5",
    links: [],
    buildings: [0, 1].map((building) => ({
      id: `building-${building}`,
      name: `Budova ${building}`,
      x: 24 + building * 350,
      y: 140,
      betweenFloors: "3",
      floors: [0, 1].map((floor) => ({
        id: `floor-${building}-${floor}`,
        name: `Patro ${floor}`,
        cost: "1",
        roomIds: Array.from(
          { length: 25 },
          (_, index) => `room-${building * 50 + floor * 25 + index}`,
        ),
      })),
    })),
  };
}

describe("high-level school plan", () => {
  it("derives all 9900 directions for 100 rooms from two buildings and four floors", () => {
    const edits = compileSchoolPlan(school(), "model", [], false);
    expect(edits).toHaveLength(9900);
    expect(new Set(edits.map(pairKey)).size).toBe(9900);
    expect(edits.filter((edit) => edit.cost === "1")).toHaveLength(2400);
    expect(edits.filter((edit) => edit.cost === "3")).toHaveLength(2500);
    expect(edits.filter((edit) => edit.cost === "5")).toHaveLength(5000);
    expect(edits.every((edit) => edit.from_room_id !== edit.to_room_id)).toBe(true);
  });
  it("keeps fractional area rules as complete costs instead of multiplying levels", () => {
    const plan = school();
    plan.betweenBuildings = "5.6";
    for (const building of plan.buildings) {
      building.betweenFloors = "3.4";
      for (const floor of building.floors) floor.cost = "2.2";
    }
    const edits = compileSchoolPlan(plan, "model", [], false);
    expect(edits.filter((edit) => edit.cost === "2.2")).toHaveLength(2400);
    expect(edits.filter((edit) => edit.cost === "3.4")).toHaveLength(2500);
    expect(edits.filter((edit) => edit.cost === "5.6")).toHaveLength(5000);
  });
  it("reassigns multiple rooms to one floor without duplicate membership", () => {
    const plan = placeRooms(school(), ["room-0", "room-1", "room-1"], "floor-1-0");
    expect(planLocations(plan).size).toBe(100);
    expect(planLocations(plan).get("room-0")?.building.id).toBe("building-1");
    expect(plan.buildings[0]?.floors[0]?.roomIds).not.toContain("room-0");
    expect(plan.buildings[1]?.floors[0]?.roomIds.filter((id) => id === "room-1")).toHaveLength(1);
  });
  it("leaves unplaced rooms unknown and rejects a nonexistent destination", () => {
    const plan = placeRooms(school(), ["room-0"], null);
    expect(compileSchoolPlan(plan, "model", [], false)).toHaveLength(99 * 98);
    expect(
      compileSchoolPlan(plan, "model", [], false).some(
        (edit) => edit.from_room_id === "room-0" || edit.to_room_id === "room-0",
      ),
    ).toBe(false);
    expect(() => placeRooms(plan, ["room-1"], "deleted-floor")).toThrow("neexistuje");
  });
  it("uses a specific building connection before the school default", () => {
    const plan = school();
    plan.links = [{ from: "building-0", to: "building-1", cost: "7,125" }];
    const edits = compileSchoolPlan(plan, "model", [], false);
    expect(edits.filter((edit) => edit.cost === "7.125")).toHaveLength(5000);
    expect(edits.filter((edit) => edit.cost === "1")).toHaveLength(2400);
  });
  it("preserves existing asymmetric costs until recalculation is explicitly enabled", () => {
    const saved = [
      {
        distance_model_id: "model",
        from_room_id: "room-0",
        to_room_id: "room-1",
        relative_cost: "7.000",
      },
      {
        distance_model_id: "model",
        from_room_id: "room-1",
        to_room_id: "room-0",
        relative_cost: "1.000",
      },
    ];
    const kept = compileSchoolPlan(school(), "model", saved, false);
    expect(kept).toHaveLength(9898);
    expect(
      kept.some((edit) => edit.from_room_id === "room-0" && edit.to_room_id === "room-1"),
    ).toBe(false);
    const replacement = compileSchoolPlan(school(), "model", saved, true);
    expect(
      planConnectionEdits("model", replacement, saved).filter((edit) => edit.kind === "update"),
    ).toEqual([
      {
        kind: "update",
        distance_model_id: "model",
        from_room_id: "room-0",
        to_room_id: "room-1",
        cost: "1",
      },
    ]);
  });
  it("gives explicit room exceptions precedence over generated rules", () => {
    const edits = compileSchoolPlan(school(), "model", [], false);
    const exceptions = [
      { from_room_id: "room-0", to_room_id: "room-1", cost: "8" },
      { from_room_id: "room-0", to_room_id: "room-2", cost: null },
    ];
    const effective = projectTransfers("model", [], [...edits, ...exceptions]);
    expect(
      effective.find((edge) => edge.from_room_id === "room-0" && edge.to_room_id === "room-1")
        ?.relative_cost,
    ).toBe("8");
    expect(
      effective.some((edge) => edge.from_room_id === "room-0" && edge.to_room_id === "room-2"),
    ).toBe(false);
    expect(
      effective.find((edge) => edge.from_room_id === "room-1" && edge.to_room_id === "room-0")
        ?.relative_cost,
    ).toBe("1");
  });
  it("updates rules from the last confirmed local plan and preserves externally changed values", () => {
    const previous = school();
    const saved = projectTransfers("model", [], compileSchoolPlan(previous, "model", [], false));
    const exceptional = saved.map((edge) =>
      edge.from_room_id === "room-0" && edge.to_room_id === "room-1"
        ? { ...edge, relative_cost: "8" }
        : edge,
    );
    const next = school();
    if (next.buildings[0]?.floors[0]) next.buildings[0].floors[0].cost = "2";
    const edits = compileSchoolPlan(next, "model", exceptional, false, previous);
    expect(edits).toHaveLength(599);
    expect(edits.every((edit) => edit.cost === "2" && edit.expectedCost === "1")).toBe(true);
    expect(
      edits.some((edit) => edit.from_room_id === "room-0" && edit.to_room_id === "room-1"),
    ).toBe(false);
    const changedLater = exceptional.map((edge) =>
      edge.from_room_id === "room-1" && edge.to_room_id === "room-0"
        ? { ...edge, relative_cost: "9" }
        : edge,
    );
    expect(planConnectionEdits("model", edits, changedLater)).toHaveLength(598);
  });
  it("does not overwrite a direction created by someone else after the preview", () => {
    const edits = compileSchoolPlan(school(), "model", [], false);
    const concurrent = [
      {
        distance_model_id: "model",
        from_room_id: "room-0",
        to_room_id: "room-1",
        relative_cost: "8",
      },
    ];
    const operations = planConnectionEdits("model", edits, concurrent);
    expect(operations).toHaveLength(9899);
    expect(
      operations.some(
        (operation) => operation.from_room_id === "room-0" && operation.to_room_id === "room-1",
      ),
    ).toBe(false);
  });
  it("round-trips the portable layout and separates browser keys by user and model", () => {
    const document = { plan: school(), overrides: [], applyExisting: false };
    expect(schoolPlanDocumentSchema.parse(JSON.parse(JSON.stringify(document)))).toEqual(document);
    expect(schoolPlanStorageKey("a", "model")).not.toBe(schoolPlanStorageKey("b", "model"));
    expect(schoolPlanStorageKey("a", "model")).not.toBe(schoolPlanStorageKey("a", "other"));
  });
  it("prunes deleted rooms from local placement and exceptions", () => {
    const document = {
      plan: school(),
      overrides: [{ from_room_id: "room-0", to_room_id: "room-1", cost: "4" }],
      applyExisting: false,
    };
    const remaining = new Set(Array.from({ length: 99 }, (_, index) => `room-${index + 1}`));
    const pruned = pruneSchoolPlan(document, remaining);
    expect(planLocations(pruned.plan).size).toBe(99);
    expect(pruned.overrides).toEqual([]);
  });
  it("rejects overlapping placement, invalid links and self-directed imported exceptions", () => {
    const duplicated = school();
    duplicated.buildings[1]?.floors[0]?.roomIds.push("room-0");
    expect(() => schoolPlanSchema.parse(duplicated)).toThrow("právě v jednom");
    const dangling = school();
    dangling.links = [{ from: "building-0", to: "missing", cost: "3" }];
    expect(() => schoolPlanSchema.parse(dangling)).toThrow("Propojení");
    expect(() =>
      schoolPlanDocumentSchema.parse({
        plan: emptySchoolPlan(),
        applyExisting: false,
        overrides: [{ from_room_id: "room-0", to_room_id: "room-0", cost: "1" }],
      }),
    ).toThrow("jiné");
  });
});
