import type { ReactNode } from "react";
import type { User } from "@/core/auth/api";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { useAuthStore } from "@/core/auth/store";
import {
  getConnections,
  getDistanceModel,
  getDistanceModels,
  getRooms,
  roomKeys,
  saveDistanceModel,
  writeConnection,
} from "@/modules/rooms/api";
import { connectionKey } from "@/modules/rooms/connections";
import { useRoomTransfers } from "@/modules/rooms/hooks/useRoomTransfers";
import { useTransferSetup } from "@/modules/rooms/hooks/useTransferSetup";
import { emptySchoolPlan, schoolPlanStorageKey } from "@/modules/rooms/school-plan";

vi.mock("@/core/ui/overlays/ConfirmProvider", () => ({ useConfirm: () => vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/modules/rooms/api", () => ({
  roomKeys: {
    rooms: ["module-records", "rooms"],
    models: ["module-records", "models"],
    connections: ["module-records", "connections"],
  },
  getConnections: vi.fn(),
  getDistanceModel: vi.fn(),
  getDistanceModels: vi.fn(),
  getRooms: vi.fn(),
  writeConnection: vi.fn(),
  saveDistanceModel: vi.fn(),
}));
const user = { id: "admin", active_role: "admin", permissions: ["rooms.manage"] } as User;
const model = {
  id: "model",
  name: "Škola",
  description: null,
  frozen_at: null as string | null,
  created_at: "2026-11-09T00:00:00Z",
};
let client: QueryClient;
let persisted: Awaited<ReturnType<typeof getConnections>>;

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  persisted = [];
  model.frozen_at = null;
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  useAuthStore.getState().setSessionUser(user);
  vi.mocked(getRooms).mockResolvedValue(
    Array.from({ length: 9 }, (_, index) => ({
      id: `room-${index}`,
      code: String(index),
      name: `Učebna ${index}`,
      capacity: 30,
      is_active: true,
      room_type_code: "normal",
    })),
  );
  vi.mocked(getDistanceModels).mockImplementation(async () => [{ ...model }]);
  vi.mocked(getDistanceModel).mockImplementation(async () => ({ ...model }));
  vi.mocked(getConnections).mockImplementation(async () => [...persisted]);
  vi.mocked(writeConnection).mockImplementation(async (operation) => {
    const { distance_model_id, from_room_id, to_room_id } = operation;
    const identity = { distance_model_id, from_room_id, to_room_id };
    const row = operation.kind === "delete" ? null : { ...identity, relative_cost: operation.cost };
    persisted = [
      ...persisted.filter((edge) => connectionKey(edge) !== connectionKey(operation)),
      ...(row ? [row] : []),
    ];
    return row;
  });
});
afterEach(() => {
  cleanup();
  client.clear();
});
function Wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
function setup() {
  return renderHook(() => useRoomTransfers(), { wrapper: Wrapper });
}

const request = {
  modelId: model.id,
  edits: [
    { from_room_id: "room-0", to_room_id: "room-1", cost: "3" },
    { from_room_id: "room-1", to_room_id: "room-0", cost: "3" },
  ],
};

it("rejects a draft that refers to a room removed from the directory", async () => {
  const { result } = setup();
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => {
    await expect(
      result.current.apply({
        ...request,
        edits: [{ from_room_id: "room-0", to_room_id: "deleted", cost: "3" }],
      }),
    ).rejects.toThrow("už není k dispozici");
  });
  expect(getDistanceModel).not.toHaveBeenCalled();
  expect(writeConnection).not.toHaveBeenCalled();
});

it("writes only explicit directions and preserves an asymmetric reverse value", async () => {
  persisted = [
    {
      distance_model_id: "model",
      from_room_id: "room-1",
      to_room_id: "room-0",
      relative_cost: "7",
    },
  ];
  const { result } = setup();
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => {
    await result.current.apply({ ...request, edits: request.edits.slice(0, 1) });
  });
  expect(writeConnection).toHaveBeenCalledTimes(1);
  expect(persisted.find((edge) => edge.from_room_id === "room-1")?.relative_cost).toBe("7");
});

it("keeps the selected model when another model is inserted earlier", async () => {
  const { result } = setup();
  await waitFor(() => expect(result.current.loading).toBe(false));
  act(() => {
    client.setQueryData(roomKeys.models, [{ ...model, id: "earlier-model" }, model]);
  });
  expect(result.current.model?.id).toBe("model");
});

