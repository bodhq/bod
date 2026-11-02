"""ORM tables for the checked-in schema/bod.dbml."""

from datetime import datetime
from typing import Any, ClassVar
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKeyConstraint,
    Index,
    Integer,
    PrimaryKeyConstraint,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    text,
)
from sqlmodel import Field, SQLModel

from server.core.users.models import utcnow


class ClassbookEntries(SQLModel, table=True):
    __tablename__: ClassVar[Any] = "classbook_entries"
    __table_args__ = (
        ForeignKeyConstraint(["lesson_occurrence_id"], ["lesson_occurrences.id"]),
        ForeignKeyConstraint(["group_id"], ["teaching_groups.id"]),
        ForeignKeyConstraint(["subject_id"], ["subjects.id"]),
        ForeignKeyConstraint(["actual_teacher_id"], ["users.id"]),
        ForeignKeyConstraint(["actual_room_id"], ["rooms.id"]),
        ForeignKeyConstraint(["signed_by"], ["users.id"]),
        ForeignKeyConstraint(["created_by"], ["users.id"]),
        ForeignKeyConstraint(["updated_by"], ["users.id"]),
        Index("ix_classbook_entries_group_id_starts_at", "group_id", "starts_at"),
        Index(
            "ix_classbook_entries_actual_teacher_id_starts_at",
            "actual_teacher_id",
            "starts_at",
        ),
        Index("ix_classbook_entries_starts_at", "starts_at"),
        CheckConstraint("starts_at < ends_at", name="classbook_entries_interval_valid"),
        CheckConstraint(
            (
                "(status = 'draft' AND signed_by IS NULL AND signed_at IS NULL) "
                "OR (status = 'signed' AND signed_by IS NOT NULL AND signed_at IS"
                " NOT NULL AND topic IS NOT NULL AND length(btrim(topic)) > 0)"
            ),
            name="classbook_entries_signature_valid",
        ),
        CheckConstraint(
            "status IN ('draft', 'signed')", name="ck_classbook_entries_status"
        ),
    )
    id: UUID = Field(
        default_factory=uuid4,
        sa_column=Column(
            Uuid,
            nullable=False,
            primary_key=True,
            server_default=text("gen_random_uuid()"),
        ),
    )
    lesson_occurrence_id: UUID | None = Field(
        default=None, sa_column=Column(Uuid, nullable=True, unique=True)
    )
    group_id: UUID = Field(sa_column=Column(Uuid, nullable=False))
    subject_id: UUID = Field(sa_column=Column(Uuid, nullable=False))
    actual_teacher_id: UUID = Field(sa_column=Column(Uuid, nullable=False))
    actual_room_id: UUID | None = Field(
        default=None, sa_column=Column(Uuid, nullable=True)
    )
    starts_at: datetime = Field(
        sa_column=Column(DateTime(timezone=True), nullable=False)
    )
    ends_at: datetime = Field(sa_column=Column(DateTime(timezone=True), nullable=False))
    topic: str | None = Field(default=None, sa_column=Column(Text, nullable=True))
    note: str | None = Field(default=None, sa_column=Column(Text, nullable=True))
    status: str = Field(
        default="draft",
        sa_column=Column(String(32), nullable=False, server_default=text("'draft'")),
    )
    signed_by: UUID | None = Field(default=None, sa_column=Column(Uuid, nullable=True))
    signed_at: datetime | None = Field(
        default=None, sa_column=Column(DateTime(timezone=True), nullable=True)
    )
    created_by: UUID = Field(sa_column=Column(Uuid, nullable=False))
    updated_by: UUID = Field(sa_column=Column(Uuid, nullable=False))
    created_at: datetime = Field(
        default_factory=utcnow,
        sa_column=Column(
            DateTime(timezone=True), nullable=False, server_default=text("now()")
        ),
    )
    updated_at: datetime = Field(
        default_factory=utcnow,
        sa_column=Column(
            DateTime(timezone=True), nullable=False, server_default=text("now()")
        ),
    )


