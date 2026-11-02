"""ORM tables for the checked-in schema/bod.dbml."""

from datetime import date, datetime
from typing import Any, ClassVar
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    Date,
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


class SchoolYears(SQLModel, table=True):
    __tablename__: ClassVar[Any] = "school_years"
    __table_args__ = (
        CheckConstraint("starts_on < ends_on", name="school_years_interval_valid"),
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
    name: str = Field(sa_column=Column(String(20), nullable=False, unique=True))
    starts_on: date = Field(sa_column=Column(Date, nullable=False))
    ends_on: date = Field(sa_column=Column(Date, nullable=False))


class Specializations(SQLModel, table=True):
    __tablename__: ClassVar[Any] = "specializations"
    __table_args__ = ()
    id: UUID = Field(
        default_factory=uuid4,
        sa_column=Column(
            Uuid,
            nullable=False,
            primary_key=True,
            server_default=text("gen_random_uuid()"),
        ),
    )
    code: str = Field(sa_column=Column(String(30), nullable=False, unique=True))
    name: str = Field(sa_column=Column(String(100), nullable=False))
    is_active: bool = Field(
        default=True,
        sa_column=Column(Boolean, nullable=False, server_default=text("true")),
    )


class Classes(SQLModel, table=True):
    __tablename__: ClassVar[Any] = "classes"
    __table_args__ = (
        ForeignKeyConstraint(["school_year_id"], ["school_years.id"]),
        ForeignKeyConstraint(["class_teacher_id"], ["users.id"]),
        UniqueConstraint("school_year_id", "name"),
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
    school_year_id: UUID = Field(sa_column=Column(Uuid, nullable=False))
    name: str = Field(sa_column=Column(String(30), nullable=False))
    class_teacher_id: UUID | None = Field(
        default=None, sa_column=Column(Uuid, nullable=True)
    )


class ClassEnrollments(SQLModel, table=True):
    __tablename__: ClassVar[Any] = "class_enrollments"
    __table_args__ = (
        ForeignKeyConstraint(["student_id"], ["users.id"]),
        ForeignKeyConstraint(["class_id"], ["classes.id"]),
        ForeignKeyConstraint(["specialization_id"], ["specializations.id"]),
        UniqueConstraint("student_id", "class_id", "valid_from"),
        Index("ix_class_enrollments_class_id_valid_from", "class_id", "valid_from"),
        CheckConstraint(
            "valid_to IS NULL OR valid_from < valid_to",
            name="class_enrollments_interval_valid",
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
    class_id: UUID = Field(sa_column=Column(Uuid, nullable=False))
    specialization_id: UUID | None = Field(
        default=None, sa_column=Column(Uuid, nullable=True)
    )
    valid_from: date = Field(sa_column=Column(Date, nullable=False))
    valid_to: date | None = Field(default=None, sa_column=Column(Date, nullable=True))


class ParentStudents(SQLModel, table=True):
    __tablename__: ClassVar[Any] = "parent_students"
    __table_args__ = (
        ForeignKeyConstraint(["parent_id"], ["users.id"]),
        ForeignKeyConstraint(["student_id"], ["users.id"]),
        PrimaryKeyConstraint("parent_id", "student_id"),
        Index("ix_parent_students_student_id", "student_id"),
        CheckConstraint(
            "parent_id <> student_id", name="parent_students_distinct_users"
        ),
    )
    parent_id: UUID = Field(sa_column=Column(Uuid, nullable=False))
    student_id: UUID = Field(sa_column=Column(Uuid, nullable=False))


class Subjects(SQLModel, table=True):
    __tablename__: ClassVar[Any] = "subjects"
    __table_args__ = ()
    id: UUID = Field(
        default_factory=uuid4,
        sa_column=Column(
            Uuid,
            nullable=False,
            primary_key=True,
            server_default=text("gen_random_uuid()"),
        ),
    )
    code: str = Field(sa_column=Column(String(20), nullable=False, unique=True))
    name: str = Field(sa_column=Column(String(100), nullable=False))


class GroupDivisions(SQLModel, table=True):
    __tablename__: ClassVar[Any] = "group_divisions"
    __table_args__ = (
        ForeignKeyConstraint(["class_id"], ["classes.id"]),
        ForeignKeyConstraint(["created_by"], ["users.id"]),
        UniqueConstraint("class_id", "name"),
        CheckConstraint(
            "method IN ('alphabetical', 'specialization', 'manual')",
            name="ck_group_divisions_method",
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
    class_id: UUID = Field(sa_column=Column(Uuid, nullable=False))
    name: str = Field(sa_column=Column(String(100), nullable=False))
    method: str = Field(sa_column=Column(String(32), nullable=False))
    effective_from: date = Field(sa_column=Column(Date, nullable=False))
    created_by: UUID = Field(sa_column=Column(Uuid, nullable=False))
    created_at: datetime = Field(
        default_factory=utcnow,
        sa_column=Column(
            DateTime(timezone=True), nullable=False, server_default=text("now()")
        ),
    )


class TeachingGroups(SQLModel, table=True):
    __tablename__: ClassVar[Any] = "teaching_groups"
    __table_args__ = (
        ForeignKeyConstraint(["school_year_id"], ["school_years.id"]),
        ForeignKeyConstraint(["source_class_id"], ["classes.id"]),
        ForeignKeyConstraint(["division_id"], ["group_divisions.id"]),
        UniqueConstraint("school_year_id", "name"),
        UniqueConstraint("division_id", "position"),
        CheckConstraint(
            (
                "(membership_mode = 'class_enrollment' AND source_class_id IS NOT"
                " NULL AND division_id IS NULL) OR (membership_mode = 'explicit' "
                "AND source_class_id IS NULL)"
            ),
            name="teaching_groups_membership_source_valid",
        ),
        CheckConstraint(
            (
                "(division_id IS NULL AND position IS NULL) OR (division_id IS "
                "NOT NULL AND position IS NOT NULL AND position > 0)"
            ),
            name="teaching_groups_division_position_valid",
        ),
        CheckConstraint(
            "membership_mode IN ('class_enrollment', 'explicit')",
            name="ck_teaching_groups_membership_mode",
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
    school_year_id: UUID = Field(sa_column=Column(Uuid, nullable=False))
    name: str = Field(sa_column=Column(String(100), nullable=False))
    description: str | None = Field(default=None, sa_column=Column(Text, nullable=True))
    membership_mode: str = Field(sa_column=Column(String(32), nullable=False))
    source_class_id: UUID | None = Field(
        default=None, sa_column=Column(Uuid, nullable=True, unique=True)
    )
    division_id: UUID | None = Field(
        default=None, sa_column=Column(Uuid, nullable=True)
    )
    position: int | None = Field(default=None, sa_column=Column(Integer, nullable=True))


class TeachingGroupMemberships(SQLModel, table=True):
    __tablename__: ClassVar[Any] = "teaching_group_memberships"
    __table_args__ = (
        ForeignKeyConstraint(["group_id"], ["teaching_groups.id"]),
        ForeignKeyConstraint(["student_id"], ["users.id"]),
        ForeignKeyConstraint(["created_by"], ["users.id"]),
        UniqueConstraint("group_id", "student_id", "valid_from"),
        Index(
            "ix_teaching_group_memberships_student_id_valid_from",
            "student_id",
            "valid_from",
        ),
        CheckConstraint(
            "valid_to IS NULL OR valid_from < valid_to",
            name="group_memberships_interval_valid",
        ),
        CheckConstraint(
            "origin IN ('generated', 'manual')",
            name="ck_teaching_group_memberships_origin",
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
    group_id: UUID = Field(sa_column=Column(Uuid, nullable=False))
    student_id: UUID = Field(sa_column=Column(Uuid, nullable=False))
    valid_from: date = Field(sa_column=Column(Date, nullable=False))
    valid_to: date | None = Field(default=None, sa_column=Column(Date, nullable=True))
    origin: str = Field(sa_column=Column(String(32), nullable=False))
    created_by: UUID | None = Field(default=None, sa_column=Column(Uuid, nullable=True))
    created_at: datetime = Field(
        default_factory=utcnow,
        sa_column=Column(
            DateTime(timezone=True), nullable=False, server_default=text("now()")
        ),
    )


class GroupSpecializationRules(SQLModel, table=True):
    __tablename__: ClassVar[Any] = "group_specialization_rules"
    __table_args__ = (
        ForeignKeyConstraint(["group_id"], ["teaching_groups.id"]),
        ForeignKeyConstraint(["specialization_id"], ["specializations.id"]),
        PrimaryKeyConstraint("group_id", "specialization_id"),
    )
    group_id: UUID = Field(sa_column=Column(Uuid, nullable=False))
    specialization_id: UUID = Field(sa_column=Column(Uuid, nullable=False))
