"use client";

import type { useRoomStudio } from "../hooks/useRoomStudio";

import { CalendarOff, Users } from "lucide-react";
import { useState } from "react";

import { Button } from "@/core/ui/actions/Button";
import { Badge } from "@/core/ui/feedback/Badge";
import { PageHeader } from "@/core/ui/layout/Page";
import { ViewSwitcher } from "@/core/ui/navigation/ViewSwitcher";
import { patchRow } from "@/modules/shared/records/api";
import { RecordDialog } from "@/modules/shared/records/components/RecordDialog";
import { ResourceManager } from "@/modules/shared/records/components/ResourceManager";
import { rowLabel } from "@/modules/shared/records/format";
import { useWorkspaceRefresh } from "@/modules/shared/records/hooks";

type Model = Pick<
  ReturnType<typeof useRoomStudio>,
  "typeName" | "selected" | "setEditor" | "section" | "setSection" | "getResource"
>;
export function RoomDetails({ model }: { model: Model }) {
  const [layoutOpen, setLayoutOpen] = useState(false);
  const refresh = useWorkspaceRefresh();
  const { typeName, selected, setEditor, section, setSection, getResource } = model;
  if (!selected) return null;
  return (
    <section className="ui-stack">
      <PageHeader
        compact
        showBreadcrumbs={false}
        showAppActions={false}
        level="h2"
        title={rowLabel(selected)}
        description={`${typeName(selected.room_type_code)} · ${String(selected.capacity)} míst`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setLayoutOpen(true)}>
              Umístění v budově
            </Button>
            <Button variant="outline" onClick={() => setEditor({ row: selected })}>
              Upravit údaje
            </Button>
          </div>
        }
      />
      {selected.is_active === false && <Badge>Mimo provoz</Badge>}
      {layoutOpen && (
        <RecordDialog
          title="Umístění učebny v budově"
          description="Vyberte sdílené patro a polohu učebny v jeho plánu. Pro odebrání umístění vymažte patro i rozměry."
          editing
          initial={selected}
          fields={getResource("rooms").fields.filter((field) =>
            ["floor_id", "x", "y", "width", "height"].includes(field.name),
          )}
          onClose={() => setLayoutOpen(false)}
          onSave={async (values) => {
            await patchRow(getResource("rooms"), selected, values);
            await refresh();
            setLayoutOpen(false);
          }}
        />
      )}
      <ViewSwitcher
        label="Obsah učebny"
        items={[
          { id: "availability", title: "Dostupnost v čase", icon: CalendarOff },
          { id: "groups", title: "Kmenové skupiny", icon: Users },
        ]}
        value={section}
        onChange={setSection}
      />
      <ResourceManager
        key={`${selected.id}:${section}`}
        resource={getResource(
          section === "availability" ? "room_unavailability" : "group_home_rooms",
        )}
        bound={{ room_id: selected.id }}
        createLabel={section === "availability" ? "Přidat nedostupnost" : "Přiřadit skupinu"}
      />
    </section>
  );
}
