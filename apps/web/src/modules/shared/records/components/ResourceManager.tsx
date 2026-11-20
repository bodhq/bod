"use client";
import type { FieldDefinition, ResourceDefinition, Row } from "@/modules/shared/records/types";

import { searchText } from "@/core/search";
import { Button } from "@/core/ui/actions/Button";
import { EmptyState } from "@/core/ui/feedback/EmptyState";
import { ErrorState } from "@/core/ui/feedback/ErrorState";
import { LoadingState } from "@/core/ui/feedback/LoadingState";
import { toast } from "@/core/ui/feedback/toast";
import { Input } from "@/core/ui/forms/Input";
import { Pagination } from "@/core/ui/navigation/Pagination";
import { Dialog } from "@/core/ui/overlays/Dialog";
import { PAGE_SIZE, patchRow, removeRow, request } from "@/modules/shared/records/api";
import { RecordDialog } from "@/modules/shared/records/components/RecordDialog";
import { WorkflowDialog } from "@/modules/shared/records/components/WorkflowDialog";
import {
  addDays,
  dateLabel,
  rowLabel,
  shortId,
  valueLabels,
} from "@/modules/shared/records/format";

import { useResourceManager } from "../hooks/useResourceManager";
import { ResourceCanvas } from "./ResourceCanvas";

