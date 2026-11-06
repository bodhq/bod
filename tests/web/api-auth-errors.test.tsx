import type { QueryClient } from "@tanstack/react-query";
import type { User } from "@/core/auth/api";

import { useQueryClient } from "@tanstack/react-query";
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { parseApiError } from "@/core/api/api-errors";
import { useAuthStore } from "@/core/auth/store";
import { QueryProvider } from "@/core/query";

const user = { id: "teacher", username: "teacher" } as User;
let queryClient: QueryClient;
let previousPath: string;

function CaptureQueryClient() {
  queryClient = useQueryClient();
  return null;
}

beforeEach(() => {
  previousPath = window.location.pathname;
  window.history.replaceState(null, "", "/login");
  useAuthStore.getState().setUser(user);
  render(
    <QueryProvider>
      <CaptureQueryClient />
    </QueryProvider>,
  );
});

afterEach(() => {
  queryClient.clear();
  useAuthStore.getState().setUser(null);
  window.history.replaceState(null, "", previousPath);
  cleanup();
});

it.each([
  [401, "AUTH_INVALID_CREDENTIALS"],
  [404, "AUTH_SESSION_NOT_FOUND"],
  [403, "AUTH_FORBIDDEN"],
] as const)("keeps the signed-in user after %i / %s", async (status, code) => {
  const error = parseApiError({ error: { code, message: "Operation failed" } }, status);
  const mutation = queryClient.getMutationCache().build(queryClient, {
    mutationFn: async () => {
      throw error;
    },
  });
  await expect(mutation.execute(undefined)).rejects.toBe(error);
  expect(useAuthStore.getState().user).toEqual(user);
});

it.each([
  "AUTH_UNAUTHENTICATED",
  undefined,
])("clears the signed-in user after an expired session (%s)", async (code) => {
  const error = parseApiError(code ? { error: { code } } : "Unauthorized", 401);
  await expect(
    queryClient.fetchQuery({
      queryKey: ["expired"],
      retry: false,
      queryFn: async () => {
        throw error;
      },
    }),
  ).rejects.toBe(error);
  expect(useAuthStore.getState().user).toBeNull();
});

it("ignores a stale mutation's unauthorized error after another login", async () => {
  const pending = Promise.withResolvers<void>();
  const mutation = queryClient
    .getMutationCache()
    .build(queryClient, { mutationFn: () => pending.promise });
  const result = mutation.execute(undefined);
  await vi.waitFor(() => expect(mutation.state.status).toBe("pending"));
  const next = { ...user, id: "new-account" };
  useAuthStore.getState().setSessionUser(next);
  const error = parseApiError({ error: { code: "AUTH_UNAUTHENTICATED" } }, 401);
  pending.reject(error);
  await expect(result).rejects.toBe(error);
  expect(useAuthStore.getState().user).toEqual(next);
});

it.each([401, 403, 404])("does not retry a permanent HTTP %i failure", async (status) => {
  const error = parseApiError(undefined, status);
  const queryFn = vi.fn().mockRejectedValue(error);
  await expect(
    queryClient.fetchQuery({ queryKey: ["permanent", status], queryFn, retryDelay: 0 }),
  ).rejects.toBe(error);
  expect(queryFn).toHaveBeenCalledTimes(1);
});

it("limits retries for a transient network failure without clearing the account", async () => {
  const error = new TypeError("Network unavailable");
  const queryFn = vi.fn().mockRejectedValue(error);
  await expect(
    queryClient.fetchQuery({ queryKey: ["network"], queryFn, retryDelay: 0 }),
  ).rejects.toBe(error);
  expect(queryFn).toHaveBeenCalledTimes(3);
  expect(useAuthStore.getState().user).toEqual(user);
});
