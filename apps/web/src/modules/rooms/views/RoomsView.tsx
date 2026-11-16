"use client";
import { ModuleLayout } from "@/core/ui/layout/Page";
import { RelatedRecords } from "@/modules/shared/records/components/RelatedRecords";
import { ResourceWorkspace } from "@/modules/shared/records/components/ResourceWorkspace";

import { RoomStudio } from "../components/RoomStudio";
import { RoomTransfers } from "../components/RoomTransfers";
import "../rooms.css";

export function RoomsView() {
  return (
    <ModuleLayout title="Prostory" description="Učebny, jejich typy a přesuny mezi nimi.">
      <ResourceWorkspace
        module="rooms"
        labels={{ room_distance_models: "Přesuny" }}
        aliases={{
          room_types: "rooms",
          room_unavailability: "rooms",
          group_home_rooms: "rooms",
          room_connections: "room_distance_models",
          building_floors: "buildings",
        }}
        resourceIds={["rooms", "buildings", "room_distance_models"]}
        renderResource={(resource) => {
          if (resource.id === "buildings")
            return (
              <RelatedRecords
                resourceId="buildings"
                sections={[
                  { id: "building_floors", parentField: "building_id", createLabel: "Nové patro" },
                ]}
              />
            );
          if (resource.id === "rooms") return <RoomStudio />;
          if (resource.id === "room_distance_models") return <RoomTransfers />;
        }}
      />
    </ModuleLayout>
  );
}
