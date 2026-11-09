import type { ReactNode } from "react";
import type { User } from "@/core/auth/api";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { useAuthStore } from "@/core/auth/store";
import { useProfileSettings } from "@/modules/account/hooks/useProfileSettings";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));
const user = {
  id: "teacher",
  active_role: "teacher",
  first_name: "Eliáš",
  permissions: [],
} as unknown as User;
function setup() {
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useProfileSettings(), { wrapper });
}
beforeEach(() => useAuthStore.getState().setSessionUser(user));
afterEach(cleanup);
it("does not replace an unsaved field when the same account refreshes in the background", () => {
  const { result } = setup();
  act(() => result.current.setField("first_name", "Rozepsané jméno"));
  act(() => useAuthStore.getState().setUser({ ...user, phone: "123456789" }));
  expect(result.current.values.first_name).toBe("Rozepsané jméno");
});
it("starts with the new account's values when account identity changes", () => {
  const { result } = setup();
  act(() => result.current.setField("first_name", "Rozepsané jméno"));
  act(() => useAuthStore.getState().setSessionUser({ ...user, id: "other", first_name: "Filip" }));
  expect(result.current.values.first_name).toBe("Filip");
});
