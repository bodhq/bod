import type { UserCreate } from "@bod/api-client/types.gen";

import { createUserApiV1AdminUsersPost, usersApiV1AdminUsersGet } from "@bod/api-client/sdk.gen";

import { apiClient } from "@/core/api/client";
import { apiData } from "@/core/api/result";

const PAGE_SIZE = 50;

export async function createAccount(body: UserCreate) {
  return apiData(await createUserApiV1AdminUsersPost({ client: apiClient, body }));
}

// Collection endpoints currently expose paging, not server-side filtering.
export async function getAccountDirectory(signal: AbortSignal) {
  const accounts: Awaited<ReturnType<typeof getPage>> = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    signal.throwIfAborted();
    const page = await getPage(offset, signal);
    accounts.push(...page);
    if (page.length < PAGE_SIZE) return accounts;
  }
}

async function getPage(offset: number, signal: AbortSignal) {
  return apiData(
    await usersApiV1AdminUsersGet({
      client: apiClient,
      signal,
      query: { offset, limit: PAGE_SIZE },
    }),
  );
}
