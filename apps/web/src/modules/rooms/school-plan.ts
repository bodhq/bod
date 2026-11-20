import type { RoomConnectionsRead } from "@bod/api-client/types.gen";
import type { ConnectionEdit } from "./connections";

import { z } from "zod";

import { pairKey, relativeCost } from "./connections";

const cost = z.string().transform((value, context) => {
  try {
    return relativeCost(value);
  } catch {
    context.addIssue({
      code: "custom",
      message: "Náročnost musí být kladné číslo, nejvýše se třemi desetinnými místy.",
    });
    return z.NEVER;
  }
});
const id = z.string().min(1).max(100);
const floor = z.object({
  id,
  name: z.string().trim().min(1).max(100),
  cost,
  roomIds: z.array(id).max(5000),
});
const building = z.object({
  id,
  name: z.string().trim().min(1).max(100),
  x: z.number().min(24).max(20000),
  y: z.number().min(100).max(20000),
  betweenFloors: cost,
  floors: z.array(floor).min(1).max(25),
});
export const schoolPlanSchema = z
  .object({
    version: z.literal(1),
    betweenBuildings: cost,
    buildings: z.array(building).max(30),
    links: z.array(z.object({ from: id, to: id, cost })).max(435),
  })
  .superRefine((plan, context) => {
    const ids = new Set<string>();
    const assigned = new Set<string>();
    for (const item of plan.buildings) {
      for (const area of [item, ...item.floors]) {
        if (ids.has(area.id))
          context.addIssue({
            code: "custom",
            message: "Budovy a patra musí mít různé identifikátory.",
          });
        ids.add(area.id);
      }
      for (const area of item.floors)
        for (const room of area.roomIds) {
          if (assigned.has(room))
            context.addIssue({ code: "custom", message: "Učebna může být právě v jednom patře." });
          assigned.add(room);
        }
    }
    const buildings = new Set(plan.buildings.map((item) => item.id));
    const links = new Set<string>();
    for (const link of plan.links) {
      const key = [link.from, link.to].sort().join("/");
      if (
        link.from === link.to ||
        !buildings.has(link.from) ||
        !buildings.has(link.to) ||
        links.has(key)
      )
        context.addIssue({
          code: "custom",
          message: "Propojení budov není platné nebo se opakuje.",
        });
      links.add(key);
    }
  });
export type SchoolPlan = z.infer<typeof schoolPlanSchema>;
export type SchoolBuilding = SchoolPlan["buildings"][number];
export type SchoolFloor = SchoolBuilding["floors"][number];
export const emptySchoolPlan = (): SchoolPlan => ({
  version: 1,
  betweenBuildings: "5",
  buildings: [],
  links: [],
});

export function placeRooms(
  plan: SchoolPlan,
  roomIds: string[],
  floorId: string | null,
): SchoolPlan {
  if (floorId && !plan.buildings.some((item) => item.floors.some((floor) => floor.id === floorId)))
    throw new Error("Cílové patro neexistuje.");
  const selected = new Set(roomIds);
  return {
    ...plan,
    buildings: plan.buildings.map((item) => ({
      ...item,
      floors: item.floors.map((floor) => ({
        ...floor,
        roomIds: [
          ...floor.roomIds.filter((id) => !selected.has(id)),
          ...(floor.id === floorId ? [...selected] : []),
        ],
      })),
    })),
  };
}

export function planLocations(plan: SchoolPlan) {
  const result = new Map<string, { building: SchoolBuilding; floor: SchoolFloor }>();
  for (const building of plan.buildings)
    for (const floor of building.floors)
      for (const room of floor.roomIds) result.set(room, { building, floor });
  return result;
}

export function compileSchoolPlan(
  plan: SchoolPlan,
  modelId: string,
  saved: RoomConnectionsRead[],
  applyExisting: boolean,
  previousPlan?: SchoolPlan,
): ConnectionEdit[] {
  const validated = schoolPlanSchema.parse(plan);
  const locations = planLocations(validated);
  const existing = new Map(
    saved
      .filter((edge) => edge.distance_model_id === modelId)
      .map((edge) => [pairKey(edge), edge.relative_cost]),
  );
  const links = new Map(
    validated.links.map((link) => [[link.from, link.to].sort().join("/"), link.cost]),
  );
  const previous = previousPlan ? schoolPlanSchema.parse(previousPlan) : undefined;
  const previousLocations = planLocations(previous ?? emptySchoolPlan());
  const previousLinks = new Map(
    previous?.links.map((link) => [[link.from, link.to].sort().join("/"), link.cost]) ?? [],
  );
  const costBetween = (
    model: SchoolPlan,
    start: { building: SchoolBuilding; floor: SchoolFloor },
    end: { building: SchoolBuilding; floor: SchoolFloor },
    rules: Map<string, string>,
  ): string =>
    start.floor.id === end.floor.id
      ? start.floor.cost
      : start.building.id === end.building.id
        ? start.building.betweenFloors
        : (rules.get([start.building.id, end.building.id].sort().join("/")) ??
          model.betweenBuildings);
  const result: ConnectionEdit[] = [];
  for (const [from, start] of locations)
    for (const [to, end] of locations) {
      if (from === to) continue;
      const old = existing.get(`${from}/${to}`);
      if (!applyExisting && old !== undefined) {
        const oldStart = previousLocations.get(from),
          oldEnd = previousLocations.get(to);
        if (
          !previous ||
          !oldStart ||
          !oldEnd ||
          Number(old) !== Number(costBetween(previous, oldStart, oldEnd, previousLinks))
        )
          continue;
      }
      const value = costBetween(validated, start, end, links);
      if (old === undefined || Number(old) !== Number(value))
        result.push({
          from_room_id: from,
          to_room_id: to,
          cost: value,
          ...(!applyExisting
            ? old === undefined
              ? { onlyIfMissing: true }
              : { expectedCost: old }
            : {}),
        });
    }
  return result;
}

export const schoolPlanDocumentSchema = z.object({
  plan: schoolPlanSchema,
  overrides: z
    .array(
      z
        .object({ from_room_id: id, to_room_id: id, cost: cost.nullable() })
        .refine(
          (edit) => edit.from_room_id !== edit.to_room_id,
          "Přesun musí vést do jiné učebny.",
        ),
    )
    .max(250000),
  applyExisting: z.boolean(),
  baseline: schoolPlanSchema.optional(),
});
export type SchoolPlanDocument = z.infer<typeof schoolPlanDocumentSchema>;
export const schoolPlanStorageKey = (userId: string, modelId: string) =>
  `bod:school-plan:v1:${encodeURIComponent(userId)}:${encodeURIComponent(modelId)}`;

export function pruneSchoolPlan(
  document: SchoolPlanDocument,
  roomIds: Set<string>,
): SchoolPlanDocument {
  return {
    ...document,
    ...(document.baseline
      ? {
          baseline: {
            ...document.baseline,
            buildings: document.baseline.buildings.map((building) => ({
              ...building,
              floors: building.floors.map((floor) => ({
                ...floor,
                roomIds: floor.roomIds.filter((id) => roomIds.has(id)),
              })),
            })),
          },
        }
      : {}),
    plan: {
      ...document.plan,
      buildings: document.plan.buildings.map((building) => ({
        ...building,
        floors: building.floors.map((floor) => ({
          ...floor,
          roomIds: floor.roomIds.filter((id) => roomIds.has(id)),
        })),
      })),
    },
    overrides: document.overrides.filter(
      (edit) =>
        roomIds.has(edit.from_room_id) &&
        roomIds.has(edit.to_room_id) &&
        edit.from_room_id !== edit.to_room_id,
    ),
  };
}
