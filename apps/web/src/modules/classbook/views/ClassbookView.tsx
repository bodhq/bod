"use client";
import type { WorkflowDefinition } from "@/modules/shared/records/types";

import {
  BookOpen,
  ClipboardCheck,
  MessageSquare,
  NotebookPen,
  SlidersHorizontal,
  UserCheck,
} from "lucide-react";
import { useState } from "react";

import { schoolRole } from "@/core/auth/roles";
import { useAuthUser } from "@/core/auth/store";
import { useQueryValue } from "@/core/hooks/useQueryValue";
import { Button } from "@/core/ui/actions/Button";
import { EmptyState } from "@/core/ui/feedback/EmptyState";
import { ModuleLayout } from "@/core/ui/layout/Page";
import { ViewSwitcher } from "@/core/ui/navigation/ViewSwitcher";
import { useConfirm } from "@/core/ui/overlays/ConfirmProvider";
import { useRecordCatalog } from "@/modules/shared/records/catalog";
import { RelatedRecords } from "@/modules/shared/records/components/RelatedRecords";
import { ResourceWorkspace } from "@/modules/shared/records/components/ResourceWorkspace";
import { WorkflowDialog } from "@/modules/shared/records/components/WorkflowDialog";
import { usePermissions } from "@/modules/shared/records/hooks";
import { SchoolYearScope } from "@/modules/shared/school-year/SchoolYearScope";

import "../classbook.css";
import { ExcuseInbox } from "../components/ExcuseInbox";
import { LessonJournal } from "../components/LessonJournal";
import { OwnAttendance } from "../components/OwnAttendance";
import { OwnExcuses } from "../components/OwnExcuses";
import { classbookViews } from "../navigation";

export function ClassbookView() {
  const { getWorkflow } = useRecordCatalog();
  const can = usePermissions();
  const confirm = useConfirm();
  const [dirty, setDirty] = useState(false);
  const user = useAuthUser();
  const views = classbookViews(can, schoolRole(user));
  const [selected, setSelected] = useQueryValue("view");
  const current = views.some((view) => view.id === selected) ? selected : views[0]?.id;
  const [workflow, setWorkflow] = useState<WorkflowDefinition | null>(null);

  return (
    <ModuleLayout
      title="Třídnice"
      description="Zápisy výuky, docházka a omluvenky."
      className="classbook-page"
      navigation={
        views.length > 1 ? (
          <ViewSwitcher
            label="Třídnice"
            items={views.map((item) => ({
              ...item,
              icon:
                (
                  {
                    lessons: BookOpen,
                    attendance: UserCheck,
                    excuses: MessageSquare,
                    mark: NotebookPen,
                    decide: ClipboardCheck,
                    manage: SlidersHorizontal,
                  } as Record<string, typeof BookOpen>
                )[item.id] ?? BookOpen,
            }))}
            value={current ?? ""}
            onChange={(value) => {
              if (!dirty) {
                setSelected(value);
                return;
              }
              confirm({
                title: "Zahodit rozepsaný zápis?",
                description: "Zápis ještě není uložený.",
                confirmLabel: "Zahodit změny",
                onConfirm: () => setSelected(value),
              });
            }}
          />
        ) : undefined
      }
    >
      {!current ? (
        <EmptyState title="Ke třídnici nemáte oprávnění">
          Příslušná oprávnění přiděluje správce školy.
        </EmptyState>
      ) : (
        <div className="ui-stack">
          {current === "lessons" && <LessonJournal onDirtyChange={setDirty} />}
          {current === "attendance" && <OwnAttendance />}
          {current === "excuses" && <OwnExcuses />}
          {current === "decide" && <ExcuseInbox />}
          {current === "manage" && (
            <SchoolYearScope>
              <ResourceWorkspace
                module="classbook"
                resourceIds={["attendance_records", "absence_excuse_requests"]}
                renderResource={(resource) =>
                  resource.id === "absence_excuse_requests" ? (
                    <RelatedRecords
                      resourceId={resource.id}
                      sections={[
                        {
                          id: "absence_excuse_items",
                          parentField: "request_id",
                          title: "Absence v omluvence",
                        },
                      ]}
                    />
                  ) : undefined
                }
              />
            </SchoolYearScope>
          )}
          {current === "mark" && (
            <div className="ui-stack">
              <h2 className="text-xl font-semibold">Zapsat docházku do hodiny</h2>
              <p className="max-w-xl text-sm leading-6 text-(--color-muted-foreground)">
                Otevřete konkrétní zápis v přehledu výuky, nebo použijte identifikátor existujícího
                zápisu a žáka.
              </p>
              <Button onClick={() => setWorkflow(getWorkflow("attendance"))}>
                Zapsat docházku
              </Button>
            </div>
          )}
          {workflow && <WorkflowDialog workflow={workflow} onClose={() => setWorkflow(null)} />}
        </div>
      )}
    </ModuleLayout>
  );
}
