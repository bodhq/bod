import type { AuthSessionPublic, UserPublic } from "@bod/api-client/types.gen";
import type { ApiRequestOptions } from "@/core/api/client";

import {
  getSessionsApiV1AuthSessionsGet,
  loginApiV1AuthLoginPost,
  logoutApiV1AuthLogoutPost,
  meApiV1AuthMeGet,
  revokeSessionApiV1AuthSessionsSessionIdDelete,
  switchRoleApiV1AuthActiveRolePut,
} from "@bod/api-client/sdk.gen";

import { apiClient } from "@/core/api/client";
import { apiData, apiVoid } from "@/core/api/result";

export type User = UserPublic;

export async function login(username: string, password: string): Promise<UserPublic> {
  return apiData(
    await loginApiV1AuthLoginPost({ client: apiClient, body: { username, password } }),
  );
}

export async function getMe(options?: ApiRequestOptions): Promise<UserPublic> {
  return apiData(await meApiV1AuthMeGet({ ...options, client: apiClient }));
}

export async function logout(): Promise<void> {
  apiVoid(await logoutApiV1AuthLogoutPost({ client: apiClient }));
}

export type AuthSession = AuthSessionPublic;

export async function getSessions(options?: ApiRequestOptions): Promise<AuthSession[]> {
  return apiData(await getSessionsApiV1AuthSessionsGet({ ...options, client: apiClient }));
}

export async function revokeSession(sessionId: string): Promise<void> {
  apiVoid(
    await revokeSessionApiV1AuthSessionsSessionIdDelete({
      client: apiClient,
      path: { session_id: sessionId },
    }),
  );
}

export async function switchRole(roleCode: string): Promise<UserPublic> {
  return apiData(
    await switchRoleApiV1AuthActiveRolePut({ client: apiClient, body: { role_code: roleCode } }),
  );
}
