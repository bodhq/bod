import type { ReactNode } from "react";
import type { User } from "@/core/auth/api";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { switchRole } from "@/core/auth/api";
import { useSwitchRole } from "@/core/auth/hooks/useSwitchRole";
import { useAuthStore } from "@/core/auth/store";

const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/core/auth/api", () => ({ switchRole: vi.fn() }));
vi.mock("@/core/ui/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const user = { id: "teacher", active_role: "teacher", permissions: ["timetable.read"] } as User;
const updated = { ...user, active_role: "scheduler", permissions: ["timetable.edit"] };

function setup() {
  const client = new QueryClient();
  client.setQueryData(["private"], "previous-role-data");
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, ...renderHook(() => useSwitchRole(), { wrapper }) };
}
beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.getState().setSessionUser(user);
});
afterEach(cleanup);

it("clears previous role data and refreshes the server after a role switch", async () => {
  vi.mocked(switchRole).mockResolvedValue(updated);
  const { client, result } = setup();
  await act(async () => {
    await result.current.mutateAsync("scheduler");
  });
  expect(client.getQueryData(["private"])).toBeUndefined();
  expect(useAuthStore.getState().user).toEqual(updated);
  expect(router.replace).toHaveBeenCalledWith("/app");
  expect(router.refresh).toHaveBeenCalled();
});

it("keeps the current role and cache when the backend rejects a role switch", async () => {
  vi.mocked(switchRole).mockRejectedValue(new Error("Forbidden"));
  const { client, result } = setup();
  await act(async () => {
    await expect(result.current.mutateAsync("scheduler")).rejects.toThrow("Forbidden");
  });
  expect(client.getQueryData(["private"])).toBe("previous-role-data");
  expect(useAuthStore.getState().user).toEqual(user);
  expect(router.replace).not.toHaveBeenCalled();
});

it("ignores a role response from before a different account logged in", async () => {
  const response = Promise.withResolvers<User>();
  vi.mocked(switchRole).mockReturnValue(response.promise);
  const { client, result } = setup();
  const next = { ...user, id: "new-account" };
  await act(async () => {
    const pending = result.current.mutateAsync("scheduler");
    await vi.waitFor(() => expect(switchRole).toHaveBeenCalled());
    useAuthStore.getState().setSessionUser(next);
    client.setQueryData(["private"], "new-account-data");
    response.resolve(updated);
    await pending;
  });
  expect(useAuthStore.getState().user).toEqual(next);
  expect(client.getQueryData(["private"])).toBe("new-account-data");
  expect(router.replace).not.toHaveBeenCalled();
});
