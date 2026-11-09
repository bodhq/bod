import type { ReactNode } from "react";
import type { User } from "@/core/auth/api";

import { createUserApiV1AdminUsersPost } from "@bod/api-client/sdk.gen";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { useAuthStore } from "@/core/auth/store";
import { toast } from "@/core/ui/feedback/toast";
import { useAccessManagement } from "@/modules/access/hooks/useAccessManagement";

vi.mock("@bod/api-client/sdk.gen", () => ({
  usersApiV1AdminUsersGet: vi.fn().mockResolvedValue({ data: [], response: new Response() }),
  createUserApiV1AdminUsersPost: vi.fn(),
  generateUsersApiV1AdminUsersGeneratePost: vi.fn(),
  rolesApiV1AdminRolesGet: vi.fn(),
  permissionsApiV1AdminPermissionsGet: vi.fn(),
  auditApiV1AdminAuditGet: vi.fn(),
  createRoleApiV1AdminRolesPost: vi.fn(),
  updateRoleApiV1AdminRolesCodePut: vi.fn(),
  deleteRoleApiV1AdminRolesCodeDelete: vi.fn(),
  updateUserApiV1AdminUsersUserIdPatch: vi.fn(),
  deleteUserApiV1AdminUsersUserIdDelete: vi.fn(),
  resetPasswordApiV1AdminUsersUserIdResetPasswordPost: vi.fn(),
}));
vi.mock("@/core/ui/feedback/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const user = { id: "admin", active_role: "admin", permissions: ["users.manage"] } as User;
let client: QueryClient;
let finish: (value: unknown) => void;

beforeEach(() => {
  vi.clearAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  useAuthStore.getState().setSessionUser(user);
  vi.mocked(createUserApiV1AdminUsersPost).mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
});
afterEach(() => {
  cleanup();
  client.clear();
});

function setup() {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useAccessManagement(), { wrapper });
}

it.each([
  false,
  true,
])("displays generated credentials only for the session that requested them (changed: %s)", async (changed) => {
  const { result } = setup();
  act(() => result.current.setUsername("new.account"));
  let pending: Promise<unknown>;
  act(() => {
    pending = result.current.createAccount.mutateAsync();
  });
  await waitFor(() => expect(createUserApiV1AdminUsersPost).toHaveBeenCalled());
  if (changed) act(() => useAuthStore.getState().setUser({ ...user, active_role: "teacher" }));
  await act(async () => {
    finish({ data: { temporary_password: "generated-secret" }, response: new Response() });
    await pending;
  });
  expect(result.current.temporaryPassword).toBe(changed ? null : "generated-secret");
  expect(toast.success).toHaveBeenCalledTimes(changed ? 0 : 1);
});
