import type { AuthSessionPublic, UserPublic } from "@bod/api-client/types.gen";

import { client } from "@bod/api-client/client.gen";
import {
  getSessionsApiV1AuthSessionsGet,
  loginApiV1AuthLoginPost,
  logoutApiV1AuthLogoutPost,
  meApiV1AuthMeGet,
  revokeSessionApiV1AuthSessionsSessionIdDelete,
} from "@bod/api-client/sdk.gen";

import { parseApiError } from "@/core/api/api-errors";

interface ApiRequestOptions {
  baseUrl?: string;
  headers?: HeadersInit;
}

// Globally configure the API client
client.setConfig({
  // Requests stay same-origin in the browser: Next rewrites them in development and Caddy routes them in production.
  baseUrl: "",
  // Ensure cookies are included in cross-origin requests
  fetch: (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    const method = (init?.method ?? "GET").toUpperCase();
    if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
      headers.set("X-Requested-With", "bod");
    }
    return fetch(input, {
      ...init,
      headers,
      credentials: "include",
      cache: "no-store",
    });
  },
});

// Exportujeme alias pro zbytek aplikace (aby store nevyžadoval změny po vygenerování klienta)
export type User = UserPublic;

export async function login(username: string, password: string): Promise<UserPublic> {
  const { data: userData, error } = await loginApiV1AuthLoginPost({
    body: { username, password },
  });

  if (error) {
    throw parseApiError(error);
  }

  if (!userData) {
    throw new Error("Neočekávaná odpověď serveru");
  }

  return userData;
}

export async function getMe(options?: ApiRequestOptions): Promise<UserPublic> {
  const { data, error } = await meApiV1AuthMeGet(options);
  if (error) throw parseApiError(error);
  if (!data) throw new Error("Server nevrátil přihlášeného uživatele.");
  return data;
}

export async function logout(): Promise<void> {
  const { error } = await logoutApiV1AuthLogoutPost();
  if (error) throw parseApiError(error);
}

export type AuthSession = AuthSessionPublic;

export async function getSessions(options?: ApiRequestOptions): Promise<AuthSession[]> {
  const result = await getSessionsApiV1AuthSessionsGet(options);
  const { data, error } = result;
  if (error) {
    const apiError = parseApiError(error);
    Object.assign(apiError, { status: result.response?.status });
    throw apiError;
  }
  if (!data) throw new Error("Server nevrátil seznam aktivních relací.");
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