class ClassbookParticipants(SQLModel, table=True):
    __tablename__: ClassVar[Any] = "classbook_participants"
    __table_args__ = (
        ForeignKeyConstraint(["classbook_entry_id"], ["classbook_entries.id"]),
        ForeignKeyConstraint(["student_id"], ["users.id"]),
        PrimaryKeyConstraint("classbook_entry_id", "student_id"),
        Index("ix_classbook_participants_student_id", "student_id"),
    )
    classbook_entry_id: UUID = Field(sa_column=Column(Uuid, nullable=False))
    student_id: UUID = Field(sa_column=Column(Uuid, nullable=False))


class AttendanceRecords(SQLModel, table=True):
    __tablename__: ClassVar[Any] = "attendance_records"
    __table_args__ = (
        ForeignKeyConstraint(
            ["classbook_entry_id", "student_id"],
            [
                "classbook_participants.classbook_entry_id",
                "classbook_participants.student_id",
            ],
        ),
        ForeignKeyConstraint(["excused_by"], ["users.id"]),
        ForeignKeyConstraint(["recorded_by"], ["users.id"]),
        UniqueConstraint("classbook_entry_id", "student_id"),
        Index("ix_attendance_records_student_id", "student_id"),
        CheckConstraint(
            "late_minutes IS NULL OR late_minutes >= 0",
            name="attendance_late_minutes_nonnegative",
        ),
        CheckConstraint(
            "missed_minutes IS NULL OR missed_minutes >= 0",
            name="attendance_missed_minutes_nonnegative",
        ),
        CheckConstraint(
            "status <> 'late' OR (late_minutes IS NOT NULL AND late_minutes > 0)",
            name="attendance_late_status_valid",
        ),
        CheckConstraint(
            "status = 'late' OR COALESCE(late_minutes, 0) = 0",
            name="attendance_nonlate_minutes_valid",
        ),
        CheckConstraint(
            "status <> 'present' OR COALESCE(missed_minutes, 0) = 0",
            name="attendance_present_minutes_valid",
        ),
        CheckConstraint(
            (
                "(is_excused AND status <> 'present' AND excused_by IS NOT NULL "
                "AND excused_at IS NOT NULL) OR (NOT is_excused AND excused_by IS"
                " NULL AND excused_at IS NULL)"
            ),
            name="attendance_excuse_valid",
        ),
        CheckConstraint(
            "status IN ('present', 'absent', 'late', 'released_early')",
            name="ck_attendance_records_status",
        ),
    )
    id: UUID = Field(
        default_factory=uuid4,
        sa_column=Column(
            Uuid,
            nullable=False,
            primary_key=True,
            server_default=text("gen_random_uuid()"),
        ),
    )
    classbook_entry_id: UUID = Field(sa_column=Column(Uuid, nullable=False))
    student_id: UUID = Field(sa_column=Column(Uuid, nullable=False))
    status: str = Field(sa_column=Column(String(32), nullable=False))
    late_minutes: int | None = Field(
        default=None, sa_column=Column(Integer, nullable=True)
    )
    missed_minutes: int | None = Field(
        default=None, sa_column=Column(Integer, nullable=True)
    )
    is_excused: bool = Field(
        default=False,
        sa_column=Column(Boolean, nullable=False, server_default=text("false")),
    )
    excuse_reason: str | None = Field(
        default=None, sa_column=Column(Text, nullable=True)
    )
    excused_by: UUID | None = Field(default=None, sa_column=Column(Uuid, nullable=True))
    excused_at: datetime | None = Field(
        default=None, sa_column=Column(DateTime(timezone=True), nullable=True)
    )
    note: str | None = Field(default=None, sa_column=Column(Text, nullable=True))
    recorded_by: UUID = Field(sa_column=Column(Uuid, nullable=False))
    recorded_at: datetime = Field(
        default_factory=utcnow,
        sa_column=Column(
            DateTime(timezone=True), nullable=False, server_default=text("now()")
        ),
    )
    updated_at: datetime = Field(
        default_factory=utcnow,
        sa_column=Column(
            DateTime(timezone=True), nullable=False, server_default=text("now()")
        ),
    )