export function ResourceManager({
  resource,
  bound = {},
  readOnly = false,
  onOpen,
  createLabel = resource.createLabel ?? "Přidat",
}: {
  resource: ResourceDefinition;
  bound?: Row;
  readOnly?: boolean;
  onOpen?: (row: Row) => void;
  createLabel?: string;
}) {
  const {
    workflows,
    can,
    user,
    confirm,
    refresh,
    offset,
    setOffset,
    search,
    setSearch,
    editor,
    setEditor,
    detail,
    setDetail,
    action,
    setAction,
    names,
    query,
  } = useResourceManager({ resource, bound });
  if (!can(resource.permission))
    return (
      <EmptyState title="K této evidenci nemáte oprávnění">Obraťte se na správce školy.</EmptyState>
    );
  const format = (field: FieldDefinition, value: unknown): string => {
    if (value === null || value === undefined) return "—";
    if (field.reference) return names[field.reference]?.[String(value)] ?? shortId(value);
    if (typeof value === "boolean") return value ? "Ano" : "Ne";
    if (["date", "date-time"].includes(field.type))
      return dateLabel(
        field.exclusiveEnd ? addDays(String(value), -1) : String(value),
        field.type === "date-time",
      );
    if (field.name === "day_of_week")
      return (
        ["Pondělí", "Úterý", "Středa", "Čtvrtek", "Pátek", "Sobota", "Neděle"][Number(value) - 1] ??
        String(value)
      );
    if (typeof value === "object")
      return Object.entries(value)
        .map(([key, item]) => `${key}: ${item}`)
        .join(", ");
    return valueLabels[String(value)] ?? String(value);
  };
  const columns = resource.readFields
    .filter(
      (field) =>
        !Object.hasOwn(bound, field.name) &&
        ![
          "id",
          "created_by",
          "updated_by",
          "created_at",
          "updated_at",
          "signed_by",
          "signed_at",
          "frozen_at",
          "recorded_by",
          "parameters",
        ].includes(field.name),
    )
    .sort(
      (a, b) =>
        Number(["name", "code", "topic", "reason"].includes(b.name)) -
        Number(["name", "code", "topic", "reason"].includes(a.name)),
    );
  const rows = (query.data ?? []).filter(
    (row) =>
      !search ||
      resource.readFields.some((field) =>
        searchText(format(field, row[field.name])).includes(searchText(search)),
      ),
  );
  const actionsFor = (row: Row) =>
    workflows.filter(
      (workflow) =>
        can(workflow.permission) &&
        ((resource.id === "group_divisions" &&
          workflow.id === "divide" &&
          row.method !== "manual") ||
          (resource.id === "teaching_plans" && workflow.id === "calendar" && !row.frozen_at) ||
          (resource.id === "timetable_versions" &&
            (workflow.id === "clone" ||
              (workflow.id === "publish" && row.status === "draft") ||
              (workflow.id === "close" && row.status === "published"))) ||
          (resource.id === "classbook_entries" &&
            ((workflow.id === "sign" && row.status === "draft") || workflow.id === "attendance")) ||
          (resource.id === "absence_excuse_items" &&
            workflow.id === "decide" &&
            row.decision === "pending")),
    );
  const locked = (row: Row) =>
    readOnly || !!row.frozen_at || (resource.id === "timetable_versions" && row.status !== "draft");
  const formFields = resource.fields.filter(
    (field) =>
      !Object.hasOwn(bound, field.name) &&
      (editor?.row || !field.patchOnly) &&
      (!editor?.row || resource.patchFields.includes(field.name)) &&
      !["status", "requested_by", "origin"].includes(field.name) &&
      (editor?.row?.status !== "signed" ||
        ["topic", "note", "correction_reason"].includes(field.name)),
  );
  const renderActions = (row: Row) => (
    <div className="flex flex-wrap gap-1">
      <Button size="sm" variant="outline" onClick={() => (onOpen ? onOpen(row) : setDetail(row))}>
        {onOpen ? "Otevřít" : "Detail"}
      </Button>
      {resource.parsePatch && !onOpen && !locked(row) && (
        <Button size="sm" variant="outline" onClick={() => setEditor({ row })}>
          Upravit
        </Button>
      )}
      {actionsFor(row)
        .filter((workflow) => !readOnly || workflow.id === "clone")
        .map((workflow) => (
          <Button
            key={workflow.id}
            size="sm"
            variant="outline"
            onClick={() => setAction({ workflow, row })}
          >
            {workflow.title}
          </Button>
        ))}
      {!locked(row) && row.status !== "signed" && !resource.id.startsWith("absence_excuse") && (
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            confirm({
              title: "Odstranit záznam?",
              description: `Odstraníte záznam ${rowLabel(row) || resource.title}. Tuto změnu nelze vrátit.`,
              confirmLabel: "Odstranit",
              destructive: true,
              onConfirm: async () => {
                await removeRow(resource, row);
                await refresh();
                toast.success("Záznam byl odstraněn.");
              },
            })
          }
        >
          Odstranit
        </Button>
      )}
    </div>
  );
  return (
    <section className="ui-stack min-w-0">
      <div className="ui-panel ui-stack p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">{resource.title}</h2>
            <p className="mt-1 text-sm text-(--color-muted-foreground)">
              {onOpen
                ? "Otevřete položku a spravujte její obsah na jednom místě."
                : (resource.description ?? "")}
            </p>
          </div>
          {!readOnly && resource.canCreate !== false && (
            <Button onClick={() => setEditor({})}>{createLabel}</Button>
          )}
        </div>
        <Input
          fieldWidth="standard"
          aria-label={`Hledat: ${resource.title}`}
          placeholder="Hledat ve všech záznamech této evidence…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      {query.isLoading ? (
        <LoadingState>Načítám záznamy…</LoadingState>
      ) : query.isError ? (
        <ErrorState
          title="Evidenci se nepodařilo načíst"
          error={query.error}
          action={
            <Button variant="outline" onClick={() => query.refetch()}>
              Zkusit znovu
            </Button>
          }
        />
      ) : !rows.length ? (
        <EmptyState
          title={
            search ? "Žádné odpovídající záznamy" : (resource.emptyTitle ?? "Zatím tu nic není")
          }
        >
          {search
            ? "Změňte hledaný výraz nebo přejděte na jinou stránku."
            : readOnly || resource.canCreate === false
              ? (resource.description ??
                "Záznamy se zobrazí po jejich vytvoření v příslušné agendě.")
              : `První záznam založíte tlačítkem „${createLabel}“.`}
        </EmptyState>
      ) : (
        <ResourceCanvas
          resource={resource}
          rows={rows}
          columns={columns}
          format={format}
          actions={renderActions}
        />
      )}
      {!Object.keys(bound).length && !search.trim() && (
        <Pagination
          label={`Stránkování: ${resource.title}`}
          offset={offset}
          count={query.data?.length ?? 0}
          pageSize={PAGE_SIZE}
          pending={query.isFetching}
          onChange={setOffset}
        />
      )}
      {editor && (
        <RecordDialog
          title={editor.row ? `Upravit: ${rowLabel(editor.row)}` : createLabel}
          fields={formFields}
          initial={editor.row ?? { requested_by: user?.id, ...bound }}
          editing={!!editor.row}
          onClose={() => setEditor(null)}
          onSave={async (body) => {
            if (editor.row && resource.parsePatch) await patchRow(resource, editor.row, body);
            else
              await request("POST", resource.path, {
                body: resource.parseCreate({
                  ...body,
                  ...bound,
                  ...(resource.fields.some((field) => field.name === "requested_by")
                    ? { requested_by: user?.id }
                    : {}),
                }),
              });
            await refresh();
            setEditor(null);
            toast.success("Záznam byl uložen.");
          }}
        />
      )}
      <Dialog open={!!detail} onClose={() => setDetail(null)} title={resource.title}>
        {detail && (
          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            {resource.readFields.map((field) => (
              <div key={field.name} className="min-w-0">
                <dt className="text-sm text-(--color-muted-foreground)">{field.label}</dt>
                <dd className="mt-1 break-words font-medium">
                  {format(field, detail[field.name])}
                  {field.reference && detail[field.name] != null && (
                    <span className="mt-1 block break-all text-xs font-normal text-(--color-muted-foreground)">
                      {String(detail[field.name])}
                    </span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </Dialog>
      {action && (
        <WorkflowDialog
          workflow={action.workflow}
          row={action.row}
          onClose={() => setAction(null)}
        />
      )}
    </section>
  );
}
