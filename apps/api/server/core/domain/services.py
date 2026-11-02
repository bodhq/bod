"""Transaction boundary for audited domain mutations.

The existing management lock also serializes role revocation with domain writes.
This favors correctness while this single-school backend is being implemented.
"""

from collections.abc import Callable
from datetime import UTC, date, datetime
from typing import Any, TypeVar

from pydantic import BaseModel, ValidationError
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, SQLModel

from server.core.access.repository import AccessError, AccessRepository
from server.core.access.services import AccessContext, AccessService
from server.core.users.models import utcnow

from .repository import DomainRepository
from .resource import Resource

T = TypeVar("T")


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AccessError("invalid_request", message)


def conflict(condition: bool, message: str) -> None:
    if condition:
        raise AccessError("conflict", message)


def authorize(condition: bool, message: str) -> None:
    if not condition:
        raise AccessError("forbidden", message)


def overlaps(start: Any, end: Any, other_start: Any, other_end: Any) -> bool:
    return (end is None or other_start < end) and (
        other_end is None or start < other_end
    )


def instant(value: datetime) -> datetime:
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value


class DomainService:
    def __init__(self, session: Session, resource: Resource) -> None:
        self.repo = DomainRepository(session)
        self.resource = resource
        self.access = AccessService(AccessRepository(session))

    def transaction(
        self,
        actor: AccessContext,
        permission: str,
        action: Callable[[AccessContext], T],
    ) -> T:
        try:
            fresh = self.access.manage(actor, permission)
            result = action(fresh)
            self.repo.commit()
            return result
        except IntegrityError as error:
            self.repo.rollback()
            raise AccessError(
                "conflict", "Změna porušuje vazbu, unikátnost nebo databázové pravidlo."
            ) from error
        except ValidationError as error:
            self.repo.rollback()
            raise AccessError(
                "invalid_request", "Neplatná kombinace hodnot."
            ) from error
        except Exception:
            self.repo.rollback()
            raise

    def list(self, actor: AccessContext, offset: int, limit: int) -> list[SQLModel]:
        self.access.require(actor, self.resource.permission)
        return self.repo.page(self.resource.model, offset, limit)

    def get(self, actor: AccessContext, key: dict[str, Any]) -> SQLModel:
        self.access.require(actor, self.resource.permission)
        return self.repo.entity(self.resource.model, key)

    def create(self, actor: AccessContext, payload: BaseModel) -> SQLModel:
        def action(fresh: AccessContext) -> SQLModel:
            data = payload.model_dump()
            fields = self.resource.model.model_fields
            for field in ("created_by", "updated_by", "recorded_by"):
                if field in fields:
                    data[field] = fresh.user.id
            self.validate(data, None, fresh)
            entity = self.resource.model.model_validate(data)
            self.repo.add(entity)
            self.repo.flush()
            self.after_write(entity.model_dump(), None, fresh)
            self.audit(fresh, entity, "created", None)
            return entity

        return self.transaction(actor, self.resource.permission, action)

    def patch(
        self,
        actor: AccessContext,
        key: dict[str, Any],
        payload: BaseModel,
    ) -> SQLModel:
        require(bool(payload.model_fields_set), "Pošli alespoň jedno pole.")

        def action(fresh: AccessContext) -> SQLModel:
            entity = self.repo.entity(self.resource.model, key)
            old = entity.model_dump()
            data = old | payload.model_dump(exclude_unset=True)
            writable = self.resource.create_schema.model_fields
            self.resource.create_schema.model_validate(
                {key: value for key, value in data.items() if key in writable}
            )
            self.validate(data, old, fresh)
            for field in payload.model_fields_set:
                setattr(entity, field, data[field])
            self.touch(entity, fresh)
            self.repo.flush()
            self.after_write(entity.model_dump(), old, fresh)
            self.audit(fresh, entity, "updated", old)
            return entity

        return self.transaction(actor, self.resource.permission, action)

    def delete(self, actor: AccessContext, key: dict[str, Any]) -> None:
        def action(fresh: AccessContext) -> None:
            entity = self.repo.entity(self.resource.model, key)
            old = entity.model_dump()
            self.validate_delete(old, fresh)
            self.audit(fresh, entity, "deleted", old)
            self.repo.remove(entity)
            self.repo.flush()
            self.after_write(None, old, fresh)

        self.transaction(actor, self.resource.permission, action)

    def touch(self, entity: SQLModel, actor: AccessContext) -> None:
        if "updated_at" in type(entity).model_fields:
            entity.updated_at = utcnow()
        if "updated_by" in type(entity).model_fields:
            entity.updated_by = actor.user.id

    def audit(
        self,
        actor: AccessContext,
        entity: SQLModel,
        operation: str,
        old: dict[str, Any] | None,
    ) -> None:
        read = self.resource.read_schema
        after = read.model_validate(entity).model_dump(mode="json")
        before = read.model_validate(old).model_dump(mode="json") if old else None
        table = self.repo.table(self.resource.name)
        identity = ":".join(str(getattr(entity, c.name)) for c in table.primary_key)
        self.access.repo.audit(
            actor,
            self.resource.name + "." + operation,
            self.resource.name,
            identity,
            before=before,
            after=None if operation == "deleted" else after,
            operation=operation,
        )

    def validate(
        self,
        data: dict[str, Any],
        old: dict[str, Any] | None,
        actor: AccessContext,
    ) -> None:
        for start, end in (
            ("starts_on", "ends_on"),
            ("valid_from", "valid_to"),
            ("starts_at", "ends_at"),
            ("start_time", "end_time"),
        ):
            if data.get(start) is not None and data.get(end) is not None:
                require(data[start] < data[end], "Začátek musí být před koncem.")
        for field in (
            "capacity",
            "position",
            "periods",
            "duration_weeks",
            "relative_cost",
        ):
            if data.get(field) is not None:
                require(
                    data[field] is not None and data[field] > 0,
                    f"{field} musí být kladné.",
                )
        if "day_of_week" in data:
            require(
                data["day_of_week"] is not None and 1 <= data["day_of_week"] <= 7,
                "Neplatný den týdne.",
            )
        for field in ("cycle_anchor_monday", "week_starts_on"):
            if field in data:
                require(
                    isinstance(data[field], date) and data[field].weekday() == 0,
                    "Kotva i začátek týdne musí být pondělí.",
                )

    def validate_delete(self, old: dict[str, Any], actor: AccessContext) -> None:
        pass

    def after_write(
        self,
        data: dict[str, Any] | None,
        old: dict[str, Any] | None,
        actor: AccessContext,
    ) -> None:
        pass

    def user_role(self, user_id: Any, role: str) -> None:
        user = self.repo.one("users", id=user_id)
        require(user["is_active"], "Účet musí být aktivní.")
        require(
            bool(self.repo.rows("user_roles", user_id=user_id, role_code=role)),
            f"Účet musí mít roli {role}.",
        )
