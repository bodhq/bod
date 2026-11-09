import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Input } from "@/core/ui/forms/Input";
import { Select } from "@/core/ui/forms/Select";
import { Textarea } from "@/core/ui/forms/Textarea";

describe("accessible form fields", () => {
  it("associates a description and an actionable error with the invalid field", () => {
    render(
      <Input
        label="E-mail"
        description="Školní adresa"
        error="Zadejte platný e-mail."
        aria-describedby="other-help"
      />,
    );
    const input = screen.getByLabelText("E-mail");
    expect(input).toHaveAttribute("aria-invalid", "true");
    const described = input.getAttribute("aria-describedby")?.split(" ") ?? [];
    expect(described).toContain("other-help");
    expect(described.map((id) => document.getElementById(id)?.textContent)).toContain(
      "Školní adresa",
    );
    expect(described.map((id) => document.getElementById(id)?.textContent)).toContain(
      "Zadejte platný e-mail.",
    );
  });
  it("provides the same label and validation semantics for select and textarea", () => {
    render(
      <>
        <Select label="Role" error="Vyberte roli">
          <option>Student</option>
        </Select>
        <Textarea label="Poznámka" description="Nepovinné" />
      </>,
    );
    expect(screen.getByLabelText("Role")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Poznámka")).toHaveAttribute("aria-describedby");
  });
});

afterEach(cleanup);
