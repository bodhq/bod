import {
  getSessionsApiV1AuthSessionsGet,
  loginApiV1AuthLoginPost,
  logoutApiV1AuthLogoutPost,
  meApiV1AuthMeGet,
  revokeSessionApiV1AuthSessionsSessionIdDelete,
} from "@bod/api-client/sdk.gen";
import type {
  AuthSessionPublic,
  UserPublic,
} from "@bod/api-client/types.gen";
import { client } from "@bod/api-client/client.gen";

import { parseApiError } from "@/core/api/api-errors";

// Globally configure the API client
client.setConfig({
  // Bude používat Next.js proxy, tím odpadnou problémy s CORS a cookies!
  baseUrl:
    process.env.NODE_ENV === "production"
      ? process.env.NEXT_PUBLIC_API_URL
      : "",
  // Ensure cookies are included in cross-origin requests
  fetch: (input: RequestInfo | URL, init?: RequestInit) =>
    fetch(input, { ...init, credentials: "include" }),
});

// Exportujeme alias pro zbytek aplikace (aby store nevyžadoval změny po vygenerování klienta)
export type User = UserPublic;

export async function login(
  username: string,
  password: string
): Promise<UserPublic> {
  const { data: userData, error } = await loginApiV1AuthLoginPost({
    body: { username, password }
  });

  if (error) {
    throw parseApiError(error);
  }

  if (!userData) {
    throw new Error("Neočekávaná odpověď serveru");
  }

  return userData;
}

export async function getMe(options?: any): Promise<UserPublic | null> {
  const { data, error } = await meApiV1AuthMeGet(options);
  if (error || !data) return null;
  return data;
}

export async function logout(): Promise<void> {
  await logoutApiV1AuthLogoutPost();
}

export type AuthSession = AuthSessionPublic;

export async function getSessions(options?: any): Promise<AuthSession[]> {
  const { data, error } = await getSessionsApiV1AuthSessionsGet(options);
  if (error || !data) return [];
  return data;
}

export async function revokeSession(sessionId: string): Promise<void> {
  const { error } = await revokeSessionApiV1AuthSessionsSessionIdDelete({
    path: { session_id: sessionId },
  });
  if (error) {
    throw parseApiError(error);
  }
}
