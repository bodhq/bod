import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { ConfirmProvider, useConfirm } from "@/core/ui/overlays/ConfirmProvider";

beforeAll(() => {
  // jsdom does not implement the native dialog lifecycle; keyboard containment is
  // checked separately in Chromium against showModal().
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
});
function Harness({ action }: { action: () => Promise<unknown> }) {
  const confirm = useConfirm();
  return (
    <button
      type="button"
      onClick={() =>
        confirm({
          title: "Odstranit účet alice?",
          description: "Změna ovlivní přístup tohoto účtu.",
          confirmLabel: "Odstranit alice",
          destructive: true,
          onConfirm: action,
        })
      }
    >
      Odstranit účet
    </button>
  );
}
function setup(action: () => Promise<unknown>) {
  render(
    <ConfirmProvider>
      <Harness action={action} />
    </ConfirmProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Odstranit účet", exact: true }));
}
describe("contextual confirmations", () => {
  it("does not perform the action when cancelled", () => {
    const action = vi.fn().mockResolvedValue(undefined);
    setup(action);
    fireEvent.click(screen.getByRole("button", { name: "Zrušit" }));
    expect(action).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("retains the named confirmation and supports retry after a failed action", async () => {
    const action = vi
      .fn()
      .mockRejectedValueOnce(new Error("Server není dostupný"))
      .mockResolvedValueOnce(undefined);
    setup(action);
    fireEvent.click(screen.getByRole("button", { name: "Odstranit alice" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Server není dostupný"),
    );
    expect(screen.getByRole("dialog", { name: "Odstranit účet alice?" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Odstranit alice" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(action).toHaveBeenCalledTimes(2);
  });
  it("prevents cancellation and repeated submission while the action is pending", async () => {
    let complete: (() => void) | undefined;
    const action = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          complete = resolve;
        }),
    );
    setup(action);
    fireEvent.click(screen.getByRole("button", { name: "Odstranit alice" }));
    expect(screen.getByRole("button", { name: "Zrušit" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Provádím změnu…" }));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(action).toHaveBeenCalledTimes(1);
    await act(async () => complete?.());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

afterEach(cleanup);
