import type { BuildingLayoutRead, RoomConnectionsRead } from "@bod/api-client/types.gen";
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
  number: z.number().int().optional(),
  cost,
  roomIds: z.array(id).max(5000),
});
const building = z.object({
  id,
  name: z.string().trim().min(1).max(100),
  code: z.string().trim().max(30).default(""),
  x: z.number().min(24).max(20000),
  y: z.number().min(100).max(20000),
  betweenFloors: cost,
  floors: z.array(floor).max(25),
});
export const schoolPlanSchema = z
  .object({
    version: z.literal(1),
    betweenBuildings: cost,
    buildings: z.array(building).max(30),
    links: z.array(z.object({ from: id, to: id, cost })).max(435),
  })
  .transform((plan) => ({
    ...plan,
    buildings: plan.buildings.map((item) => ({
      ...item,
      floors: item.floors.map((area, index) => ({
        ...area,
        number: area.number ?? index,
      })),
    })),
  }))
  .superRefine((plan, context) => {
    const ids = new Set<string>();
    const assigned = new Set<string>();
    const buildingCodes = new Set<string>();
    for (const item of plan.buildings) {
      const code = item.code.toLocaleUpperCase("cs");
      if (code && buildingCodes.has(code))
        context.addIssue({ code: "custom", message: "Kód budovy se nesmí opakovat." });
      buildingCodes.add(code);
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
      const floorNumbers = new Set<number>();
      for (const area of item.floors) {
        if (floorNumbers.has(area.number))
          context.addIssue({
            code: "custom",
            message: "Číslo patra se v jedné budově nesmí opakovat.",
          });
        floorNumbers.add(area.number);
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

export function schoolPlanFromLayouts(layouts: BuildingLayoutRead[]): SchoolPlan {
  return {
    ...emptySchoolPlan(),
    buildings: layouts.map((building, index) => ({
      id: building.id,
      code: building.code,
      name: building.name,
      x: 24 + (index % 3) * 350,
      y: 140 + Math.floor(index / 3) * 400,
      betweenFloors: "3",
      floors: [...building.floors]
        .sort((a, b) => a.number - b.number)
        .map((floor) => ({
          id: floor.id,
          name: floor.name?.trim() || (floor.number === 0 ? "Přízemí" : `${floor.number}. patro`),
          number: floor.number,
          cost: "1",
          roomIds: floor.rooms.map((room) => room.id),
        })),
    })),
  };
}

export function mergeSchoolPlans(
  shared: SchoolPlan,
  saved: SchoolPlan,
  preserveUnmatchedSaved = true,
): SchoolPlan {
  const hasSharedPlacements = shared.buildings.some((building) =>
    building.floors.some((floor) => floor.roomIds.length > 0),
  );
  const usedSavedBuildings = new Set<string>();
  const buildingIds = new Map<string, string>();
  const buildings = shared.buildings.map((building) => {
    const savedBuilding = saved.buildings.find(
      (candidate) =>
        !usedSavedBuildings.has(candidate.id) &&
        (candidate.id === building.id ||
          (candidate.code && candidate.code === building.code) ||
          candidate.name.toLocaleLowerCase("cs") === building.name.toLocaleLowerCase("cs")),
    );
    if (!savedBuilding) return building;
    usedSavedBuildings.add(savedBuilding.id);
    buildingIds.set(savedBuilding.id, building.id);
    const floors = building.floors.map((floor, index) => {
      const savedFloor =
        savedBuilding.floors.find((candidate) => candidate.id === floor.id) ??
        savedBuilding.floors.find(
          (candidate) =>
            candidate.number === floor.number &&
            candidate.name.toLocaleLowerCase("cs") === floor.name.toLocaleLowerCase("cs"),
        ) ??
        savedBuilding.floors.find(
          (candidate) =>
            candidate.name.toLocaleLowerCase("cs") === floor.name.toLocaleLowerCase("cs"),
        ) ??
        savedBuilding.floors[index];
      return savedFloor
        ? {
            ...floor,
            cost: savedFloor.cost,
            roomIds: hasSharedPlacements ? floor.roomIds : savedFloor.roomIds,
          }
        : floor;
    });
    return {
      ...building,
      x: savedBuilding.x,
      y: savedBuilding.y,
      betweenFloors: savedBuilding.betweenFloors,
      floors,
    };
  });
  const unassignedSaved = saved.buildings.filter(
    (building) => !usedSavedBuildings.has(building.id),
  );
  const roomIds = new Set(
    shared.buildings.flatMap((building) => building.floors.flatMap((floor) => floor.roomIds)),
  );
  const added = preserveUnmatchedSaved
    ? unassignedSaved.map((building) => {
        const copied = {
          ...building,
          floors: building.floors.map((floor) => ({
            ...floor,
            roomIds: hasSharedPlacements ? [] : floor.roomIds.filter((id) => !roomIds.has(id)),
          })),
        };
        buildingIds.set(building.id, copied.id);
        return copied;
      })
    : [];
  const allBuildings = [...buildings, ...added];
  const validBuildings = new Set(allBuildings.map((building) => building.id));
  return {
    ...shared,
    betweenBuildings: saved.betweenBuildings,
    buildings: allBuildings,
    links: saved.links
      .filter(
        (link) =>
          validBuildings.has(buildingIds.get(link.from) ?? link.from) &&
          validBuildings.has(buildingIds.get(link.to) ?? link.to),
      )
      .map((link) => ({
        ...link,
        from: buildingIds.get(link.from) ?? link.from,
        to: buildingIds.get(link.to) ?? link.to,
      })),
  };
}

export function suggestBuildingCode(name: string, existing: string[]): string {
  const base =
    name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 24) || "BUDOVA";
  const used = new Set(existing.map((code) => code.toLocaleUpperCase("cs")));
  if (!used.has(base)) return base;
  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${base.slice(0, 29 - String(suffix).length)}-${suffix}`;
    if (!used.has(candidate)) return candidate;
  }
}

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
  sharedLayout: z.literal(true).optional(),
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