it("re-reads the server before retrying a response lost after a successful write", async () => {
  const normalWrite = vi.mocked(writeConnection).getMockImplementation();
  if (!normalWrite) throw new Error("Missing writer");
  let writes = 0;
  vi.mocked(writeConnection).mockImplementation(async (operation) => {
    const row = await normalWrite(operation);
    if (++writes === 2) throw new Error("Spojení přerušeno po zápisu.");
    return row;
  });
  const { result } = setup();
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => {
    await expect(result.current.apply(request)).rejects.toThrow("přerušeno");
  });
  expect(persisted).toHaveLength(2);
  await act(async () => {
    await result.current.apply(request);
  });
  expect(writeConnection).toHaveBeenCalledTimes(2);
  expect(result.current.notice).toContain("už odpovídají");
});

it("checks model locking again before a mutation", async () => {
  const { result } = setup();
  await waitFor(() => expect(result.current.loading).toBe(false));
  model.frozen_at = "2026-11-09T01:00:00Z";
  await act(async () => {
    await expect(result.current.apply(request)).rejects.toThrow("uzamčen");
  });
  expect(writeConnection).not.toHaveBeenCalled();
  expect(result.current.locked).toBe(true);
});

it("does not request the room directory for a user without permission", async () => {
  useAuthStore.getState().setSessionUser({ ...user, permissions: [] });
  const { result } = setup();
  expect(result.current.allowed).toBe(false);
  expect(getRooms).not.toHaveBeenCalled();
});
it("rejects a queued plan write from a previous session before reading or writing", async () => {
  const { result } = setup();
  await waitFor(() => expect(result.current.loading).toBe(false));
  const previous = useAuthStore.getState().sessionVersion;
  useAuthStore.getState().setSessionUser(user);
  vi.mocked(getConnections).mockClear();
  vi.mocked(getDistanceModel).mockClear();
  await act(async () => {
    await expect(
      result.current.apply({
        modelId: model.id,
        edits: [{ from_room_id: "room-0", to_room_id: "room-1", cost: "1" }],
        sessionVersion: previous,
      }),
    ).rejects.toThrow("přerušeno");
  });
  expect(getConnections).not.toHaveBeenCalled();
  expect(getDistanceModel).not.toHaveBeenCalled();
  expect(writeConnection).not.toHaveBeenCalled();
});

async function setupWizard(existing = false) {
  client.setQueryData(roomKeys.rooms, await getRooms());
  client.setQueryData(roomKeys.models, [model]);
  client.setQueryData(roomKeys.connections, persisted);
  const complete = vi.fn();
  const hook = renderHook(
    () => {
      const editor = useRoomTransfers();
      return useTransferSetup(editor, existing ? model : undefined, complete);
    },
    { wrapper: Wrapper },
  );
  return { ...hook, complete };
}

it("keeps different difficulty edits across rooms and steps without writing", async () => {
  const { result } = await setupWizard();
  expect(result.current.stages).toHaveLength(3);
  act(() => result.current.assign(["room-1"], "1"));
  act(() => result.current.assign(["room-2"], "5"));
  act(() => result.current.setOriginId("room-1"));
  act(() => result.current.assign(["room-2"], "3"));
  act(() => result.current.setStep(2));
  act(() => result.current.setStep(1));
  expect(result.current.edits).toHaveLength(6);
  expect(result.current.edits.map((edit) => edit.cost)).toEqual(["1", "1", "5", "5", "3", "3"]);
  expect(saveDistanceModel).not.toHaveBeenCalled();
  expect(writeConnection).not.toHaveBeenCalled();
});

it("undoes the last classification and returns to the room that changed", async () => {
  const { result } = await setupWizard();
  act(() => result.current.assign(["room-1"], "1"));
  act(() => result.current.setOriginId("room-2"));
  act(() => result.current.assign(["room-1"], "5"));
  act(() => result.current.setOriginId("room-3"));
  act(() => result.current.undo());
  expect(result.current.origin?.id).toBe("room-2");
  expect(result.current.edits).toHaveLength(2);
  expect(result.current.edits.every((edit) => edit.cost === "1")).toBe(true);
  act(() => result.current.undo());
  expect(result.current.edits).toHaveLength(0);
});

