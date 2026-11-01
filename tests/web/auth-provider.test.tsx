import type { User } from "@/core/auth/api";

import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getMe } from "@/core/auth/api";
import { AuthProvider } from "@/core/auth/components/AuthProvider";
import { useAuthStore } from "@/core/auth/store";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
const router = { replace };
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/app",
}));
vi.mock("@/core/auth/api", () => ({ getMe: vi.fn() }));

const user = { id: "student", username: "student", must_change_password: false } as User;

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.getState().setUser(null);
});
afterEach(cleanup);

describe("browser session renewal after SSR", () => {
  it("calls me from the browser even when SSR already supplied a user", async () => {
    vi.mocked(getMe).mockResolvedValue(user);
    render(<AuthProvider initialUser={user}>Protected content</AuthProvider>);
    await waitFor(() => expect(getMe).toHaveBeenCalledWith());
    expect(useAuthStore.getState().user).toEqual(user);
  });

  it("redirects if the cookie expired between SSR and hydration", async () => {
    vi.mocked(getMe).mockRejectedValue(
      Object.assign(new Error("expired"), {
        code: "AUTH_UNAUTHENTICATED",
      }),
    );
    render(<AuthProvider initialUser={user}>Protected content</AuthProvider>);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login?error=unauthorized"));
    expect(useAuthStore.getState().user).toBeNull();
  });
});
