import type {
  BuildingFloorsRead,
  BuildingLayoutRead,
  BuildingsRead,
  RoomDistanceModelsCreate,
  RoomsRead,
} from "@bod/api-client/types.gen";
import type { ConnectionOperation } from "./connections";
import type { SchoolPlan } from "./school-plan";

import {
  createRoomConnectionsApiV1RoomsRoomConnectionsPost,
  createRoomDistanceModelsApiV1RoomsRoomDistanceModelsPost,
  deleteRoomConnectionsApiV1RoomsRoomConnectionsDistanceModelIdFromRoomIdToRoomIdDelete,
  getRoomDistanceModelsApiV1RoomsRoomDistanceModelsIdGet,
  listRoomConnectionsApiV1RoomsRoomConnectionsGet,
  listRoomDistanceModelsApiV1RoomsRoomDistanceModelsGet,
  listRoomsApiV1RoomsGet,
  patchRoomConnectionsApiV1RoomsRoomConnectionsDistanceModelIdFromRoomIdToRoomIdPatch,
  patchRoomDistanceModelsApiV1RoomsRoomDistanceModelsIdPatch,
} from "@bod/api-client/sdk.gen";

import { apiClient } from "@/core/api/client";
import { apiData, apiVoid } from "@/core/api/result";
import { request, workspaceKey } from "@/modules/shared/records/api";

import { planLocations, suggestBuildingCode } from "./school-plan";

const limit = 50;
export const roomKeys = {
  rooms: [...workspaceKey, "rooms", "directory"],
  layouts: [...workspaceKey, "rooms", "building-layouts"],
  models: [...workspaceKey, "rooms", "distance-models"],
  connections: [...workspaceKey, "rooms", "connections"],
};
async function pages<T>(load: (offset: number) => Promise<T[]>, signal?: AbortSignal) {
  const result: T[] = [];
  for (let offset = 0; ; offset += limit) {
    signal?.throwIfAborted();
    const page = await load(offset);
    result.push(...page);
    if (page.length < limit) return result;
  }
}
export const getRooms = (signal?: AbortSignal) =>
  pages(
    async (offset) =>
      apiData(
        await listRoomsApiV1RoomsGet({ client: apiClient, signal, query: { offset, limit } }),
      ),
    signal,
  );
export const getBuildingLayouts = (signal?: AbortSignal) =>
  pages(
    async (offset) =>
      request<BuildingsRead[]>("GET", "/api/v1/rooms/buildings", {
        signal,
        query: { offset, limit },
      }),
    signal,
  ).then((buildings) =>
    Promise.all(
      buildings.map((building) =>
        request<BuildingLayoutRead>(
          "GET",
          `/api/v1/rooms/buildings/${encodeURIComponent(building.id)}/layout`,
          { signal },
        ),
      ),
    ),
  );

