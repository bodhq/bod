"use client";

import type { RoomDistanceModelsCreate, RoomDistanceModelsRead } from "@bod/api-client/types.gen";
import type { ConnectionRequest } from "../connections";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";

import { useAuthStore } from "@/core/auth/store";
import { workspaceKey } from "@/modules/shared/records/api";
import { usePermissions } from "@/modules/shared/records/hooks";

import {
  getBuildingLayouts,
  getConnections,
  getDistanceModel,
  getDistanceModels,
  getRooms,
  roomKeys,
  saveDistanceModel,
  saveSchoolLayout,
  writeConnection,
} from "../api";
import { applyConnections, connectionKey, planConnectionEdits, roomOption } from "../connections";

export function useRoomTransfers() {
  const client = useQueryClient();
  const allowed = usePermissions()("rooms.manage");
  const roomsQuery = useQuery({
    queryKey: roomKeys.rooms,
    queryFn: ({ signal }) => getRooms(signal),
    enabled: allowed,
  });
  const layoutsQuery = useQuery({
    queryKey: roomKeys.layouts,
    queryFn: ({ signal }) => getBuildingLayouts(signal),
    enabled: allowed,
  });
  const modelsQuery = useQuery({
    queryKey: roomKeys.models,
    queryFn: ({ signal }) => getDistanceModels(signal),
    enabled: allowed,
  });
  const connectionsQuery = useQuery({
    queryKey: roomKeys.connections,
    queryFn: ({ signal }) => getConnections(signal),
    enabled: allowed,
  });
  const queries = [roomsQuery, layoutsQuery, modelsQuery, connectionsQuery];
  const rooms = useMemo(
    () =>
      [...(roomsQuery.data ?? [])].sort((a, b) =>
        roomOption(a).localeCompare(roomOption(b), "cs", { numeric: true }),
      ),
    [roomsQuery.data],
  );
  const models = useMemo(() => modelsQuery.data ?? [], [modelsQuery.data]);
  const [modelId, setModelId] = useState("");
  const [notice, setNotice] = useState("");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const active = useRef(true);
  const writing = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const model = modelId ? models.find((row) => row.id === modelId) : models[0];
  useEffect(() => {
    // Keep the selected model stable when the directory changes order.
    if (!modelId || (modelsQuery.isSuccess && !models.some((item) => item.id === modelId)))
      setModelId(models[0]?.id ?? "");
  }, [modelId, models, modelsQuery.isSuccess]);
  const connections = useMemo(
    () => (connectionsQuery.data ?? []).filter((edge) => edge.distance_model_id === model?.id),
    [connectionsQuery.data, model?.id],
  );
  const persistSchoolPlan = async (
    plan: Parameters<typeof saveSchoolLayout>[0],
    ensureCurrent: () => void = () => {},
  ) => {
    ensureCurrent();
    const [latestLayouts, latestRooms] = await Promise.all([getBuildingLayouts(), getRooms()]);
    ensureCurrent();
    const saved = await saveSchoolLayout(plan, latestLayouts, latestRooms, ensureCurrent);
    await Promise.all([
      client.invalidateQueries({ queryKey: roomKeys.layouts }),
      client.invalidateQueries({ queryKey: roomKeys.rooms }),
      client.invalidateQueries({ queryKey: workspaceKey }),
    ]);
    return saved;
  };
  const locked = !allowed || !!model?.frozen_at;
  const mutation = useMutation({
    onMutate: () => useAuthStore.getState().sessionVersion,
    mutationFn: async (request: ConnectionRequest) => {
      const version = request.sessionVersion ?? useAuthStore.getState().sessionVersion;
      const current = () => {
        if (!active.current || version !== useAuthStore.getState().sessionVersion)
          throw new DOMException("Ukládání bylo přerušeno.", "AbortError");
      };
      current();
      setProgress({ done: 0, total: 0 });
      setNotice("");
      if (!allowed) throw new Error("K úpravě přesunů nemáte oprávnění.");
      const ids = new Set(rooms.map((room) => room.id));
      const invalid = request.edits.some(
        (edit) => !ids.has(edit.from_room_id) || !ids.has(edit.to_room_id),
      );
      if (invalid) throw new Error("Některá z vybraných učeben už není k dispozici.");
      try {
        // A retry re-reads persisted edges, including writes whose previous response was lost.
        const [latestModel, latestEdges] = await Promise.all([
          getDistanceModel(request.modelId),
          getConnections(),
        ]);
        current();
        client.setQueryData<RoomDistanceModelsRead[]>(roomKeys.models, (previous = []) =>
          previous.map((item) => (item.id === latestModel.id ? latestModel : item)),
        );
        client.setQueryData(roomKeys.connections, latestEdges);
        if (latestModel.frozen_at)
          throw new Error("Model byl mezitím uzamčen. Přesuny už nelze měnit.");
        const operations = planConnectionEdits(request.modelId, request.edits, latestEdges);
        const nextEdges = new Map(latestEdges.map((edge) => [connectionKey(edge), edge]));
        let completed = 0;
        let lastPublished = 0;
        const publish = () => {
          if (!active.current || version !== useAuthStore.getState().sessionVersion) return;
          client.setQueryData(roomKeys.connections, [...nextEdges.values()]);
          setProgress({ done: completed, total: operations.length });
          lastPublished = Date.now();
        };
        try {
          await applyConnections(
            operations,
            async (operation) => {
              current();
              const result = await writeConnection(operation);
              current();
              if (result) nextEdges.set(connectionKey(operation), result);
              else nextEdges.delete(connectionKey(operation));
            },
            (done) => {
              completed = done;
              if (done === 0 || done === operations.length || Date.now() - lastPublished >= 100)
                publish();
            },
          );
        } finally {
          publish();
        }
        return operations.length;
      } finally {
        if (version === useAuthStore.getState().sessionVersion)
          await client.invalidateQueries({ queryKey: workspaceKey });
      }
    },
    onSuccess: (count, _request, version) => {
      if (!active.current || version !== useAuthStore.getState().sessionVersion) return;
      setNotice(count ? "Přesuny jsou uložené." : "Všechny vybrané přesuny už odpovídají zadání.");
    },
  });
  const apply = async (request: ConnectionRequest) => {
    if (writing.current) throw new Error("Počkejte na dokončení ukládání.");
    writing.current = true;
    try {
      return await mutation.mutateAsync(request);
    } finally {
      writing.current = false;
    }
  };
  const saveModel = async (id: string | undefined, body: RoomDistanceModelsCreate) => {
    const version = useAuthStore.getState().sessionVersion;
    const result = await saveDistanceModel(id, body);
    if (!active.current || version !== useAuthStore.getState().sessionVersion)
      throw new DOMException("Ukládání bylo přerušeno.", "AbortError");
    client.setQueryData<RoomDistanceModelsRead[]>(roomKeys.models, (previous = []) => [
      ...previous.filter((item) => item.id !== result.id),
      result,
    ]);
    setModelId(result.id);
    setNotice("");
    setProgress({ done: 0, total: 0 });
    mutation.reset();
    return result;
  };
  return {
    allowed,
    rooms,
    buildingLayouts: layoutsQuery.data ?? [],
    models,
    model,
    connections,
    locked,
    loading: queries.some((query) => query.isPending),
    error: queries.find((query) => query.isError)?.error,
    retry: () => Promise.all(queries.map((query) => query.refetch())),
    mutation,
    progress,
    notice,
    apply,
    saveModel,
    persistSchoolPlan,
    chooseModel: (id: string) => {
      if (writing.current) return;
      setModelId(id);
      setNotice("");
      mutation.reset();
    },
  };
}
