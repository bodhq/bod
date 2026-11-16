import type { ResourceDefinition, Row } from "@/modules/shared/records/types";

import { usersApiV1AdminUsersGet } from "@bod/api-client/sdk.gen";

import { apiClient } from "@/core/api/client";
import { apiData, apiVoid } from "@/core/api/result";

export const workspaceKey = ["module-records"];
export const PAGE_SIZE = 50;

export async function collectPages<T>(
  load: (offset: number, limit: number) => Promise<T[]>,
  signal?: AbortSignal,
) {
  const rows: T[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    signal?.throwIfAborted();
    const page = await load(offset, PAGE_SIZE);
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

export async function request<T>(
  method: "GET" | "POST" | "PATCH" | "PUT",
  url: string,
  options: { body?: Row; query?: Record<string, string | number>; signal?: AbortSignal } = {},
): Promise<T> {
  return apiData(
    await apiClient.request<Record<200, T>>({
      method,
      url,
      ...options,
      headers: options.body ? { "Content-Type": "application/json" } : undefined,
    }),
  );
}

export function resourcePath(resource: ResourceDefinition, row: Row): string {
  return resource.itemPath.replace(/\{([^}]+)\}/g, (_, key: string) => {
    const value = row[key];
    if (value === null || value === undefined || value === "")
      throw new Error("Záznam nemá úplný identifikátor.");
    return encodeURIComponent(String(value));
  });
}
export function listRows(
  resource: ResourceDefinition,
  offset = 0,
  signal?: AbortSignal,
  filters: Record<string, string | number> = {},
) {
  return request<Row[]>("GET", resource.path, {
    query: { ...filters, offset, limit: PAGE_SIZE },
    signal,
  });
}
export async function removeRow(resource: ResourceDefinition, row: Row) {
  apiVoid(await apiClient.delete({ url: resourcePath(resource, row) }));
}
export function patchRow(resource: ResourceDefinition, row: Row, values: Row) {
  if (!resource.parsePatch) throw new Error("Tuto evidenci nelze upravovat.");
  return request<Row>("PATCH", resourcePath(resource, row), {
    body: resource.parsePatch(resource.preparePatch?.(values, row) ?? values),
  });
}
export async function userOptions(offset: number, signal?: AbortSignal): Promise<Row[]> {
  return apiData(
    await usersApiV1AdminUsersGet({
      client: apiClient,
      query: { offset, limit: PAGE_SIZE },
      signal,
    }),
  );
}

export async function listAllRows(
  resource: ResourceDefinition,
  signal?: AbortSignal,
  filters: Record<string, string | number> = {},
) {
  return collectPages((offset) => listRows(resource, offset, signal, filters), signal);
}
