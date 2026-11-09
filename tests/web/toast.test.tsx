import { act, cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { Toaster } from "@/core/ui/feedback/toast/Toaster";
import { toast, useToastStore } from "@/core/ui/feedback/toast/useToast";

beforeEach(() => {
  vi.useFakeTimers();
  useToastStore.setState({ toasts: [] });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it("keeps concurrent feedback readable and preserves persistent errors until dismissed", () => {
  render(<Toaster />);
  act(() => {
    toast.success("Změny byly uloženy.", { duration: 500 });
    toast.error("Operace se nezdařila.", { duration: 0 });
  });
  expect(screen.getByRole("status")).toHaveTextContent("Změny byly uloženy.");
  expect(screen.getByRole("alert")).toHaveTextContent("Operace se nezdařila.");
  act(() => vi.advanceTimersByTime(501));
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  const error = screen.getByRole("alert");
  act(() => within(error).getByRole("button", { name: "Zavřít oznámení" }).click());
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
