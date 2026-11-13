"""Scoped read queries for classbook workflows, filtered before pagination."""

from datetime import UTC, date
from typing import Any
from uuid import UUID

from sqlalchemy import Date, and_, cast, exists, false, func, or_, select
from sqlalchemy.sql.elements import ColumnElement

from server.core.access.services import AccessContext
from server.core.domain.repository import DomainRepository


class ClassbookRepository(DomainRepository):
    def has_lesson_conflict(self, data: dict[str, Any]) -> bool:
        entries = self.table("classbook_entries")
        return (
            self.db.execute(
                select(entries.c.id)
                .where(
                    or_(
                        entries.c.group_id == data["group_id"],
                        entries.c.actual_teacher_id == data["actual_teacher_id"],
                    ),
                    entries.c.starts_at < data["ends_at"].astimezone(UTC),
                    entries.c.ends_at > data["starts_at"].astimezone(UTC),
                )
                .limit(1)
            ).first()
            is not None
        )

    def students(self, actor: AccessContext) -> set[UUID]:
        if actor.school_role_code == "student":
            return {actor.user.id}
        if actor.school_role_code == "parent":
            return {
                row["student_id"]
                for row in self.rows("parent_students", parent_id=actor.user.id)
            }
        return set()

    def lesson_scope(self, actor: AccessContext) -> ColumnElement[bool]:
        entries = self.table("classbook_entries")
        if "classbook.manage" in actor.permissions:
            return entries.c.id.is_not(None)
        if actor.school_role_code == "teacher":
            return entries.c.actual_teacher_id == actor.user.id
        participants = self.table("classbook_participants")
        return and_(
            entries.c.status == "signed",
            exists(
                select(1).where(
                    participants.c.classbook_entry_id == entries.c.id,
                    participants.c.student_id.in_(self.students(actor)),
                )
            ),
        )

    def lessons(
        self,
        actor: AccessContext,
        offset: int,
        limit: int,
        date_from: date | None,
        date_to: date | None,
    ) -> list[dict[str, Any]]:
        entries = self.table("classbook_entries")
        query = select(entries).where(self.lesson_scope(actor))
        query = self.filter_dates(query, entries, date_from, date_to)
        return [
            dict(row)
            for row in self.db.execute(
                query.order_by(entries.c.starts_at, entries.c.id)
                .offset(offset)
                .limit(limit)
            ).mappings()
        ]

    def local_day(self, column: Any) -> Any:
        if self.db.get_bind().dialect.name == "postgresql":
            return cast(func.timezone("Europe/Prague", column), Date)
        return func.school_date(column)

    def filter_dates(
        self,
        query: Any,
        entries: Any,
        date_from: date | None,
        date_to: date | None,
    ) -> Any:
        day = self.local_day(entries.c.starts_at)
        if date_from is not None:
            query = query.where(day >= date_from)
        if date_to is not None:
            query = query.where(day < date_to)
        return query

    def attendance(
        self,
        student_id: UUID,
        offset: int,
        limit: int,
        date_from: date | None,
        date_to: date | None,
    ) -> list[dict[str, Any]]:
        records, entries = (
            self.table("attendance_records"),
            self.table("classbook_entries"),
        )
        query = (
            select(records)
            .join(entries, entries.c.id == records.c.classbook_entry_id)
            .where(records.c.student_id == student_id, entries.c.status == "signed")
        )
        query = self.filter_dates(query, entries, date_from, date_to)
        return [
            dict(row)
            for row in self.db.execute(
                query.order_by(entries.c.starts_at, records.c.id)
                .offset(offset)
                .limit(limit)
            ).mappings()
        ]

    def decision_scope(self, actor: AccessContext) -> ColumnElement[bool]:
        records = self.table("attendance_records")
        if "classbook.manage" in actor.permissions:
            return records.c.id.is_not(None)
        if actor.school_role_code != "teacher":
            return false()
        entries, groups = self.table("classbook_entries"), self.table("teaching_groups")
        classes, enrollments = self.table("classes"), self.table("class_enrollments")
        day = self.local_day(entries.c.starts_at)
        return exists(
            select(1)
            .select_from(
                entries.join(groups, groups.c.id == entries.c.group_id)
                .join(enrollments, enrollments.c.student_id == records.c.student_id)
                .join(classes, classes.c.id == enrollments.c.class_id)
            )
            .where(
                entries.c.id == records.c.classbook_entry_id,
                classes.c.class_teacher_id == actor.user.id,
                classes.c.school_year_id == groups.c.school_year_id,
                enrollments.c.valid_from <= day,
                or_(enrollments.c.valid_to.is_(None), day < enrollments.c.valid_to),
            )
            .correlate(records)
        )

    def can_decide(self, actor: AccessContext, record_id: UUID) -> bool:
        records = self.table("attendance_records")
        return (
            self.db.execute(
                select(records.c.id).where(
                    records.c.id == record_id, self.decision_scope(actor)
                )
            ).first()
            is not None
        )

    def requests(
        self,
        actor: AccessContext,
        offset: int,
        limit: int,
        *,
        inbox: bool = False,
        status: str | None = None,
    ) -> list[dict[str, Any]]:
        requests = self.table("absence_excuse_requests")
        query = select(requests)
        if inbox:
            items, records = (
                self.table("absence_excuse_items"),
                self.table("attendance_records"),
            )
            query = query.where(
                exists(
                    select(1)
                    .select_from(
                        items.join(
                            records, records.c.id == items.c.attendance_record_id
                        )
                    )
                    .where(
                        items.c.request_id == requests.c.id,
                        items.c.decision == "pending",
                        self.decision_scope(actor),
                    )
                ),
                requests.c.status == "open",
            )
        else:
            query = query.where(requests.c.requested_by == actor.user.id)
        if status is not None:
            query = query.where(requests.c.status == status)
        return [
            dict(row)
            for row in self.db.execute(
                query.order_by(requests.c.created_at, requests.c.id)
                .offset(offset)
                .limit(limit)
            ).mappings()
        ]
