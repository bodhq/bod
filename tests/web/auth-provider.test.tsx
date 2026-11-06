import type { User } from "@/core/auth/api";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, waitFor } from "@testing-library/react";
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

let queryClient: QueryClient;
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

const user = { id: "student", username: "student", must_change_password: false } as User;

beforeEach(() => {
  vi.clearAllMocks();
  queryClient = new QueryClient();
  useAuthStore.getState().setUser(null);
});
afterEach(cleanup);

describe("browser session renewal after SSR", () => {
  it("calls me from the browser even when SSR already supplied a user", async () => {
    vi.mocked(getMe).mockResolvedValue(user);
    render(<AuthProvider initialUser={user}>Protected content</AuthProvider>, { wrapper });
    await waitFor(() => expect(getMe).toHaveBeenCalledWith({ signal: expect.any(AbortSignal) }));
    expect(useAuthStore.getState().user).toEqual(user);
  });

  it("redirects if the cookie expired between SSR and hydration", async () => {
    vi.mocked(getMe).mockRejectedValue(
      Object.assign(new Error("expired"), {
        code: "AUTH_UNAUTHENTICATED",
      }),
    );
    render(<AuthProvider initialUser={user}>Protected content</AuthProvider>, { wrapper });
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login?error=unauthorized"));
    expect(useAuthStore.getState().user).toBeNull();
  });
});

it("does not restore the user when renewal completes after logout", async () => {
  let finish: (user: User) => void = () => {
    throw new Error("Renewal did not start");
  };
  vi.mocked(getMe).mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  render(<AuthProvider initialUser={user}>Protected content</AuthProvider>, { wrapper });
  await waitFor(() => expect(getMe).toHaveBeenCalled());
  await act(async () => {
    useAuthStore.getState().setUser(null);
    finish(user);
  });
  expect(useAuthStore.getState().user).toBeNull();
});

it("does not let an old unauthorized response log out a new account", async () => {
  let fail: (error: Error) => void = () => {
    throw new Error("Renewal did not start");
  };
  vi.mocked(getMe).mockReturnValue(
    new Promise((_resolve, reject) => {
      fail = reject;
    }),
  );
  render(<AuthProvider initialUser={user}>Protected content</AuthProvider>, { wrapper });
  const next = { ...user, id: "next-account" };
  await act(async () => {
    useAuthStore.getState().setUser(next);
    fail(Object.assign(new Error("expired"), { code: "AUTH_UNAUTHENTICATED" }));
  });
  expect(useAuthStore.getState().user).toEqual(next);
  expect(replace).not.toHaveBeenCalled();
});