it("resumes mixed costs after partial writes without creating another model", async () => {
  const created = { ...model, id: "created" };
  vi.mocked(saveDistanceModel).mockResolvedValue(created);
  vi.mocked(getDistanceModels).mockResolvedValue([model, created]);
  vi.mocked(getDistanceModel).mockResolvedValue(created);
  const writer = vi.mocked(writeConnection).getMockImplementation();
  if (!writer) throw new Error("Missing writer");
  let count = 0;
  vi.mocked(writeConnection).mockImplementation(async (operation) => {
    if (++count === 2) throw new Error("Přerušené spojení.");
    return writer(operation);
  });
  const { result, complete } = await setupWizard();
  act(() => result.current.assign(["room-1"], "1"));
  act(() => result.current.assign(["room-2"], "5"));
  act(() => result.current.setStep(2));
  await act(async () => {
    await expect(result.current.save.mutateAsync()).rejects.toThrow("Přerušené");
  });
  expect(persisted).toHaveLength(1);
  expect(result.current.persisted).toBe(true);
  expect(complete).not.toHaveBeenCalled();
  await act(async () => {
    await result.current.save.mutateAsync();
  });
  expect(persisted).toHaveLength(4);
  expect(persisted.map((edge) => edge.relative_cost).sort()).toEqual(["1", "1", "5", "5"]);
  expect(saveDistanceModel).toHaveBeenCalledTimes(1);
  expect(writeConnection).toHaveBeenCalledTimes(5);
  expect(complete).toHaveBeenCalledTimes(1);
});

it("uses two steps for an existing model and never creates a replacement", async () => {
  const { result, complete } = await setupWizard(true);
  expect(result.current.stages).toHaveLength(2);
  expect(result.current.canContinue).toBe(false);
  act(() => result.current.assign(["room-1"], "3"));
  act(() => result.current.setStep(1));
  await act(async () => {
    await result.current.save.mutateAsync();
  });
  expect(saveDistanceModel).not.toHaveBeenCalled();
  expect(persisted).toHaveLength(2);
  expect(persisted.every((edge) => edge.distance_model_id === model.id)).toBe(true);
  expect(complete).toHaveBeenCalledTimes(1);
});

it("does not assign costs to unedited rooms and can find the next missing origin", async () => {
  const { result } = await setupWizard();
  act(() => result.current.assign(["room-1"], "1"));
  expect(result.current.missing).toBe(70);
  expect(result.current.effective).toHaveLength(2);
  act(() => result.current.nextMissing());
  expect(result.current.origin?.id).toBe("room-1");
});

it("can preserve the reverse direction while editing several costs", async () => {
  const { result } = await setupWizard();
  act(() => result.current.setBoth(false));
  act(() => result.current.assign(["room-1"], "1"));
  act(() => result.current.assign(["room-2"], "5"));
  expect(result.current.edits).toHaveLength(2);
  expect(result.current.edits.every((edit) => edit.from_room_id === "room-0")).toBe(true);
});

it("rejects an invalid cost before creating a model", async () => {
  const { result } = await setupWizard();
  expect(() => result.current.assign(["room-1"], "-1")).toThrow("kladné");
  expect(() => result.current.assign(["room-0"], "1")).toThrow("samu se sebou");
  await act(async () => {
    await expect(result.current.save.mutateAsync()).rejects.toThrow("zařaďte");
  });
  expect(saveDistanceModel).not.toHaveBeenCalled();
  expect(writeConnection).not.toHaveBeenCalled();
});

it("can prepare a new model while the previously selected one is frozen", async () => {
  model.frozen_at = "2026-11-09T01:00:00Z";
  const created = { ...model, id: "new-unlocked", frozen_at: null };
  vi.mocked(saveDistanceModel).mockResolvedValue(created);
  vi.mocked(getDistanceModels).mockResolvedValue([model, created]);
  vi.mocked(getDistanceModel).mockResolvedValue(created);
  const { result } = await setupWizard();
  act(() => result.current.assign(["room-1"], "1"));
  await act(async () => {
    await result.current.save.mutateAsync();
  });
  expect(persisted).toHaveLength(2);
  expect(persisted.every((edge) => edge.distance_model_id === created.id)).toBe(true);
});

it("derives rules from areas and lets a room exception take precedence", async () => {
  const { result } = await setupWizard();
  const plan = {
    ...emptySchoolPlan(),
    buildings: [
      {
        id: "a",
        name: "Hlavní",
        x: 24,
        y: 140,
        betweenFloors: "3",
        floors: [{ id: "a0", name: "Přízemí", cost: "1", roomIds: ["room-0", "room-1", "room-2"] }],
      },
    ],
  };
  act(() => result.current.changePlan(plan));
  expect(result.current.operations).toHaveLength(6);
  act(() => result.current.assign(["room-1"], "5"));
  expect(
    result.current.effective.find(
      (edge) => edge.from_room_id === "room-0" && edge.to_room_id === "room-1",
    )?.relative_cost,
  ).toBe("5");
  act(() => result.current.undo());
  expect(result.current.effective.every((edge) => edge.relative_cost === "1")).toBe(true);
  act(() => result.current.undo());
  expect(result.current.plan.buildings).toHaveLength(0);
});

