import type { QueryClient } from "@tanstack/react-query";
import type { ApiRequestOptions } from "@/core/api/client";
import type { User } from "./api";

import { isUnauthenticated } from "@/core/api/api-errors";

import { getMe, getSessions, revokeSession } from "./api";
import { hasSameAuthContext, useAuthStore } from "./store";

export async function replaceAuthUser(
  queryClient: QueryClient,
  user: User | null,
  expectedVersion: number,
): Promise<boolean> {
  if (useAuthStore.getState().sessionVersion !== expectedVersion) return false;
  await queryClient.cancelQueries();
  if (useAuthStore.getState().sessionVersion !== expectedVersion) return false;
  queryClient.clear();
  useAuthStore.getState().setSessionUser(user);
  return true;
}

export async function refreshAuthUser(
  queryClient: QueryClient,
  options?: Pick<ApiRequestOptions, "signal">,
): Promise<{ user: User | null; applied: boolean }> {
  const snapshot = useAuthStore.getState();
  const currentResult = () => ({ user: useAuthStore.getState().user, applied: false });
  try {
    const user = await getMe(options);
    if (options?.signal?.aborted) throw options.signal.reason;
    const current = useAuthStore.getState();
    if (current.sessionVersion !== snapshot.sessionVersion || current.user !== snapshot.user) {
      return currentResult();
    }
    if (!hasSameAuthContext(snapshot.user, user)) {
      const applied = await replaceAuthUser(queryClient, user, snapshot.sessionVersion);
      return { user: useAuthStore.getState().user, applied };
    }
    current.setUser(user);
    return { user, applied: true };
  } catch (error) {
    if (options?.signal?.aborted) throw error;
    if (useAuthStore.getState().sessionVersion !== snapshot.sessionVersion) return currentResult();
    if (!isUnauthenticated(error)) throw error;
    const applied = await replaceAuthUser(queryClient, null, snapshot.sessionVersion);
    return { user: useAuthStore.getState().user, applied };
  }
}

export async function revokeSessionsInOrder(
  sessionIds: string[],
  expectedVersion: number,
): Promise<{ currentRevoked: boolean }> {
  const ids = [...new Set(sessionIds)];
  if (!ids.length) return { currentRevoked: false };
  const assertCurrent = () => {
    if (useAuthStore.getState().sessionVersion !== expectedVersion) {
      throw new DOMException("Přihlášení se změnilo.", "AbortError");
    }
  };
  assertCurrent();
  // Read the current flag from the server instead of guessing from a stale selection.
  const sessions = await getSessions();
  assertCurrent();
  const current = sessions.find((session) => session.is_current);
  if (!current) throw new Error("Aktuální zařízení nelze rozpoznat. Obnovte seznam zařízení.");
  const results = await Promise.allSettled(
    ids.filter((id) => id !== current.id).map((id) => revokeSession(id)),
  );
  const failure = results.find(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );
  if (failure) throw failure.reason;
  assertCurrent();
  const currentRevoked = ids.includes(current.id);
  if (currentRevoked) await revokeSession(current.id);
  return { currentRevoked };
}
