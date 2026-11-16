import type { RoomDistanceModelsCreate } from "@bod/api-client/types.gen";
import type { ConnectionOperation } from "./connections";

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
import { workspaceKey } from "@/modules/shared/records/api";

const limit = 50;
export const roomKeys = {
  rooms: [...workspaceKey, "rooms", "directory"],
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