it("restores this user's local layout and does not replace edits on directory refresh", async () => {
  const document = {
    plan: {
      ...emptySchoolPlan(),
      buildings: [
        {
          id: "a",
          name: "Hlavní",
          x: 24,
          y: 140,
          betweenFloors: "3",
          floors: [{ id: "a0", name: "Přízemí", cost: "1", roomIds: ["room-0", "room-1"] }],
        },
      ],
    },
    overrides: [],
    applyExisting: false,
  };
  localStorage.setItem(schoolPlanStorageKey(user.id, model.id), JSON.stringify(document));
  const { result } = await setupWizard(true);
  await waitFor(() => expect(result.current.localReady).toBe(true));
  expect(result.current.plan.buildings[0]?.name).toBe("Hlavní");
  act(() => result.current.changePlan({ ...result.current.plan, betweenBuildings: "8" }));
  act(() => client.setQueryData(roomKeys.rooms, []));
  expect(result.current.plan.betweenBuildings).toBe("8");
});

it("does not load another user's local layout", async () => {
  localStorage.setItem(
    schoolPlanStorageKey("someone-else", model.id),
    JSON.stringify({
      plan: { ...emptySchoolPlan(), buildings: [] },
      overrides: [{ from_room_id: "room-0", to_room_id: "room-1", cost: "8" }],
      applyExisting: true,
    }),
  );
  const { result } = await setupWizard(true);
  await waitFor(() => expect(result.current.localReady).toBe(true));
  expect(result.current.edits).toHaveLength(0);
  expect(result.current.applyExisting).toBe(false);
});

it("keeps export available if the API saves but browser storage fails", async () => {
  const created = { ...model, id: "created" };
  vi.mocked(saveDistanceModel).mockResolvedValue(created);
  vi.mocked(getDistanceModel).mockResolvedValue(created);
  vi.mocked(getDistanceModels).mockResolvedValue([model, created]);
  const { result, complete } = await setupWizard();
  act(() => result.current.assign(["room-1"], "1"));
  const storage = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("Storage blocked");
  });
  try {
    await act(async () => {
      await result.current.save.mutateAsync();
    });
    expect(persisted).toHaveLength(2);
    expect(result.current.storageFailed).toBe(true);
    expect(complete).not.toHaveBeenCalled();
  } finally {
    storage.mockRestore();
  }
});

it("saves a hundred-room plan through the existing endpoints with exact final progress", async () => {
  const indexed = new Map<string, (typeof persisted)[number]>();
  vi.mocked(writeConnection).mockImplementation(async (operation) => {
    if (operation.kind !== "create") throw new Error("Expected a new connection");
    const identity = connectionKey(operation);
    if (indexed.has(identity)) throw new Error("Duplicate connection");
    const { distance_model_id, from_room_id, to_room_id, cost } = operation;
    const row = { distance_model_id, from_room_id, to_room_id, relative_cost: cost };
    indexed.set(identity, row);
    persisted.push(row);
    return row;
  });
  vi.mocked(getRooms).mockResolvedValue(
    Array.from({ length: 100 }, (_, index) => ({
      id: `room-${index}`,
      code: String(index),
      name: null,
      capacity: 30,
      is_active: true,
      room_type_code: "normal",
    })),
  );
  const created = { ...model, id: "hundred" };
  vi.mocked(saveDistanceModel).mockResolvedValue(created);
  vi.mocked(getDistanceModel).mockResolvedValue(created);
  vi.mocked(getDistanceModels).mockResolvedValue([model, created]);
  const { result, complete } = await setupWizard();
  act(() =>
    result.current.changePlan({
      ...emptySchoolPlan(),
      buildings: [
        {
          id: "a",
          name: "Škola",
          x: 24,
          y: 140,
          betweenFloors: "3",
          floors: [
            {
              id: "a0",
              name: "Přízemí",
              cost: "1",
              roomIds: Array.from({ length: 100 }, (_, index) => `room-${index}`),
            },
          ],
        },
      ],
    }),
  );
  expect(result.current.operations).toHaveLength(9900);
  await act(async () => {
    await result.current.save.mutateAsync();
  });
  expect(persisted).toHaveLength(9900);
  expect(writeConnection).toHaveBeenCalledTimes(9900);
  expect(saveDistanceModel).toHaveBeenCalledTimes(1);
  expect(complete).toHaveBeenCalledTimes(1);
  expect(result.current.missing).toBe(0);
}, 15000);
