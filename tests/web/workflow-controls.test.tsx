import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { FormActions } from "@/core/ui/forms/FormActions";
import { StepProgress } from "@/core/ui/navigation/StepProgress";

it("does not mark freely visited steps complete and keeps navigation keyboard accessible", () => {
  const change = vi.fn();
  render(
    <StepProgress steps={["Podklady", "Sestavení", "Kontrola"]} current={2} onChange={change} />,
  );
  expect(
    screen.getAllByRole("listitem").filter((item) => item.dataset.complete === "true"),
  ).toHaveLength(0);
  fireEvent.click(screen.getByRole("button", { name: "Podklady" }));
  expect(change).toHaveBeenCalledWith(0);
  expect(screen.getAllByRole("listitem")[2]).toHaveAttribute("aria-current", "step");
});

it("can show real completion independently of the current step", () => {
  render(<StepProgress steps={["Podáno", "Uzavřeno"]} current={-1} completed={[true, true]} />);
  expect(screen.getAllByRole("listitem").every((item) => item.dataset.complete === "true")).toBe(
    true,
  );
  expect(document.querySelector('[aria-current="step"]')).toBeNull();
});

it("locks all wizard actions while saving, including back and cancel", () => {
  const submit = vi.fn(),
    back = vi.fn(),
    cancel = vi.fn();
  const { rerender } = render(
    <FormActions pending onSubmit={submit} onBack={back} onCancel={cancel} />,
  );
  for (const button of screen.getAllByRole("button")) {
    expect(button).toBeDisabled();
    fireEvent.click(button);
  }
  expect(submit).not.toHaveBeenCalled();
  expect(back).not.toHaveBeenCalled();
  expect(cancel).not.toHaveBeenCalled();
  rerender(<FormActions onSubmit={submit} onBack={back} onCancel={cancel} />);
  fireEvent.click(screen.getByRole("button", { name: "Uložit" }));
  expect(submit).toHaveBeenCalledOnce();
});
