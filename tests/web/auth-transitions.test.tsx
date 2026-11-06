import type { ReactNode } from "react";
import type { User } from "@/core/auth/api";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { login, logout } from "@/core/auth/api";
import { useAuth } from "@/core/auth/hooks/useAuth";
import { useAuthStore } from "@/core/auth/store";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/core/auth/api", () => ({ login: vi.fn(), logout: vi.fn(), getMe: vi.fn() }));
vi.mock("@/core/ui/toast", () => ({ toast: { error: vi.fn() } }));
const user = { id: "new-account", active_role: "teacher" } as User;

function setup() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  client.setQueryData(["private"], "previous-account-data");
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, ...renderHook(() => useAuth(), { wrapper }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.getState().setUser(null);
});
afterEach(cleanup);

it("clears the previous account cache and refreshes the server after login", async () => {
  vi.mocked(login).mockResolvedValue(user);
  const { client, result } = setup();
  await act(async () => {
    await result.current.loginAsync("teacher", "password");
  });
  expect(client.getQueryData(["private"])).toBeUndefined();
  expect(useAuthStore.getState().user).toEqual(user);
  expect(router.replace).toHaveBeenCalledWith("/app");
  expect(router.refresh).toHaveBeenCalled();
});

it("refreshes server state and clears cache after logout", async () => {
  vi.mocked(logout).mockResolvedValue(undefined);
  useAuthStore.getState().setUser(user);
  const { client, result } = setup();
  await act(async () => {
    await result.current.logoutAsync();
  });
  expect(client.getQueryData(["private"])).toBeUndefined();
  expect(useAuthStore.getState().user).toBeNull();
  expect(router.replace).toHaveBeenCalledWith("/login");
  expect(router.refresh).toHaveBeenCalled();
});

it("preserves account and cached data if login fails", async () => {
  useAuthStore.getState().setSessionUser(user);
  vi.mocked(login).mockRejectedValue(new Error("Invalid credentials"));
  const { client, result } = setup();
  await act(async () => {
    await expect(result.current.loginAsync("teacher", "wrong")).rejects.toThrow();
  });
  expect(useAuthStore.getState().user).toEqual(user);
  expect(client.getQueryData(["private"])).toBe("previous-account-data");
  expect(router.replace).not.toHaveBeenCalled();
});

it("keeps the account and cached data if logout fails due to a network outage", async () => {
  useAuthStore.getState().setSessionUser(user);
  vi.mocked(logout).mockRejectedValue(new TypeError("Network unavailable"));
  const { client, result } = setup();
  await act(async () => {
    await expect(result.current.logoutAsync()).rejects.toThrow();
  });
  expect(useAuthStore.getState().user).toEqual(user);
  expect(client.getQueryData(["private"])).toBe("previous-account-data");
  expect(router.replace).not.toHaveBeenCalled();
});

it("finishes local logout when the backend reports an already expired session", async () => {
  useAuthStore.getState().setSessionUser(user);
  vi.mocked(logout).mockRejectedValue(
    Object.assign(new Error("Expired"), { code: "AUTH_UNAUTHENTICATED" }),
  );
  const { client, result } = setup();
  await act(async () => {
    await result.current.logoutAsync();
  });
  expect(useAuthStore.getState().user).toBeNull();
  expect(client.getQueryData(["private"])).toBeUndefined();
  expect(router.replace).toHaveBeenCalledWith("/login");
});
