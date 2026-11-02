"""Shared persistence primitives; all domain SQL stays in repositories."""

from typing import Any, TypeVar

from sqlalchemy import Table, delete, select
from sqlmodel import Session, SQLModel

from server.core.access.repository import AccessError

M = TypeVar("M", bound=SQLModel)


class DomainRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def table(self, name: str) -> Table:
        return SQLModel.metadata.tables[name]

    def rows(self, name: str, **filters: Any) -> list[dict[str, Any]]:
        table = self.table(name)
        query = select(table)
        for key, value in filters.items():
            query = query.where(table.c[key] == value)
        return [dict(row) for row in self.db.execute(query).mappings()]

    def one(self, name: str, **identity: Any) -> dict[str, Any]:
        rows = self.rows(name, **identity)
        if not rows:
            raise AccessError("not_found", f"Záznam {name} nebyl nalezen.")
        return rows[0]

    def entity(self, model: type[M], key: dict[str, Any]) -> M:
        table = self.table(str(model.__tablename__))
        keys = [col.name for col in table.primary_key.columns]
        if set(keys) != set(key):
            raise AccessError("invalid_request", "Neúplný klíč záznamu.")
        identity = tuple(key[k] for k in keys)
        entity = self.db.get(model, identity, populate_existing=True)
        if entity is None:
            raise AccessError("not_found", "Záznam nebyl nalezen.")
        return entity

    def page(self, model: type[SQLModel], offset: int, limit: int) -> list[SQLModel]:
        table = self.table(str(model.__tablename__))
        return list(
            self.db.scalars(
                select(model)
                .order_by(*table.primary_key.columns)
                .offset(offset)
                .limit(limit)
            ).all()
        )

    def add(self, entity: SQLModel) -> None:
        self.db.add(entity)

    def remove(self, entity: SQLModel) -> None:
        self.db.delete(entity)

    def remove_rows(self, name: str, **filters: Any) -> None:
        table = self.table(name)
        query = delete(table)
        for key, value in filters.items():
            query = query.where(table.c[key] == value)
        self.db.execute(query)

    def flush(self) -> None:
        self.db.flush()

    def commit(self) -> None:
        self.db.commit()

    def rollback(self) -> None:
        self.db.rollback()
