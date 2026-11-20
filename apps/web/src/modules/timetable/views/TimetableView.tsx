"use client";
import { CalendarDays, Copy, SlidersHorizontal } from "lucide-react";
import { useState } from "react";

import { useQueryValue } from "@/core/hooks/useQueryValue";
import { EmptyState } from "@/core/ui/feedback/EmptyState";
import { ModuleLayout } from "@/core/ui/layout/Page";
import { ViewSwitcher } from "@/core/ui/navigation/ViewSwitcher";
import { useConfirm } from "@/core/ui/overlays/ConfirmProvider";
import { RelatedRecords } from "@/modules/shared/records/components/RelatedRecords";
import { ResourceWorkspace } from "@/modules/shared/records/components/ResourceWorkspace";
import { usePermissions } from "@/modules/shared/records/hooks";
import { SchoolYearScope } from "@/modules/shared/school-year/SchoolYearScope";
import { ScheduleWorkspace } from "@/modules/timetable/components/ScheduleWorkspace";

import { PlannerWorkspace } from "../components/PlannerWorkspace";
import "../timetable.css";

export function TimetableView() {
  const can = usePermissions();
  const [view, setView] = useQueryValue("view");
  const [dirty, setDirty] = useState(false);
  const confirm = useConfirm();
  const navigate = (action: () => void) => {
    if (!dirty) {
      action();
      return;
    }
    confirm({
      title: "Zahodit rozepsané opakování?",
      description: "Změny cyklu ještě nejsou uložené.",
      confirmLabel: "Zahodit změny",
      onConfirm: action,
    });
  };
  const read = can("timetable.read");
  const manage = can("timetable.edit") || can("timetable.substitute");

  const selected =
    (view === "schedule" && read) || !manage
      ? "schedule"
      : view === "changes" && can("timetable.substitute")
        ? "changes"
        : "manage";
  const navigation = manage ? (
    <ViewSwitcher
      label="Rozvrh"
      items={[
        ...(read ? [{ id: "schedule", title: "Týdenní rozvrh", icon: CalendarDays }] : []),
        { id: "manage", title: "Příprava rozvrhu", icon: SlidersHorizontal },
        ...(can("timetable.substitute") ? [{ id: "changes", title: "Suplování", icon: Copy }] : []),
      ]}
      value={selected}
      onChange={(value) => navigate(() => setView(value))}
    />
  ) : undefined;
  return (
    <ModuleLayout
      title="Rozvrh"
      description="Týdenní výuka, příprava rozvrhu a suplování."
      navigation={navigation}
    >
      {!read && !manage ? (
        <EmptyState title="K rozvrhu nemáte oprávnění">
          Příslušná oprávnění přiděluje správce školy.
        </EmptyState>
      ) : selected === "schedule" ? (
        <ScheduleWorkspace />
      ) : (
        <SchoolYearScope compact beforeChange={navigate}>
          {(yearSelector) =>
            selected === "changes" ? (
              <>
                {yearSelector}
                <ResourceWorkspace
                  module="timetable"
                  resourceIds={["lesson_occurrences"]}
                  renderResource={() => (
                    <RelatedRecords
                      resourceId="lesson_occurrences"
                      sections={[
                        {
                          id: "lesson_changes",
                          parentField: "lesson_occurrence_id",
                          createLabel: "Změnit hodinu",
                        },
                      ]}
                    />
                  )}
                />
              </>
            ) : can("timetable.edit") ? (
              <PlannerWorkspace yearSelector={yearSelector} onDirtyChange={setDirty} />
            ) : (
              <>
                {yearSelector}
                <ResourceWorkspace module="timetable" />
              </>
            )
          }
        </SchoolYearScope>
      )}
    </ModuleLayout>
  );
}
