import type { AuthSession, User } from "@/core/auth/api";

import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getMe, getSessions, revokeSession } from "@/core/auth/api";
import { refreshAuthUser, replaceAuthUser, revokeSessionsInOrder } from "@/core/auth/session";
import { useAuthStore } from "@/core/auth/store";

vi.mock("@/core/auth/api", () => ({
  getMe: vi.fn(),
  getSessions: vi.fn(),
  revokeSession: vi.fn(),
}));
const user = { id: "teacher", active_role: "teacher", permissions: ["timetable.read"] } as User;
const devices = [
  { id: "current", is_current: true },
  { id: "other", is_current: false },
] as AuthSession[];
let client: QueryClient;
const version = () => useAuthStore.getState().sessionVersion;

beforeEach(() => {
  vi.resetAllMocks();
  client = new QueryClient();
  client.setQueryData(["private"], "current-account-data");
  useAuthStore.getState().setSessionUser(user);
  vi.mocked(getSessions).mockResolvedValue(devices);
  vi.mocked(revokeSession).mockResolvedValue(undefined);
});
afterEach(() => {
  client.clear();
  useAuthStore.getState().setUser(null);
});

describe("session renewal", () => {
  it("preserves the account and its cache through a network failure", async () => {
    const failure = new TypeError("Network unavailable");
    vi.mocked(getMe).mockRejectedValue(failure);
    await expect(refreshAuthUser(client)).rejects.toBe(failure);
    expect(useAuthStore.getState().user).toBe(user);
    expect(client.getQueryData(["private"])).toBe("current-account-data");
  });

  it("clears the account and cached data when authentication expires", async () => {
    vi.mocked(getMe).mockRejectedValue(
      Object.assign(new Error("Expired"), { code: "AUTH_UNAUTHENTICATED" }),
    );
    await expect(refreshAuthUser(client)).resolves.toEqual({ user: null, applied: true });
    expect(useAuthStore.getState().user).toBeNull();
    expect(client.getQueryData(["private"])).toBeUndefined();
  });

  it("ignores a response from before re-login to the exact same user object", async () => {
    const renewal = Promise.withResolvers<User>();
    vi.mocked(getMe).mockReturnValue(renewal.promise);
    const result = refreshAuthUser(client);
    useAuthStore.getState().setSessionUser(user);
    client.setQueryData(["private"], "new-session-data");
    renewal.resolve({ ...user, display_name: "Old session response" });
    await expect(result).resolves.toEqual({ user, applied: false });
    expect(client.getQueryData(["private"])).toBe("new-session-data");
  });

  it("does not overwrite profile details saved while renewal was in flight", async () => {
    const renewal = Promise.withResolvers<User>();
    vi.mocked(getMe).mockReturnValue(renewal.promise);
    const result = refreshAuthUser(client);
    const edited = { ...user, display_name: "Saved name" };
    useAuthStore.getState().setUser(edited);
    renewal.resolve({ ...user, display_name: "Old name" });
    await expect(result).resolves.toEqual({ user: edited, applied: false });
  });

  it("discards cache when the backend reports changed permissions", async () => {
    const updated = { ...user, permissions: ["school.manage"] };
    vi.mocked(getMe).mockResolvedValue(updated);
    const before = version();
    await expect(refreshAuthUser(client)).resolves.toEqual({ user: updated, applied: true });
    expect(client.getQueryData(["private"])).toBeUndefined();
    expect(version()).toBeGreaterThan(before);
  });

  it("does not invalidate a session just because permission ordering changed", async () => {
    useAuthStore.getState().setUser({ ...user, permissions: ["school.manage", "timetable.read"] });
    const before = version();
    vi.mocked(getMe).mockResolvedValue({
      ...user,
      permissions: ["timetable.read", "school.manage"],
    });
    await refreshAuthUser(client);
    expect(client.getQueryData(["private"])).toBe("current-account-data");
    expect(version()).toBe(before);
  });

  it("cancels in-flight queries before replacing the account", async () => {
    let signal: AbortSignal | undefined;
    const query = client
      .fetchQuery({
        queryKey: ["pending"],
        queryFn: (context) => {
          signal = context.signal;
          return new Promise(() => {});
        },
      })
      .catch((error: unknown) => error);
    const next = { ...user, id: "new-account" };
    await expect(replaceAuthUser(client, next, version())).resolves.toBe(true);
    expect(signal?.aborted).toBe(true);
    expect(client.getQueryCache().getAll()).toHaveLength(0);
    expect(useAuthStore.getState().user).toEqual(next);
    await query;
  });
});

describe("device revocation", () => {
  it("deduplicates devices and waits for other devices before revoking the current one", async () => {
    const other = Promise.withResolvers<void>();
    vi.mocked(revokeSession).mockImplementation((id) =>
      id === "other" ? other.promise : Promise.resolve(),
    );
    const result = revokeSessionsInOrder(["current", "other", "other"], version());
    await vi.waitFor(() => expect(revokeSession).toHaveBeenCalledWith("other"));
    const startedCurrentEarly = vi
      .mocked(revokeSession)
      .mock.calls.some(([id]) => id === "current");
    other.resolve();
    await expect(result).resolves.toEqual({ currentRevoked: true });
    expect(startedCurrentEarly).toBe(false);
    expect(vi.mocked(revokeSession).mock.calls.map(([id]) => id)).toEqual(["other", "current"]);
  });

  it("keeps the current session if any other device fails to revoke", async () => {
    const failure = new Error("Network failure");
    vi.mocked(revokeSession).mockRejectedValue(failure);
    await expect(revokeSessionsInOrder(["other", "current"], version())).rejects.toBe(failure);
    expect(revokeSession).not.toHaveBeenCalledWith("current");
    expect(useAuthStore.getState().user).toBe(user);
  });

  it("stops before any deletion if the current device cannot be identified", async () => {
    vi.mocked(getSessions).mockResolvedValue([{ id: "other", is_current: false }] as AuthSession[]);
    await expect(revokeSessionsInOrder(["other"], version())).rejects.toThrow("Aktuální zařízení");
    expect(revokeSession).not.toHaveBeenCalled();
  });

  it("does not revoke the current device if the account changed while other deletes were pending", async () => {
    const other = Promise.withResolvers<void>();
    vi.mocked(revokeSession).mockReturnValue(other.promise);
    const result = revokeSessionsInOrder(["other", "current"], version());
    await vi.waitFor(() => expect(revokeSession).toHaveBeenCalled());
    useAuthStore.getState().setSessionUser({ ...user, id: "new-account" });
    other.resolve();
    await expect(result).rejects.toMatchObject({ name: "AbortError" });
    expect(revokeSession).not.toHaveBeenCalledWith("current");
  });
});
