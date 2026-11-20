import type { FieldDefinition } from "@/modules/shared/records/types";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { ReferenceField } from "@/modules/shared/records/components/ReferenceField";
import { ReferenceOptionsProvider } from "@/modules/shared/records/scope";

vi.mock("@/core/auth/store", () => ({ useAuthUser: () => ({ permissions: [] }) }));
vi.mock("@/modules/shared/records/catalog", () => ({
  useRecordCatalog: () => ({ resources: [{ id: "subjects", permission: "school.manage" }] }),
}));

afterEach(cleanup);
const field: FieldDefinition = {
  name: "subject_id",
  label: "Předmět",
  reference: "subjects",
  type: "uuid",
  required: true,
  nullable: false,
};

it("offers named authorized choices without asking the teacher to enter an ID", () => {
  const change = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ReferenceOptionsProvider value={{ subjects: { "math-id": "Matematika" } }}>
        <ReferenceField field={field} value="" onChange={change} />
      </ReferenceOptionsProvider>
    </QueryClientProvider>,
  );
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  expect(screen.getByRole("option", { name: "Matematika" })).toBeVisible();
  fireEvent.change(screen.getByRole("combobox", { name: "Předmět" }), {
    target: { value: "math-id" },
  });
  expect(change).toHaveBeenCalledWith("math-id");
});

it("explains missing access and prevents submitting an unavailable required choice", () => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ReferenceField field={field} value="" onChange={vi.fn()} />
    </QueryClientProvider>,
  );
  expect(screen.getByText(/Požádejte správce školy/)).toBeVisible();
  expect(screen.getByRole("combobox")).toBeInvalid();
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
});