class AbsenceExcuseRequests(SQLModel, table=True):
    __tablename__: ClassVar[Any] = "absence_excuse_requests"
    __table_args__ = (
        ForeignKeyConstraint(["student_id"], ["users.id"]),
        ForeignKeyConstraint(["requested_by"], ["users.id"]),
        Index(
            "ix_absence_excuse_requests_student_id_created_at",
            "student_id",
            "created_at",
        ),
        Index("ix_absence_excuse_requests_status", "status"),
        CheckConstraint(
            "length(btrim(reason)) > 0", name="excuse_requests_reason_nonempty"
        ),
        CheckConstraint(
            (
                "(status = 'open' AND closed_at IS NULL) OR (status <> 'open' AND"
                " closed_at IS NOT NULL)"
            ),
            name="excuse_requests_closure_valid",
        ),
        CheckConstraint(
            "status IN ('open', 'closed', 'withdrawn')",
            name="ck_absence_excuse_requests_status",
        ),
    )
    id: UUID = Field(
        default_factory=uuid4,
        sa_column=Column(
            Uuid,
            nullable=False,
            primary_key=True,
            server_default=text("gen_random_uuid()"),
        ),
    )
    student_id: UUID = Field(sa_column=Column(Uuid, nullable=False))
    requested_by: UUID = Field(sa_column=Column(Uuid, nullable=False))
    reason: str = Field(sa_column=Column(Text, nullable=False))
    status: str = Field(
        default="open",
        sa_column=Column(String(32), nullable=False, server_default=text("'open'")),
    )
    created_at: datetime = Field(
        default_factory=utcnow,
        sa_column=Column(
            DateTime(timezone=True), nullable=False, server_default=text("now()")
        ),
    )
    updated_at: datetime = Field(
        default_factory=utcnow,
        sa_column=Column(
            DateTime(timezone=True), nullable=False, server_default=text("now()")
        ),
    )
    closed_at: datetime | None = Field(
        default=None, sa_column=Column(DateTime(timezone=True), nullable=True)
    )


class AbsenceExcuseItems(SQLModel, table=True):
    __tablename__: ClassVar[Any] = "absence_excuse_items"
    __table_args__ = (
        ForeignKeyConstraint(["request_id"], ["absence_excuse_requests.id"]),
        ForeignKeyConstraint(["attendance_record_id"], ["attendance_records.id"]),
        ForeignKeyConstraint(["decided_by"], ["users.id"]),
        PrimaryKeyConstraint("request_id", "attendance_record_id"),
        Index("ix_absence_excuse_items_attendance_record_id", "attendance_record_id"),
        CheckConstraint(
            (
                "(decision = 'pending' AND decided_by IS NULL AND decided_at IS "
                "NULL) OR (decision <> 'pending' AND decided_by IS NOT NULL AND "
                "decided_at IS NOT NULL)"
            ),
            name="excuse_items_decision_valid",
        ),
        CheckConstraint(
            "decision IN ('pending', 'approved', 'rejected')",
            name="ck_absence_excuse_items_decision",
        ),
    )
    request_id: UUID = Field(sa_column=Column(Uuid, nullable=False))
    attendance_record_id: UUID = Field(sa_column=Column(Uuid, nullable=False))
    decision: str = Field(
        default="pending",
        sa_column=Column(String(32), nullable=False, server_default=text("'pending'")),
    )
    decision_note: str | None = Field(
        default=None, sa_column=Column(Text, nullable=True)
    )
    decided_by: UUID | None = Field(default=None, sa_column=Column(Uuid, nullable=True))
    decided_at: datetime | None = Field(
        default=None, sa_column=Column(DateTime(timezone=True), nullable=True)
    )
