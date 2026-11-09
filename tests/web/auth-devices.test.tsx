import type { ReactNode } from "react";
import type { AuthSession, User } from "@/core/auth/api";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { getSessions, revokeSession } from "@/core/auth/api";
import { useRevokeMultipleSessions, useSessions } from "@/core/auth/hooks/useSessions";
import { useAuthStore } from "@/core/auth/store";

const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/core/auth/api", () => ({ getSessions: vi.fn(), revokeSession: vi.fn() }));
vi.mock("@/core/ui/feedback/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const user = { id: "teacher", active_role: "teacher" } as User;
let devices: AuthSession[];
let client: QueryClient;

function setup() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(["private"], "current-account-data");
  client.setQueryData(["sessions"], devices);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => ({ remove: useRevokeMultipleSessions(), sessions: useSessions() }), {
    wrapper,
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  useAuthStore.getState().setSessionUser(user);
  devices = [
    { id: "current", is_current: true },
    { id: "other", is_current: false },
  ] as AuthSession[];
  vi.mocked(getSessions).mockImplementation(async () => devices);
  vi.mocked(revokeSession).mockImplementation(async (id) => {
    devices = devices.filter((device) => device.id !== id);
  });
});
afterEach(() => {
  cleanup();
  client.clear();
  useAuthStore.getState().setUser(null);
});

it("clears the account and cache after the current device was revoked", async () => {
  const { result } = setup();
  await act(async () => {
    await result.current.remove.mutateAsync(["current", "other"]);
  });
  expect(useAuthStore.getState().user).toBeNull();
  expect(client.getQueryData(["private"])).toBeUndefined();
  expect(router.replace).toHaveBeenCalledWith("/login");
  expect(router.refresh).toHaveBeenCalled();
});

it("keeps the signed-in account through an outage while reading the device list", async () => {
  const { result } = setup();
  const failure = new TypeError("Network unavailable");
  vi.mocked(getSessions).mockRejectedValue(failure);
  await act(async () => {
    await expect(result.current.remove.mutateAsync(["other"])).rejects.toBe(failure);
  });
  expect(useAuthStore.getState().user).toEqual(user);
  expect(client.getQueryData(["private"])).toBe("current-account-data");
  expect(router.replace).not.toHaveBeenCalled();
  expect(revokeSession).not.toHaveBeenCalled();
});

it("refreshes the actual remaining devices after a partially successful revocation", async () => {
  devices.push({ id: "unavailable", is_current: false } as AuthSession);
  const { result } = setup();
  vi.mocked(revokeSession).mockImplementation(async (id) => {
    if (id === "unavailable") throw new Error("Device revocation failed");
    devices = devices.filter((device) => device.id !== id);
  });
  await act(async () => {
    await expect(
      result.current.remove.mutateAsync(["other", "unavailable", "current"]),
    ).rejects.toThrow("Device revocation failed");
  });
  await waitFor(() => {
    expect(result.current.sessions.data?.map((device) => device.id)).toEqual([
      "current",
      "unavailable",
    ]);
  });
  expect(useAuthStore.getState().user).toEqual(user);
  expect(revokeSession).not.toHaveBeenCalledWith("current");
});
