"use client";
import type { Row } from "@/modules/shared/records/types";

import { Button } from "@/core/ui/actions/Button";
import { EmptyState } from "@/core/ui/feedback/EmptyState";
import { ErrorState } from "@/core/ui/feedback/ErrorState";
import { LoadingState } from "@/core/ui/feedback/LoadingState";
import { Select } from "@/core/ui/forms/Select";
import { Panel, PanelHeader } from "@/core/ui/layout/Panel";
import { patchRow, request, resourcePath } from "@/modules/shared/records/api";
import { RecordDialog } from "@/modules/shared/records/components/RecordDialog";
import { WorkflowDialog } from "@/modules/shared/records/components/WorkflowDialog";
import { rowLabel } from "@/modules/shared/records/format";

import { useTimetableStudio } from "../hooks/useTimetableStudio";
import { PlacementDialog } from "./PlacementDialog";
import { PlacementInspector } from "./PlacementInspector";
import { PublicationChecks } from "./PublicationChecks";
import { TeachingBacklog } from "./TeachingBacklog";
import { TimetableCanvas } from "./TimetableCanvas";

export function TimetableEditor({
  planId,
  version: initialVersion,
  onSelectVersion,
  mode = "edit",
  onReview,
  onEdit,
  onPrepare,
}: {
  planId: string;
  version: Row;
  onSelectVersion?: (version: Row) => void;
  mode?: "edit" | "review";
  onReview?: () => void;
  onEdit?: () => void;
  onPrepare?: (step: string) => void;
}) {
  const studio = useTimetableStudio({ planId, version: initialVersion });
  const {
    data,
    version,
    planning,
    getResource,
    workflows,
    resource,
    can,
    refresh,
    editingVersion,
    setEditingVersion,
    weekend,
    setWeekend,
    setWeekId,
    groupId,
    setGroupId,
    teacherId,
    setTeacherId,
    setAssignmentId,
    preferredTime,
    editor,
    setEditor,
    moving,
    setMoving,
    workflowId,
    setWorkflowId,
    showChecks,
    setShowChecks,
    writable,
    weeks,
    week,
    assignments,
    entries,
    slots,
    context,
    name,
    subject,
    label,
    groups,
    teachers,
    selected,
    conflicts,
    remaining,
    excess,
    unset,
    publish,
  } = studio;
  if (data.loading) return <LoadingState>Připravuji pracovní plochu rozvrhu…</LoadingState>;
  if (data.error)
    return (
      <ErrorState
        error={data.error}
        action={
          <Button variant="outline" onClick={data.retry}>
            Zkusit znovu
          </Button>
        }
      />
    );
  const workflow = workflows.find((row) => row.id === workflowId);
  return (
    <section className="min-w-0 space-y-3">
      <PanelHeader
        title={mode === "review" ? "Kontrola rozvrhu" : rowLabel(version)}
        eyebrow={
          mode === "review" ? rowLabel(version) : writable ? "Pracovní návrh" : "Pouze ke čtení"
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {writable && mode === "edit" && (
              <Button variant="outline" onClick={() => setEditingVersion(true)}>
                Nastavení návrhu
              </Button>
            )}
            {mode === "edit" &&
              ["clone", ...(version.status === "published" ? ["close"] : [])].map((id) => {
                const action = workflows.find((row) => row.id === id);
                return action && can(action.permission) ? (
                  <Button key={id} variant="outline" onClick={() => setWorkflowId(id)}>
                    {action.title}
                  </Button>
                ) : null;
              })}
            {mode === "edit" && onReview && <Button onClick={onReview}>Přejít ke kontrole</Button>}
          </div>
        }
      />
      <div className="planner-summary">
        <div>
          <strong>{entries.filter((row) => row.cycle_week_id === week?.id).length}</strong>
          <span>umístěných hodin</span>
        </div>
        <div>
          <strong>{remaining}</strong>
          <span>
            zbývá podle úvazků{excess ? ` · ${excess} navíc` : ""}
            {unset ? ` · ${unset} bez počtu` : ""}
          </span>
        </div>
        <button
          type="button"
          className="text-left"
          onClick={() =>
            mode === "review"
              ? document.getElementById("publication-checks")?.focus()
              : onReview
                ? onReview()
                : setShowChecks((previous) => !previous)
          }
        >
          <strong className={conflicts.length ? "text-(--color-destructive)" : ""}>
            {conflicts.length}
          </strong>
          <span>
            hodin s nálezem · {mode === "review" ? "zobrazit nálezy" : "otevřít kontrolu"}
          </span>
        </button>
        <div>
          <strong>{week ? String(week.code) : "—"}</strong>
          <span>týden cyklu</span>
        </div>
      </div>
      <Panel padded={false} as="div" className="flex flex-wrap items-end gap-3 p-3 sm:p-4">
        <Select
          label="Týden cyklu"
          fieldWidth="short"
          value={String(week?.id ?? "")}
          onChange={(event) => {
            setWeekId(event.target.value);
            setMoving(null);
          }}
        >
          {!weeks.length && <option value="">Nejprve nastavte cyklus</option>}
          {weeks.map((row) => (
            <option key={String(row.id)} value={String(row.id)}>
              {String(row.code)}
              {row.name ? ` · ${row.name}` : ""}
            </option>
          ))}
        </Select>
        {mode === "edit" && (
          <>
            <Select
              aria-label="Zobrazit skupinu"
              fieldWidth="short"
              value={groupId}
              onChange={(event) => {
                setGroupId(event.target.value);
                setAssignmentId("");
                setMoving(null);
              }}
            >
              <option value="">Všechny skupiny</option>
              {groups.map((id) => (
                <option key={id} value={id}>
                  {name(id, "teaching_groups", "Skupina")}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Zobrazit učitele"
              fieldWidth="short"
              value={teacherId}
              onChange={(event) => {
                setTeacherId(event.target.value);
                setAssignmentId("");
                setMoving(null);
              }}
            >
              <option value="">Všichni vyučující</option>
              {teachers.map((id) => (
                <option key={id} value={id}>
                  {name(id, "users", "Vyučující")}
                </option>
              ))}
            </Select>
            <Button
              variant="choice"
              size="sm"
              aria-pressed={weekend}
              onClick={() => setWeekend(!weekend)}
            >
              Víkend
            </Button>
            <p className="ml-auto pb-2 text-xs text-(--color-muted-foreground)">
              Změny se ukládají do pracovního návrhu.
            </p>
          </>
        )}
      </Panel>
      {planning.errors.length > 0 && (
        <ErrorState
          title="Část podkladů se nepodařilo načíst"
          message="Kontrola skupin nebo učeben je neúplná."
          action={
            <Button variant="outline" onClick={planning.retry}>
              Zkusit znovu
            </Button>
          }
        />
      )}
      {!planning.membershipAvailable && (
        <p className="text-xs text-(--color-warning)">
          Překryvy žáků mezi skupinami{" "}
          {planning.loading ? "se načítají" : "nejsou ověřené — chybí přístup k jejich složení"}.
          Stejné skupiny, učitele a obsazené učebny kontrolujeme samostatně.
        </p>
      )}
      {(mode === "review" || showChecks) && (
        <PublicationChecks model={studio} onLocate={onEdit} dismissible={mode !== "review"} />
      )}
      {mode === "review" ? (
        <div className="form-actions">
          {onEdit && (
            <Button variant="outline" onClick={onEdit}>
              Zpět na plátno
            </Button>
          )}
          {writable && can("timetable.publish") && (
            <Button disabled={!studio.publicationReady} onClick={publish}>
              Ověřit celý návrh a publikovat
            </Button>
          )}
        </div>
      ) : !week || !slots.length ? (
        <EmptyState title={!week ? "Chybí týdny cyklu" : "Chybí vyučovací hodiny zvonění"}>
          Doplňte cyklus a zvonění v podkladech. Potom můžete začít rozmísťovat výuku.
          {onPrepare && (
            <Button variant="outline" onClick={() => onPrepare(!week ? "cycle" : "setup")}>
              Doplnit {!week ? "cyklus" : "zvonění"}
            </Button>
          )}
        </EmptyState>
      ) : (
        <div className={`planner-workbench ${!writable ? "planner-workbench-readonly" : ""}`}>
          {writable && <TeachingBacklog model={studio} />}
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-semibold">Týdenní plátno</h3>
                <p className="text-xs text-(--color-muted-foreground)">
                  {moving
                    ? "Vyberte nové místo pro přesun."
                    : selected
                      ? `Umísťujete: ${label(selected)}`
                      : "Vyberte výuku ze zásobníku nebo otevřete hodinu."}
                </p>
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-(--color-muted-foreground)">
                <span>
                  <i className="planner-dot bg-(--color-success)" />
                  Bez nálezu
                </span>
                <span>
                  <i className="planner-dot bg-(--color-warning)" />
                  Doporučení
                </span>
                <span>
                  <i className="planner-dot bg-(--color-destructive)" />
                  Kolize
                </span>
              </div>
            </div>
            {moving && (
              <div className="flex items-center justify-between gap-2 rounded-lg bg-(--color-primary)/10 p-3 text-sm">
                <span>Přesouváte {selected ? subject(selected) : "hodinu"}</span>
                <Button variant="outline" size="sm" onClick={() => setMoving(null)}>
                  Zrušit přesun
                </Button>
              </div>
            )}
            <TimetableCanvas model={studio} />
          </div>
          <PlacementInspector model={studio} />
        </div>
      )}
      {editor && (
        <PlacementDialog
          key={`${editor.existing?.id}:${editor.initial.day_of_week}:${editor.initial.time_slot_id}`}
          initial={editor.initial}
          existing={editor.existing}
          assignments={assignments}
          entries={entries}
          context={context}
          roomsAvailable={planning.available("rooms")}
          label={label}
          preferredTime={preferredTime}
          onClose={() => setEditor(null)}
          onSave={async (values) => {
            if (editor.existing && resource.parsePatch)
              await patchRow(
                resource,
                editor.existing,
                Object.fromEntries(
                  Object.entries(values).filter(([key]) => resource.patchFields.includes(key)),
                ),
              );
            else await request("POST", resource.path, { body: resource.parseCreate(values) });
            await refresh();
            setEditor(null);
            setMoving(null);
          }}
        />
      )}
      {editingVersion && (
        <RecordDialog
          title="Nastavení návrhu"
          editing
          initial={version}
          fields={getResource("timetable_versions").fields.filter(
            (field) =>
              getResource("timetable_versions").patchFields.includes(field.name) &&
              !["status", "teaching_plan_id", "based_on_version_id"].includes(field.name),
          )}
          onClose={() => setEditingVersion(false)}
          onSave={async (body) => {
            const versions = getResource("timetable_versions");
            if (!versions.parsePatch) return;
            await request("PATCH", resourcePath(versions, version), {
              body: versions.parsePatch(body),
            });
            await refresh();
            setEditingVersion(false);
          }}
        />
      )}
      {workflow && (
        <WorkflowDialog
          workflow={workflow}
          row={version}
          onClose={() => setWorkflowId("")}
          onComplete={(result) => {
            if (workflowId === "clone" && result && typeof result === "object")
              onSelectVersion?.(result as Row);
          }}
        />
      )}
    </section>
  );
}
