import { createClient } from "@bod/api-client/client/index";

export interface ApiRequestOptions {
  baseUrl?: string;
  headers?: HeadersInit;
  signal?: AbortSignal;
}

export const apiClient = createClient({
  // Browser requests use the same origin; SSR supplies its URL and cookie per request.
  baseUrl: "",
  fetch: (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : undefined;
    const headers = new Headers(init?.headers ?? request?.headers);
    const method = (init?.method ?? request?.method ?? "GET").toUpperCase();
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
