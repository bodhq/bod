"use client";

import type { FieldDefinition, Row, WorkflowDefinition } from "@/modules/shared/records/types";

import { toast } from "@/core/ui/feedback/toast";
import { request } from "@/modules/shared/records/api";
import { RecordDialog } from "@/modules/shared/records/components/RecordDialog";
import { useWorkspaceRefresh } from "@/modules/shared/records/hooks";

export function WorkflowDialog({
  workflow,
  row = {},
  onClose,
  onComplete,
}: {
  workflow: WorkflowDefinition;
  row?: Row;
  onClose: () => void;
  onComplete?: (result: unknown) => void;
}) {
  const refresh = useWorkspaceRefresh();
  const identity: Row = {
    ...row,
    version_id: row.id,
    plan_id: row.id,
    division_id: row.id,
    entry_id: row.id,
    request_id: row.request_id,
    record_id: row.attendance_record_id,
  };
  const pathFields: FieldDefinition[] = [...workflow.path.matchAll(/\{([^}]+)\}/g)]
    .map((match) => match[1] ?? "")
    .filter((key) => !identity[key])
    .map((key) => ({
      name: key,
      label:
        key === "record_id"
          ? "Identifikátor docházky"
          : key === "entry_id"
            ? "Identifikátor zápisu"
            : "Identifikátor žádosti",
      type: "uuid",
      required: true,
      nullable: false,
    }));
  return (
    <RecordDialog
      title={workflow.title}
      description={workflow.description}
      fields={[...pathFields, ...workflow.fields]}
      useScopeDefaults={false}
      initial={
        workflow.id === "clone"
          ? {
              name: `${row.name ?? "Rozvrh"} · kopie`,
              plan_name: `${row.name ?? "Plán"} · nový plán`,
            }
          : workflow.id === "divide" && row.effective_from
            ? { effective_from: row.effective_from }
            : {}
      }
      onClose={onClose}
      label={workflow.title}
      onSave={async (values) => {
        const path = workflow.path.replace(/\{([^}]+)\}/g, (_, key: string) =>
          encodeURIComponent(String(identity[key] ?? values[key])),
        );
        const body = Object.fromEntries(
          workflow.fields
            .filter((field) => values[field.name] !== undefined)
            .map((field) => [field.name, values[field.name]]),
        );
        const result = await request(
          workflow.method === "put" ? "PUT" : "POST",
          path,
          workflow.fields.length ? { body: workflow.parse(body) } : {},
        );
        await refresh();
        onComplete?.(result);
        toast.success("Změna byla uložena.");
        onClose();
      }}
    />
  );
}