export async function saveSchoolLayout(
  plan: SchoolPlan,
  layouts: BuildingLayoutRead[],
  rooms: RoomsRead[],
  ensureCurrent: () => void = () => {},
): Promise<SchoolPlan> {
  ensureCurrent();
  const buildingIds = new Map<string, string>();
  const floorIds = new Map<string, string>();
  const currentBuildings = layouts;
  const currentFloors = layouts.flatMap((building) => building.floors);
  const usedCodes = new Set(layouts.map((building) => building.code.toLocaleUpperCase("cs")));
  const buildingCodes = new Map<string, string>();

  for (const building of plan.buildings) {
    const code = building.code.trim() || suggestBuildingCode(building.name, [...usedCodes]);

    const existing =
      currentBuildings.find((item) => item.id === building.id) ??
      currentBuildings.find(
        (item) => item.code.toLocaleUpperCase("cs") === code.toLocaleUpperCase("cs"),
      );
    const saved = existing
      ? existing.name === building.name && existing.code === code
        ? existing
        : await request<BuildingsRead>("PATCH", `/api/v1/rooms/buildings/${existing.id}`, {
            body: { name: building.name, code },
          }).then((updated) => ({ ...existing, ...updated }))
      : await request<BuildingsRead>("POST", "/api/v1/rooms/buildings", {
          body: { name: building.name, code, address: null },
        }).then((created) => ({ ...created, floors: [] }));
    buildingIds.set(building.id, saved.id);
    buildingCodes.set(building.id, saved.code);
    usedCodes.add(saved.code.toLocaleUpperCase("cs"));
    ensureCurrent();
  }

  const desiredFloors = new Set<string>();
  for (const building of plan.buildings) {
    const buildingId = buildingIds.get(building.id);
    if (!buildingId) throw new Error("Některou budovu se nepodařilo uložit.");
    for (const [index, floor] of building.floors.entries()) {
      const number = floor.number ?? index;
      const existing =
        currentFloors.find((item) => item.id === floor.id) ??
        currentFloors.find((item) => item.building_id === buildingId && item.number === number);
      const saved = existing
        ? existing.building_id === buildingId &&
          existing.number === number &&
          existing.name === floor.name
          ? existing
          : await request<BuildingFloorsRead>(
              "PATCH",
              `/api/v1/rooms/building-floors/${existing.id}`,
              { body: { building_id: buildingId, number, name: floor.name } },
            )
        : await request<BuildingFloorsRead>("POST", "/api/v1/rooms/building-floors", {
            body: { building_id: buildingId, number, name: floor.name },
          });
      floorIds.set(floor.id, saved.id);
      desiredFloors.add(saved.id);
      ensureCurrent();
    }
  }

  const locations = planLocations(plan);
  const desiredRoomFloors = new Map<string, string>();
  for (const [roomId, location] of locations) {
    const floorId = floorIds.get(location.floor.id);
    if (!floorId) throw new Error("Některé patro se nepodařilo uložit.");
    desiredRoomFloors.set(roomId, floorId);
  }
  const knownRoomIds = new Set(rooms.map((room) => room.id));
  for (const roomId of desiredRoomFloors.keys())
    if (!knownRoomIds.has(roomId)) throw new Error("Plán obsahuje učebnu, která už ve škole není.");

  for (const room of rooms) {
    const floorId = desiredRoomFloors.get(room.id) ?? null;
    if (room.floor_id === floorId) continue;
    await request<RoomsRead>("PATCH", `/api/v1/rooms/${room.id}`, {
      body: {
        floor_id: floorId,
        x: null,
        y: null,
        width: null,
        height: null,
      },
    });
    ensureCurrent();
  }

  for (const floor of currentFloors)
    if (!desiredFloors.has(floor.id)) {
      ensureCurrent();
      apiVoid(await apiClient.delete({ url: `/api/v1/rooms/building-floors/${floor.id}` }));
      ensureCurrent();
    }
  const desiredBuildings = new Set(buildingIds.values());
  for (const building of layouts)
    if (!desiredBuildings.has(building.id)) {
      ensureCurrent();
      apiVoid(await apiClient.delete({ url: `/api/v1/rooms/buildings/${building.id}` }));
      ensureCurrent();
    }

  const remappedIds = new Map([...buildingIds, ...floorIds]);
  return {
    ...plan,
    buildings: plan.buildings.map((building) => ({
      ...building,
      id: buildingIds.get(building.id) ?? building.id,
      code: buildingCodes.get(building.id) ?? building.code,
      floors: building.floors.map((floor) => ({
        ...floor,
        id: floorIds.get(floor.id) ?? floor.id,
      })),
    })),
    links: plan.links.map((link) => ({
      ...link,
      from: remappedIds.get(link.from) ?? link.from,
      to: remappedIds.get(link.to) ?? link.to,
    })),
  };
}
export const getDistanceModels = (signal?: AbortSignal) =>
  pages(
    async (offset) =>
      apiData(
        await listRoomDistanceModelsApiV1RoomsRoomDistanceModelsGet({
          client: apiClient,
          signal,
          query: { offset, limit },
        }),
      ),
    signal,
  );
export const getConnections = (signal?: AbortSignal) =>
  pages(
    async (offset) =>
      apiData(
        await listRoomConnectionsApiV1RoomsRoomConnectionsGet({
          client: apiClient,
          signal,
          query: { offset, limit },
        }),
      ),
    signal,
  );

export async function getDistanceModel(id: string) {
  return apiData(
    await getRoomDistanceModelsApiV1RoomsRoomDistanceModelsIdGet({
      client: apiClient,
      path: { id },
    }),
  );
}
export async function saveDistanceModel(id: string | undefined, body: RoomDistanceModelsCreate) {
  return id
    ? apiData(
        await patchRoomDistanceModelsApiV1RoomsRoomDistanceModelsIdPatch({
          client: apiClient,
          path: { id },
          body,
        }),
      )
    : apiData(
        await createRoomDistanceModelsApiV1RoomsRoomDistanceModelsPost({ client: apiClient, body }),
      );
}
export async function writeConnection(operation: ConnectionOperation) {
  const path = {
    distance_model_id: operation.distance_model_id,
    from_room_id: operation.from_room_id,
    to_room_id: operation.to_room_id,
  };
  if (operation.kind === "delete") {
    apiVoid(
      await deleteRoomConnectionsApiV1RoomsRoomConnectionsDistanceModelIdFromRoomIdToRoomIdDelete({
        client: apiClient,
        path,
      }),
    );
    return null;
  }
  if (operation.kind === "update")
    return apiData(
      await patchRoomConnectionsApiV1RoomsRoomConnectionsDistanceModelIdFromRoomIdToRoomIdPatch({
        client: apiClient,
        path,
        body: { relative_cost: operation.cost },
      }),
    );
  return apiData(
    await createRoomConnectionsApiV1RoomsRoomConnectionsPost({
      client: apiClient,
      body: { ...path, relative_cost: operation.cost },
    }),
  );
}
