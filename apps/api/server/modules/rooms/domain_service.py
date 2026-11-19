from typing import Any

from server.core.access.services import AccessContext
from server.core.domain.services import DomainService, conflict, require
from server.core.users.models import utcnow


class RoomsDomainService(DomainService):
    def building_layout(self, actor: AccessContext, building_id: Any) -> dict[str, Any]:
        self.access.require(actor, self.resource.permission)
        building = self.repo.one("buildings", id=building_id)
        floors = sorted(
            self.repo.rows("building_floors", building_id=building_id),
            key=lambda floor: floor["number"],
        )
        for floor in floors:
            floor["rooms"] = sorted(
                self.repo.rows("rooms", floor_id=floor["id"]),
                key=lambda room: room["code"],
            )
        return building | {"floors": floors}

    def frozen(self, data: dict[str, Any]) -> None:
        table = self.resource.name
        if table == "room_distance_models":
            conflict(
                data.get("frozen_at") is not None, "Model vzdáleností je zmrazený."
            )
        if table == "room_connections":
            parent = self.repo.one("room_distance_models", id=data["distance_model_id"])
            conflict(parent["frozen_at"] is not None, "Model vzdáleností je zmrazený.")

    def validate(
        self,
        data: dict[str, Any],
        old: dict[str, Any] | None,
        actor: AccessContext,
    ) -> None:
        super().validate(data, old, actor)
        self.frozen(data)
        if old:
            self.frozen(old)
        if self.resource.name == "rooms":
            self.validate_layout(data)
        if self.resource.name == "building_floors" and old:
            for room in self.repo.rows("rooms", floor_id=old["id"]):
                self.validate_layout(room, data)
        if self.resource.name == "room_connections":
            conflict(
                data["from_room_id"] == data["to_room_id"],
                "Spojnice musí vést mezi různými místnostmi.",
            )

    def validate_layout(
        self, room: dict[str, Any], floor: dict[str, Any] | None = None
    ) -> None:
        coordinates = [room.get(key) for key in ("x", "y", "width", "height")]
        if room.get("floor_id") is not None and floor is None:
            floor = self.repo.one("building_floors", id=room["floor_id"])
        if all(value is None for value in coordinates):
            return
        require(
            floor is not None and all(value is not None for value in coordinates),
            "Umístění místnosti vyžaduje patro, x, y, šířku a výšku.",
        )
        if floor is not None:
            require(
                room["x"] + room["width"] <= floor["width"]
                and room["y"] + room["height"] <= floor["height"],
                "Místnost přesahuje rozměry patra.",
            )

    def validate_delete(self, old: dict[str, Any], actor: AccessContext) -> None:
        self.frozen(old)

    def after_write(
        self,
        data: dict[str, Any] | None,
        old: dict[str, Any] | None,
        actor: AccessContext,
    ) -> None:
        from server.modules.timetable.services import validate_published

        if self.resource.name == "rooms":
            from server.modules.timetable.repository import SCHOOL_ZONE

            validate_published(
                self.repo, date_from=utcnow().astimezone(SCHOOL_ZONE).date()
            )
