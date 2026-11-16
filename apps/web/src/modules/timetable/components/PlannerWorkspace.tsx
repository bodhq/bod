"use client";
import type { ReactNode } from "react";

import { ArrowRight, List } from "lucide-react";

import { Button } from "@/core/ui/actions/Button";
import { EmptyState } from "@/core/ui/feedback/EmptyState";
import { ErrorState } from "@/core/ui/feedback/ErrorState";
import { Select } from "@/core/ui/forms/Select";
import { StepProgress } from "@/core/ui/navigation/StepProgress";
import { ViewSwitcher } from "@/core/ui/navigation/ViewSwitcher";
import { PlanningGroups } from "@/modules/shared/groups/components/PlanningGroups";
import { request } from "@/modules/shared/records/api";
import { RecordDialog } from "@/modules/shared/records/components/RecordDialog";
import { RelatedRecords } from "@/modules/shared/records/components/RelatedRecords";
import { ResourceManager } from "@/modules/shared/records/components/ResourceManager";
import { rowLabel } from "@/modules/shared/records/format";
import { ReferenceScopeProvider } from "@/modules/shared/records/scope";

import { usePlannerWorkspace } from "../hooks/usePlannerWorkspace";
import {
  defaultPlannerStep,
  phases,
  plannerPhase,
  preparationOrder,
  steps,
} from "../planner-navigation";
import "../studio.css";
import { AcademicCalendar } from "./AcademicCalendar";
import { BellSchedule } from "./BellSchedule";
import { CycleDesigner } from "./CycleDesigner";
import { PlanningPreferences } from "./PlanningPreferences";
import { TeachingLoads } from "./TeachingLoads";
import { TimetableEditor } from "./TimetableEditor";

