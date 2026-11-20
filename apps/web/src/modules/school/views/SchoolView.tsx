"use client";
import { EmptyState } from "@/core/ui/feedback/EmptyState";
import { ModuleLayout } from "@/core/ui/layout/Page";
import { PlanningGroups } from "@/modules/shared/groups/components/PlanningGroups";
import { RelatedRecords } from "@/modules/shared/records/components/RelatedRecords";
import { ResourceWorkspace } from "@/modules/shared/records/components/ResourceWorkspace";
import { usePermissions } from "@/modules/shared/records/hooks";
import { SchoolYearScope } from "@/modules/shared/school-year/SchoolYearScope";

import { ClassRoster } from "../components/ClassRoster";
import { StudentFamilies } from "../components/StudentFamilies";
import "../school.css";

export function SchoolView() {
  const can = usePermissions();
  return (
    <ModuleLayout
      title="Evidence školy"
      description="Spravujte školní roky, třídy, skupiny, učebny a předměty."
    >
      <SchoolYearScope>
        {(selector) => (
          <ResourceWorkspace
            beforeResource={selector}
            module="school"
            labels={{ parent_students: "Žáci a rodiče" }}
            aliases={{
              class_enrollments: "classes",
              teaching_group_memberships: "teaching_groups",
              group_specialization_rules: "teaching_groups",
              group_study_field_rules: "teaching_groups",
            }}
            resourceIds={[
              "parent_students",
              "classes",
              "teaching_groups",
              "group_divisions",
              "subjects",
              "study_fields",
              "specializations",
              "school_years",
            ]}
            renderResource={(resource) => {
              if (resource.id === "parent_students")
                return can("users.manage") ? (
                  <StudentFamilies />
                ) : (
                  <EmptyState title="Správa žáků a rodičů vyžaduje přístup k účtům">
                    Požádejte správce o oprávnění ke správě uživatelských účtů.
                  </EmptyState>
                );
              if (resource.id === "classes")
                return (
                  <RelatedRecords
                    resourceId="classes"
                    renderSection={(_section, classroom) => (
                      <ClassRoster key={String(classroom.id)} classroom={classroom} />
                    )}
                    createLabel="Nová třída"
                    sections={[
                      {
                        id: "class_enrollments",
                        parentField: "class_id",
                        createLabel: "Přidat žáka do třídy",
                      },
                    ]}
                  />
                );
              if (resource.id === "teaching_groups")
                return (
                  <div className="ui-stack">
                    <PlanningGroups />
                    <details className="ui-panel p-4">
                      <summary className="cursor-pointer text-sm font-medium">
                        Spravovat členství a pravidla skupin
                      </summary>
                      <div className="mt-4">
                        <RelatedRecords
                          resourceId="teaching_groups"
                          createLabel="Nová skupina"
                          sections={[
                            {
                              id: "teaching_group_memberships",
                              parentField: "group_id",
                              title: "Žáci ve skupině",
                              createLabel: "Přidat žáka do skupiny",
                            },
                            {
                              id: "group_study_field_rules",
                              parentField: "group_id",
                              title: "Zařazení podle oboru",
                              createLabel: "Přidat obor",
                            },
                            {
                              id: "group_specialization_rules",
                              parentField: "group_id",
                              title: "Zařazení podle zaměření",
                              createLabel: "Přidat zaměření",
                            },
                          ]}
                        />
                      </div>
                    </details>
                  </div>
                );
            }}
          />
        )}
      </SchoolYearScope>
    </ModuleLayout>
  );
}
