import {
  loginApiV1AuthLoginPost,
  meApiV1AuthMeGet,
  logoutApiV1AuthLogoutPost,
  type UserPublic,
  type LoginApiV1AuthLoginPostData,
} from "@bod/api-client";
import { client } from "@bod/api-client/client.gen";

import { parseApiError } from "@/core/api/api-errors";

// Globally configure the API client
client.setConfig({
  // Bude používat Next.js proxy, tím odpadnou problémy s CORS a cookies!
  baseUrl: process.env.NODE_ENV === "production" ? process.env.NEXT_PUBLIC_API_URL : "",
  // Ensure cookies are included in cross-origin requests
  fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, { ...init, credentials: "include" }),
});

// Exportujeme alias pro zbytek aplikace (aby store nevyžadoval změny po vygenerování klienta)
export type User = UserPublic;

export async function login(data: LoginApiV1AuthLoginPostData): Promise<UserPublic> {
  const { data: userData, error } = await loginApiV1AuthLoginPost(data);

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
