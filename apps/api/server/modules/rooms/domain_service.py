from typing import Any

from server.core.access.services import AccessContext
from server.core.domain.services import DomainService, conflict
from server.core.users.models import utcnow


class RoomsDomainService(DomainService):
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
        if self.resource.name == "room_connections":
            conflict(
                data["from_room_id"] == data["to_room_id"],
                "Spojnice musí vést mezi různými místnostmi.",
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
