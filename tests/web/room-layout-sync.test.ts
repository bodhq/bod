import type { RoomsRead } from "@bod/api-client/types.gen";

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  delete: vi.fn(),
  request: vi.fn(),
}));

vi.mock("@/core/api/client", () => ({ apiClient: { delete: mocks.delete } }));
vi.mock("@/modules/shared/records/api", () => ({
  request: mocks.request,
  workspaceKey: ["module-records"],
}));

import { getBuildingLayouts, saveSchoolLayout } from "@/modules/rooms/api";
import { emptySchoolPlan } from "@/modules/rooms/school-plan";

const room: RoomsRead = {
  id: "room-1",
  code: "101",
  name: null,
  room_type_code: "classroom",
  capacity: 30,
  is_active: true,
  floor_id: null,
  x: null,
  y: null,
  width: null,
  height: null,
};

describe("shared building layout synchronization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.request.mockImplementation(async (method: string, url: string, options = {}) => {
      const body = options.body ?? {};
      if (method === "POST" && url === "/api/v1/rooms/buildings")
        return { ...body, id: "saved-building" };
      if (method === "POST" && url === "/api/v1/rooms/building-floors")
        return { ...body, id: "saved-floor", width: 1000, height: 1000 };
      if (method === "PATCH" && url === "/api/v1/rooms/room-1") return { ...room, ...body };
      throw new Error(`Unexpected request: ${method} ${url}`);
    });
    mocks.delete.mockResolvedValue({ response: new Response(null, { status: 204 }) });
  });

  it("loads the shared aggregate layout for each building", async () => {
    const layout = {
      id: "building-1",
      code: "MAIN",
      name: "Hlavní budova",
      address: null,
      floors: [],
    };
    mocks.request.mockImplementation(async (_method: string, url: string) => {
      if (url === "/api/v1/rooms/buildings") return [layout];
      if (url === "/api/v1/rooms/buildings/building-1/layout") return layout;
      throw new Error(`Unexpected request: ${url}`);
    });

    await expect(getBuildingLayouts()).resolves.toEqual([layout]);
    expect(mocks.request).toHaveBeenNthCalledWith(
      2,
      "GET",
      "/api/v1/rooms/buildings/building-1/layout",
      {
        signal: undefined,
      },
    );
  });

  it("creates shared buildings and floors and saves room placements", async () => {
    const plan = {
      ...emptySchoolPlan(),
      buildings: [
        {
          id: "draft-building",
          code: "MAIN",
          name: "Hlavní budova",
          x: 24,
          y: 140,
          betweenFloors: "3",
          floors: [
            {
              id: "draft-floor",
              name: "Přízemí",
              number: 0,
              cost: "1",
              roomIds: ["room-1"],
            },
          ],
        },
      ],
    };

    const saved = await saveSchoolLayout(plan, [], [room]);

    expect(mocks.request).toHaveBeenNthCalledWith(1, "POST", "/api/v1/rooms/buildings", {
      body: { name: "Hlavní budova", code: "MAIN", address: null },
    });
    expect(mocks.request).toHaveBeenNthCalledWith(2, "POST", "/api/v1/rooms/building-floors", {
      body: { building_id: "saved-building", number: 0, name: "Přízemí" },
    });
    expect(mocks.request).toHaveBeenNthCalledWith(3, "PATCH", "/api/v1/rooms/room-1", {
      body: { floor_id: "saved-floor", x: null, y: null, width: null, height: null },
    });
    expect(saved.buildings[0]).toMatchObject({
      id: "saved-building",
      code: "MAIN",
      floors: [{ id: "saved-floor", roomIds: ["room-1"] }],
    });
    expect(mocks.delete).not.toHaveBeenCalled();
  });
});