export function PlannerWorkspace({
  yearSelector,
  onDirtyChange,
}: {
  yearSelector?: ReactNode;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const {
    getResource,
    step,
    setStep,
    refresh,
    setCycleDirty,
    navigate,
    creatingVersion,
    setCreatingVersion,
    setPlanId,
    setVersionId,
    setTab,
    plans,
    versions,
    availablePlans,
    plan,
    activePlanId,
    availableVersions,
    version,
    needsPlan,
    section,
    resourceId,
    resource,
    bound,
  } = usePlannerWorkspace({ onDirtyChange });
  const phase = plannerPhase(step);
  const phaseSteps = phases[phase]?.ids ?? ["changes"];
  const go = (value: string) => {
    if (value !== step) navigate(() => setStep(value));
  };
  const position = preparationOrder.indexOf(step);
  const next = position < 0 ? undefined : preparationOrder[position + 1];
  return (
    <div className="min-w-0 space-y-5">
      {phase >= 0 && (
        <StepProgress
          label="Postup přípravy rozvrhu"
          steps={phases.map((item) => item.title)}
          current={phase}
          completed={[]}
          onChange={(index) => go(phases[index]?.ids[0] ?? defaultPlannerStep)}
        />
      )}
      {phaseSteps.length > 1 && (
        <ViewSwitcher
          label="Část přípravy rozvrhu"
          items={phaseSteps.flatMap((id) => steps.filter((item) => item.id === id))}
          value={step}
          onChange={go}
        />
      )}
      <div className="min-w-0 space-y-3">
        {
          <>
            {!["versions", "review", "groups", "preferences", "cycle", "calendar"].includes(
              step,
            ) && <p className="text-sm text-(--color-muted-foreground)">{section.hint}</p>}
            {plans.isError && <ErrorState error={plans.error} />}
            <div className="flex flex-wrap items-end gap-3">
              {yearSelector}
              {(needsPlan || step === "plans") && (
                <Select
                  label="Pracovní plán"
                  fieldWidth="standard"
                  value={activePlanId}
                  onChange={(event) => {
                    const value = event.target.value;
                    navigate(() => {
                      setPlanId(value, { version: "" });
                    });
                  }}
                >
                  <option value="">{plans.isPending ? "Načítám plány…" : "Vyberte plán…"}</option>
                  {availablePlans.map((row) => (
                    <option key={String(row.id)} value={String(row.id)}>
                      {rowLabel(row)}
                      {row.frozen_at ? " · uzamčený" : ""}
                    </option>
                  ))}
                </Select>
              )}
              {["versions", "preferences", "review"].includes(step) && plan && (
                <>
                  {versions.isError && <ErrorState error={versions.error} />}
                  <Select
                    label="Návrh rozvrhu"
                    fieldWidth="standard"
                    value={String(version?.id ?? "")}
                    onChange={(event) => setVersionId(event.target.value)}
                  >
                    <option value="">Vyberte verzi…</option>
                    {availableVersions.map((row) => (
                      <option key={String(row.id)} value={String(row.id)}>
                        {rowLabel(row)} ·{" "}
                        {row.status === "draft"
                          ? "rozepsáno"
                          : row.status === "published"
                            ? "zveřejněno"
                            : "uzavřeno"}
                      </option>
                    ))}
                  </Select>
                  {step !== "review" && (
                    <Button variant="outline" onClick={() => setCreatingVersion(true)}>
                      Nový návrh rozvrhu
                    </Button>
                  )}
                </>
              )}
            </div>
            {step === "groups" ? (
              <PlanningGroups />
            ) : needsPlan && !plan ? (
              <EmptyState title="Nejprve vyberte pracovní plán">
                <Button variant="outline" onClick={() => go("plans")}>
                  Založit pracovní plán
                </Button>
              </EmptyState>
            ) : (
              <>
                {section.ids.length > 1 && !["cycle", "calendar"].includes(step) && (
                  <ViewSwitcher
                    label="Část přípravy"
                    items={section.ids.map((id) => {
                      const item = getResource(id);
                      return {
                        id,
                        title: id === "timetable_entries" ? "Týdenní plátno" : item.title,
                        icon: item.icon ?? List,
                      };
                    })}
                    value={resourceId}
                    onChange={setTab}
                  />
                )}
                {["versions", "review"].includes(step) && !versions.isPending && !version && (
                  <EmptyState title="Vytvořte první návrh rozvrhu">
                    Zvolte zvonění a model přesunů. Potom můžete rozmísťovat hodiny do týdenní
                    mřížky.
                  </EmptyState>
                )}
                {resource &&
                  (!["timetable_entries", "timetable_preferences"].includes(resourceId) ||
                    version) && (
                    <ReferenceScopeProvider
                      key={`${resourceId}:${activePlanId}:${version?.id}`}
                      value={{
                        teaching_cycle_weeks: { teaching_plan_id: activePlanId },
                        teaching_assignments: { teaching_plan_id: activePlanId },
                        ...(version ? { time_slots: { time_grid_id: version.time_grid_id } } : {}),
                      }}
                    >
                      {resourceId === "timetable_entries" && version ? (
                        <TimetableEditor
                          key={String(version.id)}
                          planId={activePlanId}
                          version={version}
                          mode={step === "review" ? "review" : "edit"}
                          onReview={() => go("review")}
                          onEdit={() => go("versions")}
                          onPrepare={go}
                          onSelectVersion={(created) => {
                            setPlanId(String(created.teaching_plan_id), {
                              version: String(created.id),
                            });
                          }}
                        />
                      ) : resourceId === "timetable_preferences" && version ? (
                        <PlanningPreferences version={version} />
                      ) : resourceId === "teaching_assignments" ? (
                        <TeachingLoads planId={activePlanId} readOnly={!!plan?.frozen_at} />
                      ) : step === "calendar" && plan ? (
                        <AcademicCalendar key={String(plan.id)} plan={plan} />
                      ) : step === "cycle" && plan ? (
                        <CycleDesigner plan={plan} onDirtyChange={setCycleDirty} />
                      ) : resourceId === "time_grids" ? (
                        <RelatedRecords
                          resourceId={resourceId}
                          renderSection={(_section, grid, locked) => (
                            <BellSchedule key={String(grid.id)} grid={grid} readOnly={locked} />
                          )}
                          sections={[
                            {
                              id: "time_slots",
                              parentField: "time_grid_id",
                              createLabel: "Přidat vyučovací hodinu",
                            },
                          ]}
                        />
                      ) : resourceId === "lesson_occurrences" ? (
                        <RelatedRecords
                          resourceId={resourceId}
                          sections={[
                            {
                              id: "lesson_changes",
                              parentField: "lesson_occurrence_id",
                              createLabel: "Změnit hodinu",
                            },
                          ]}
                        />
                      ) : (
                        <ResourceManager
                          key={`${resourceId}:${activePlanId}:${version?.id}`}
                          resource={resource}
                          bound={bound}
                          readOnly={
                            ["timetable_entries", "timetable_preferences"].includes(resourceId)
                              ? version?.status !== "draft"
                              : needsPlan &&
                                resourceId !== "timetable_versions" &&
                                !!plan?.frozen_at
                          }
                        />
                      )}
                    </ReferenceScopeProvider>
                  )}
                {needsPlan &&
                  !!plan?.frozen_at &&
                  resourceId !== "timetable_entries" &&
                  resourceId !== "timetable_versions" && (
                    <p className="text-sm text-(--color-muted-foreground)">
                      Plán je po publikaci uzamčený. Pro úpravy vytvořte kopii verze na plátně.
                    </p>
                  )}
              </>
            )}
          </>
        }
        {next && step !== "review" && (
          <div className="form-actions">
            <Button variant="outline" onClick={() => go(next)}>
              Pokračovat: {steps.find((item) => item.id === next)?.title}
              <ArrowRight size={16} aria-hidden="true" />
            </Button>
          </div>
        )}
        {creatingVersion && plan && (
          <RecordDialog
            title="Nový návrh rozvrhu"
            fields={getResource("timetable_versions").fields.filter(
              (field) =>
                !["teaching_plan_id", "status", "based_on_version_id"].includes(field.name),
            )}
            onClose={() => setCreatingVersion(false)}
            onSave={async (body) => {
              const resource = getResource("timetable_versions");
              const created = await request<import("@/modules/shared/records/types").Row>(
                "POST",
                resource.path,
                { body: resource.parseCreate({ ...body, teaching_plan_id: activePlanId }) },
              );
              await refresh();
              setVersionId(String(created.id));
              setTab("timetable_entries");
              setCreatingVersion(false);
            }}
          />
        )}
      </div>
    </div>
  );
}
