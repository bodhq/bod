import type { ReactNode } from "react";

import { readFileSync } from "node:fs";
import { fileURLToPath, URL as NodeURL } from "node:url";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "@/core/auth/store";
import { getResource, resources, workflows } from "@/modules/catalog";
import { resourcePath } from "@/modules/shared/records/api";
import { RecordCatalogProvider } from "@/modules/shared/records/catalog";
import { RecordForm } from "@/modules/shared/records/components/RecordForm";
import { ReferenceField } from "@/modules/shared/records/components/ReferenceField";
import { formDefaults, formPayload } from "@/modules/shared/records/form-values";
import { addDays, localInstant, monday, schoolInstant } from "@/modules/shared/records/format";
import { RecordScopeProvider } from "@/modules/shared/records/scope";

vi.mock("@/core/ui/overlays/ConfirmProvider", () => ({ useConfirm: () => vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
afterEach(() => vi.restoreAllMocks());

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <RecordCatalogProvider catalog={{ resources, workflows }}>{children}</RecordCatalogProvider>
    </QueryClientProvider>
  );
}

describe("school API integration", () => {
  beforeEach(() => useAuthStore.setState({ user: null }));

  it("offers only resource operations and editable fields present in the backend contract", () => {
    const schema = JSON.parse(
      readFileSync(
        fileURLToPath(new NodeURL("../../apps/api/schema/openapi.json", import.meta.url)),
        "utf8",
      ),
    );
    for (const resource of resources) {
      expect(schema.paths[resource.path]?.get, resource.id).toBeDefined();
      if (resource.canCreate !== false)
        expect(schema.paths[resource.path]?.post, resource.id).toBeDefined();
      if (resource.parsePatch) {
        const operation = schema.paths[resource.itemPath]?.patch;
        expect(operation, resource.id).toBeDefined();
        const name = operation.requestBody.content["application/json"].schema.$ref
          .split("/")
          .at(-1);
        expect(
          resource.patchFields.filter(
            (field) => !Object.hasOwn(schema.components.schemas[name].properties, field),
          ),
          resource.id,
        ).toEqual([]);
      }
    }
  });

  it("addresses every component of compound identities and escapes codes", () => {
    expect(
      resourcePath(getResource("parent_students"), { parent_id: "parent", student_id: "student" }),
    ).toBe("/api/v1/school/parent-students/parent/student");
    expect(
      resourcePath(getResource("teaching_plan_calendar_weeks"), {
        teaching_plan_id: "plan",
        week_starts_on: "2026-11-02",
      }),
    ).toBe("/api/v1/timetable/teaching-plan-calendar-weeks/plan/2026-11-02");
    expect(resourcePath(getResource("room_types"), { code: "A/B" })).toBe(
      "/api/v1/rooms/room-types/A%2FB",
    );
    expect(() => resourcePath(getResource("parent_students"), { parent_id: "parent" })).toThrow(
      "úplný identifikátor",
    );
  });

  it("keeps dates, numeric zero and nullable clears distinct", () => {
    const fields = getResource("room_unavailability").fields;
    const values = formDefaults(fields, {
      room_id: "room",
      starts_at: "2026-11-02T07:00:00Z",
      ends_at: "2026-11-02T08:00:00Z",
      reason: "",
    });
    expect(values.starts_at).toBe("2026-11-02T08:00");
    expect(formPayload(fields, values, true)).toMatchObject({
      starts_at: "2026-11-02T07:00:00.000Z",
      reason: null,
    });
    expect(
      formPayload(getResource("rooms").fields, {
        code: "A1",
        room_type_code: "lab",
        capacity: "0",
        is_active: false,
      }),
    ).toMatchObject({ capacity: 0, is_active: false });
  });

  it("validates forms against the existing generated contracts", () => {
    expect(() =>
      getResource("school_years").parseCreate({
        name: "2026/2027",
        starts_on: "bad-date",
        ends_on: "2027-07-01",
      }),
    ).toThrow();
    expect(() =>
      getResource("rooms").parseCreate({ code: "A1", room_type_code: "lab", capacity: "30" }),
    ).toThrow();
    expect(() =>
      getResource("time_slots").parseCreate({
        time_grid_id: "b2dd5555-9997-4a7e-b25e-99200adb6db3",
        position: 1,
        start_time: "08:00",
        end_time: "08:45",
      }),
    ).not.toThrow();
    expect(resources).toHaveLength(42);
    expect(workflows.map((workflow) => workflow.id)).toEqual(
      expect.arrayContaining([
        "divide",
        "calendar",
        "publish",
        "close",
        "clone",
        "sign",
        "attendance",
        "decide",
      ]),
    );
  });

  it("retains separate study fields and specializations in enrollment and division requests", () => {
    const field = "b2dd5555-9997-4a7e-b25e-99200adb6db3";
    const specialization = "a2dd5555-9997-4a7e-b25e-99200adb6db3";
    expect(
      getResource("class_enrollments").parsePatch?.({
        study_field_id: field,
        specialization_id: specialization,
      }),
    ).toEqual({ study_field_id: field, specialization_id: specialization });
    expect(getResource("specializations").parsePatch?.({ study_field_id: null })).toEqual({
      study_field_id: null,
    });
    expect(getResource("group_divisions").parsePatch?.({ method: "study_field" })).toEqual({
      method: "study_field",
    });
    expect(
      resourcePath(getResource("group_study_field_rules"), {
        group_id: "group",
        study_field_id: field,
      }),
    ).toBe(`/api/v1/school/group-study-field-rules/group/${field}`);
  });

  it("accepts a timetable without a distance model and keeps room placement on the server", () => {
    const versions = getResource("timetable_versions");
    const model = versions.fields.find((field) => field.name === "distance_model_id");
    expect(model).toMatchObject({ required: false, nullable: true });
    expect(
      versions.parsePatch?.(formPayload(model ? [model] : [], { distance_model_id: "" }, true)),
    ).toEqual({ distance_model_id: null });
    const floor = "b2dd5555-9997-4a7e-b25e-99200adb6db3";
    const room = getResource("rooms");
    expect(room.parsePatch?.({ floor_id: floor, x: 0, y: 10, width: 20, height: 30 })).toEqual({
      floor_id: floor,
      x: 0,
      y: 10,
      width: 20,
      height: 30,
    });
    expect(() => room.parsePatch?.({ x: -1 })).toThrow();
    expect(() =>
      getResource("building_floors").parseCreate({ building_id: floor, number: 0, width: 0 }),
    ).toThrow();
  });

  it("does not request an account directory without users.manage", () => {
    const fetch = vi.spyOn(globalThis, "fetch");
    const field = getResource("classes").fields.find((item) => item.name === "class_teacher_id");
    if (!field) throw new Error("Missing field");
    render(<ReferenceField field={field} value="" onChange={vi.fn()} />, { wrapper });
    expect(screen.getByRole("combobox", { name: "Třídní učitel" })).toBeVisible();
    expect(fetch).not.toHaveBeenCalled();
    fetch.mockRestore();
  });

  it("submits native number inputs as numbers and retains data after a rejected save", async () => {
    const onSave = vi.fn().mockRejectedValue(new Error("Učebna už existuje."));
    const fields = getResource("rooms").fields.filter((field) =>
      ["code", "capacity"].includes(field.name),
    );
    render(<RecordForm fields={fields} onSave={onSave} onCancel={vi.fn()} />, { wrapper });
    fireEvent.change(screen.getByLabelText("Zkratka"), { target: { value: "A1" } });
    fireEvent.change(screen.getByLabelText("Kapacita"), { target: { value: "30" } });
    fireEvent.click(screen.getByRole("button", { name: "Uložit" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ code: "A1", capacity: 30 }));
    expect(await screen.findByText("Učebna už existuje.")).toBeVisible();
    expect(screen.getByLabelText("Zkratka")).toHaveValue("A1");
  });
});

describe("school calendar in Europe/Prague", () => {
  it("uses Monday and an exclusive next-week boundary across DST", () => {
    expect(monday("2026-10-25")).toBe("2026-10-19");
    expect(addDays("2026-10-19", 7)).toBe("2026-10-26");
    expect(schoolInstant("2026-07-01T08:00")).toBe("2026-07-01T06:00:00.000Z");
    expect(schoolInstant("2026-11-02T08:00")).toBe("2026-11-02T07:00:00.000Z");
    expect(localInstant("2026-07-01T06:00:00Z")).toBe("2026-07-01T08:00");
  });
  it("rejects a nonexistent local time instead of moving the lesson silently", () => {
    expect(() => schoolInstant("2026-03-29T02:30")).toThrow("neexistuje");
  });
});

describe("school-year validity instead of repeated date entry", () => {
  const scope = {
    defaults: { valid_from: "2026-09-01", valid_to: "2027-07-01" },
    interval: { start: "2026-09-01", end: "2027-07-01", label: "2026/2027" },
  };
  const fields = getResource("class_enrollments").fields.filter((field) =>
    ["valid_from", "valid_to"].includes(field.name),
  );
  it("does not silently select a closing date for an explicit workflow action", () => {
    const closing = workflows.find((item) => item.id === "close");
    if (!closing) throw new Error("Missing close workflow");
    render(
      <RecordScopeProvider value={scope}>
        <RecordForm
          fields={closing.fields}
          useScopeDefaults={false}
          onSave={vi.fn()}
          onCancel={vi.fn()}
        />
      </RecordScopeProvider>,
      { wrapper },
    );
    expect(screen.getByLabelText("Poslední den platnosti")).toHaveValue("");
  });
  it("uses the selected school year without displaying redundant date fields", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    render(
      <RecordScopeProvider value={scope}>
        <RecordForm fields={fields} onSave={save} onCancel={vi.fn()} />
      </RecordScopeProvider>,
      { wrapper },
    );
    expect(screen.getByRole("checkbox", { name: "Celý školní rok 2026/2027" })).toBeChecked();
    expect(screen.queryByLabelText("Platí od")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Uložit" }));
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith({ valid_from: "2026-09-01", valid_to: "2027-07-01" }),
    );
  });
  it("allows a shorter period and converts the last included day to the API boundary", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    render(
      <RecordScopeProvider value={scope}>
        <RecordForm fields={fields} onSave={save} onCancel={vi.fn()} />
      </RecordScopeProvider>,
      { wrapper },
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "Celý školní rok 2026/2027" }));
    expect(screen.getByLabelText("Poslední den platnosti")).toHaveValue("2027-06-30");
    fireEvent.change(screen.getByLabelText("Platí od"), { target: { value: "2026-10-01" } });
    fireEvent.change(screen.getByLabelText("Poslední den platnosti"), {
      target: { value: "2026-12-31" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Uložit" }));
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith({ valid_from: "2026-10-01", valid_to: "2027-01-01" }),
    );
  });
  it("preserves historical dates instead of applying this year's defaults while editing", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    render(
      <RecordScopeProvider value={scope}>
        <RecordForm
          editing
          initial={{ valid_from: "2025-09-01", valid_to: "2026-07-01" }}
          fields={fields}
          onSave={save}
          onCancel={vi.fn()}
        />
      </RecordScopeProvider>,
      { wrapper },
    );
    expect(screen.queryByRole("checkbox", { name: /Celý školní rok/ })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Poslední den platnosti")).toHaveValue("2026-06-30");
    fireEvent.click(screen.getByRole("button", { name: "Uložit" }));
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith({ valid_from: "2025-09-01", valid_to: "2026-07-01" }),
    );
  });
});

it("normalizes clock inputs and catches invalid bell periods before sending", () => {
  const fields = getResource("time_slots").fields;
  const body = {
    time_grid_id: "b2dd5555-9997-4a7e-b25e-99200adb6db3",
    position: "1",
    start_time: "08:00",
    end_time: "08:45",
  };
  expect(formPayload(fields, body)).toMatchObject({
    position: 1,
    start_time: "08:00:00",
    end_time: "08:45:00",
  });
  expect(() => formPayload(fields, { ...body, position: "0" })).toThrow("musí být alespoň 1");
  expect(() => formPayload(fields, { ...body, end_time: "07:45" })).toThrow("Konec hodiny");
  expect(() => formPayload(fields, { ...body, start_time: "25:00" })).toThrow("platný čas");
});
