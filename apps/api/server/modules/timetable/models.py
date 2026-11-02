"""ORM tables for the checked-in schema/bod.dbml."""

from datetime import date, datetime, time
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
    SmallInteger,
    String,
    Text,
    Time,
    UniqueConstraint,
    Uuid,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel

from server.core.domain.types import MondayCheck
from server.core.users.models import utcnow


class TeachingPlans(SQLModel, table=True):
    __tablename__: ClassVar[Any] = "teaching_plans"
    __table_args__ = (
        ForeignKeyConstraint(["school_year_id"], ["school_years.id"]),
        ForeignKeyConstraint(["created_by"], ["users.id"]),
        UniqueConstraint("school_year_id", "name"),
        CheckConstraint(
            MondayCheck("cycle_anchor_monday"),
            name="teaching_plans_cycle_anchor_monday",
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
    name: str = Field(sa_column=Column(String(150), nullable=False))
    cycle_anchor_monday: date = Field(sa_column=Column(Date, nullable=False))
    created_by: UUID = Field(sa_column=Column(Uuid, nullable=False))
    created_at: datetime = Field(
        default_factory=utcnow,
        sa_column=Column(
            DateTime(timezone=True), nullable=False, server_default=text("now()")
        ),
    )
    frozen_at: datetime | None = Field(
        default=None, sa_column=Column(DateTime(timezone=True), nullable=True)
    )


class TeachingAssignments(SQLModel, table=True):
    __tablename__: ClassVar[Any] = "teaching_assignments"
    __table_args__ = (
        ForeignKeyConstraint(["teaching_plan_id"], ["teaching_plans.id"]),
        ForeignKeyConstraint(["group_id"], ["teaching_groups.id"]),
        ForeignKeyConstraint(["subject_id"], ["subjects.id"]),
        ForeignKeyConstraint(["teacher_id"], ["users.id"]),
        ForeignKeyConstraint(["required_room_type_code"], ["room_types.code"]),
        UniqueConstraint("teaching_plan_id", "group_id", "subject_id", "teacher_id"),
        Index("ix_teaching_assignments_group_id", "group_id"),
        Index("ix_teaching_assignments_teacher_id", "teacher_id"),
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
    teaching_plan_id: UUID = Field(sa_column=Column(Uuid, nullable=False))
    group_id: UUID = Field(sa_column=Column(Uuid, nullable=False))
    subject_id: UUID = Field(sa_column=Column(Uuid, nullable=False))
    teacher_id: UUID = Field(sa_column=Column(Uuid, nullable=False))
    required_room_type_code: str | None = Field(
        default=None, sa_column=Column(String(50), nullable=True)
    )


class TeachingCycleWeeks(SQLModel, table=True):
    __tablename__: ClassVar[Any] = "teaching_cycle_weeks"
    __table_args__ = (
        ForeignKeyConstraint(["teaching_plan_id"], ["teaching_plans.id"]),
        UniqueConstraint("teaching_plan_id", "position"),
        UniqueConstraint("teaching_plan_id", "code"),
        UniqueConstraint("teaching_plan_id", "id"),
        CheckConstraint("position > 0", name="cycle_weeks_position_positive"),
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
    teaching_plan_id: UUID = Field(sa_column=Column(Uuid, nullable=False))
    position: int = Field(sa_column=Column(SmallInteger, nullable=False))
    code: str = Field(sa_column=Column(String(20), nullable=False))
    name: str | None = Field(default=None, sa_column=Column(String(100), nullable=True))


class TeachingCycleSteps(SQLModel, table=True):
    __tablename__: ClassVar[Any] = "teaching_cycle_steps"
    __table_args__ = (
        ForeignKeyConstraint(["teaching_plan_id"], ["teaching_plans.id"]),
        ForeignKeyConstraint(
            ["teaching_plan_id", "cycle_week_id"],
            ["teaching_cycle_weeks.teaching_plan_id", "teaching_cycle_weeks.id"],
        ),
        UniqueConstraint("teaching_plan_id", "position"),
        Index(
            "ix_teaching_cycle_steps_teaching_plan_id_cycle_week_id",
            "teaching_plan_id",
            "cycle_week_id",
        ),
        CheckConstraint("position > 0", name="cycle_steps_position_positive"),
        CheckConstraint("duration_weeks > 0", name="cycle_steps_duration_positive"),
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
    teaching_plan_id: UUID = Field(sa_column=Column(Uuid, nullable=False))
    position: int = Field(sa_column=Column(Integer, nullable=False))
    cycle_week_id: UUID = Field(sa_column=Column(Uuid, nullable=False))
    duration_weeks: int = Field(
        default=1, sa_column=Column(Integer, nullable=False, server_default=text("1"))
    )


class TeachingPlanCalendarWeeks(SQLModel, table=True):
    __tablename__: ClassVar[Any] = "teaching_plan_calendar_weeks"
    __table_args__ = (
        ForeignKeyConstraint(["teaching_plan_id"], ["teaching_plans.id"]),
        ForeignKeyConstraint(
            ["teaching_plan_id", "cycle_week_id"],
            ["teaching_cycle_weeks.teaching_plan_id", "teaching_cycle_weeks.id"],
        ),
        PrimaryKeyConstraint("teaching_plan_id", "week_starts_on"),
        Index("ix_teaching_plan_calendar_weeks_cycle_week_id", "cycle_week_id"),
        CheckConstraint(
            MondayCheck("week_starts_on"), name="calendar_weeks_start_monday"
        ),
    )
    teaching_plan_id: UUID = Field(sa_column=Column(Uuid, nullable=False))
    week_starts_on: date = Field(sa_column=Column(Date, nullable=False))
    cycle_week_id: UUID = Field(sa_column=Column(Uuid, nullable=False))
    is_override: bool = Field(
        default=False,
        sa_column=Column(Boolean, nullable=False, server_default=text("false")),
    )


class TeachingPlanCalendarDays(SQLModel, table=True):
    __tablename__: ClassVar[Any] = "teaching_plan_calendar_days"
    __table_args__ = (
        ForeignKeyConstraint(["teaching_plan_id"], ["teaching_plans.id"]),
        PrimaryKeyConstraint("teaching_plan_id", "calendar_date"),
    )
    teaching_plan_id: UUID = Field(sa_column=Column(Uuid, nullable=False))
    calendar_date: date = Field(sa_column=Column(Date, nullable=False))
    is_teaching_day: bool = Field(sa_column=Column(Boolean, nullable=False))
    reason: str | None = Field(default=None, sa_column=Column(Text, nullable=True))


class TeachingAssignmentWeeks(SQLModel, table=True):
    __tablename__: ClassVar[Any] = "teaching_assignment_weeks"
    __table_args__ = (
        ForeignKeyConstraint(["teaching_assignment_id"], ["teaching_assignments.id"]),
        ForeignKeyConstraint(["cycle_week_id"], ["teaching_cycle_weeks.id"]),
        PrimaryKeyConstraint("teaching_assignment_id", "cycle_week_id"),
        Index("ix_teaching_assignment_weeks_cycle_week_id", "cycle_week_id"),
        CheckConstraint("periods > 0", name="assignment_weeks_periods_positive"),
    )
    teaching_assignment_id: UUID = Field(sa_column=Column(Uuid, nullable=False))
    cycle_week_id: UUID = Field(sa_column=Column(Uuid, nullable=False))
    periods: int = Field(sa_column=Column(Integer, nullable=False))


class TeachingBlocks(SQLModel, table=True):
    __tablename__: ClassVar[Any] = "teaching_blocks"
    __table_args__ = (
        ForeignKeyConstraint(["cycle_week_id"], ["teaching_cycle_weeks.id"]),
        UniqueConstraint("cycle_week_id", "name"),
        UniqueConstraint("id", "cycle_week_id"),
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
    cycle_week_id: UUID = Field(sa_column=Column(Uuid, nullable=False))
    name: str = Field(sa_column=Column(String(100), nullable=False))


class TeachingBlockMembers(SQLModel, table=True):
    __tablename__: ClassVar[Any] = "teaching_block_members"
    __table_args__ = (
        ForeignKeyConstraint(
            ["block_id", "cycle_week_id"],
            ["teaching_blocks.id", "teaching_blocks.cycle_week_id"],
            ondelete="CASCADE",
        ),
        ForeignKeyConstraint(
            ["teaching_assignment_id", "cycle_week_id"],
            [
                "teaching_assignment_weeks.teaching_assignment_id",
                "teaching_assignment_weeks.cycle_week_id",
            ],
        ),
        PrimaryKeyConstraint("block_id", "teaching_assignment_id"),
        UniqueConstraint("teaching_assignment_id", "cycle_week_id"),
    )
    block_id: UUID = Field(sa_column=Column(Uuid, nullable=False))
    teaching_assignment_id: UUID = Field(sa_column=Column(Uuid, nullable=False))
    cycle_week_id: UUID = Field(sa_column=Column(Uuid, nullable=False))


class TeacherUnavailability(SQLModel, table=True):
    __tablename__: ClassVar[Any] = "teacher_unavailability"
    __table_args__ = (
        ForeignKeyConstraint(["teacher_id"], ["users.id"]),
        Index(
            "ix_teacher_unavailability_teacher_id_starts_at", "teacher_id", "starts_at"
        ),
        CheckConstraint(
            "starts_at < ends_at", name="teacher_unavailability_interval_valid"
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
    teacher_id: UUID = Field(sa_column=Column(Uuid, nullable=False))
    starts_at: datetime = Field(
        sa_column=Column(DateTime(timezone=True), nullable=False)
    )
    ends_at: datetime = Field(sa_column=Column(DateTime(timezone=True), nullable=False))
    reason: str | None = Field(default=None, sa_column=Column(Text, nullable=True))


class TimeGrids(SQLModel, table=True):
    __tablename__: ClassVar[Any] = "time_grids"
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
    name: str = Field(sa_column=Column(String(100), nullable=False))
    description: str | None = Field(default=None, sa_column=Column(Text, nullable=True))
    frozen_at: datetime | None = Field(
        default=None, sa_column=Column(DateTime(timezone=True), nullable=True)
    )


class TimeSlots(SQLModel, table=True):
    __tablename__: ClassVar[Any] = "time_slots"
    __table_args__ = (
        ForeignKeyConstraint(["time_grid_id"], ["time_grids.id"]),
        UniqueConstraint("time_grid_id", "position"),
        CheckConstraint("position > 0", name="time_slots_position_positive"),
        CheckConstraint("start_time < end_time", name="time_slots_interval_valid"),
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
    time_grid_id: UUID = Field(sa_column=Column(Uuid, nullable=False))
    position: int = Field(sa_column=Column(Integer, nullable=False))
    start_time: time = Field(sa_column=Column(Time, nullable=False))
    end_time: time = Field(sa_column=Column(Time, nullable=False))


class TimetableVersions(SQLModel, table=True):
    __tablename__: ClassVar[Any] = "timetable_versions"
    __table_args__ = (
        ForeignKeyConstraint(["teaching_plan_id"], ["teaching_plans.id"]),
        ForeignKeyConstraint(["time_grid_id"], ["time_grids.id"]),
        ForeignKeyConstraint(["distance_model_id"], ["room_distance_models.id"]),
        ForeignKeyConstraint(["based_on_version_id"], ["timetable_versions.id"]),
        ForeignKeyConstraint(["created_by"], ["users.id"]),
        Index(
            "ix_timetable_versions_teaching_plan_id_status",
            "teaching_plan_id",
            "status",
        ),
        Index("ix_timetable_versions_status_valid_from", "status", "valid_from"),
        CheckConstraint(
            "valid_to IS NULL OR (valid_from IS NOT NULL AND valid_from < valid_to)",
            name="timetable_versions_interval_valid",
        ),
        CheckConstraint(
            "status = 'draft' OR (valid_from IS NOT NULL AND published_at IS NOT NULL)",
            name="timetable_versions_publication_required",
        ),
        CheckConstraint(
            "based_on_version_id IS NULL OR based_on_version_id <> id",
            name="timetable_versions_no_self_base",
        ),
        CheckConstraint(
            "status IN ('draft', 'published', 'archived')",
            name="ck_timetable_versions_status",
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
    teaching_plan_id: UUID = Field(sa_column=Column(Uuid, nullable=False))
    time_grid_id: UUID = Field(sa_column=Column(Uuid, nullable=False))
    distance_model_id: UUID = Field(sa_column=Column(Uuid, nullable=False))
    name: str = Field(sa_column=Column(String(150), nullable=False))
    status: str = Field(
        default="draft",
        sa_column=Column(String(32), nullable=False, server_default=text("'draft'")),
    )
    based_on_version_id: UUID | None = Field(
        default=None, sa_column=Column(Uuid, nullable=True)
    )
    valid_from: date | None = Field(default=None, sa_column=Column(Date, nullable=True))
    valid_to: date | None = Field(default=None, sa_column=Column(Date, nullable=True))
    created_by: UUID = Field(sa_column=Column(Uuid, nullable=False))
    created_at: datetime = Field(
        default_factory=utcnow,
        sa_column=Column(
            DateTime(timezone=True), nullable=False, server_default=text("now()")
        ),
    )
    published_at: datetime | None = Field(
        default=None, sa_column=Column(DateTime(timezone=True), nullable=True)
    )


class TimetableEntries(SQLModel, table=True):
    __tablename__: ClassVar[Any] = "timetable_entries"
    __table_args__ = (
        ForeignKeyConstraint(["timetable_version_id"], ["timetable_versions.id"]),
        ForeignKeyConstraint(
            ["teaching_assignment_id", "cycle_week_id"],
            [
                "teaching_assignment_weeks.teaching_assignment_id",
                "teaching_assignment_weeks.cycle_week_id",
            ],
        ),
        ForeignKeyConstraint(["time_slot_id"], ["time_slots.id"]),
        ForeignKeyConstraint(["room_id"], ["rooms.id"]),
        Index(
            "ix_timetable_entries_timetable_version_id_cycle__c46aa60912",
            "timetable_version_id",
            "cycle_week_id",
            "day_of_week",
            "time_slot_id",
        ),
        Index(
            "ix_timetable_entries_timetable_version_id_cycle__6cbf3dcdb4",
            "timetable_version_id",
            "cycle_week_id",
            "room_id",
            "day_of_week",
            "time_slot_id",
        ),
        UniqueConstraint(
            "timetable_version_id",
            "teaching_assignment_id",
            "cycle_week_id",
            "day_of_week",
            "time_slot_id",
        ),
        Index("ix_timetable_entries_teaching_assignment_id", "teaching_assignment_id"),
        CheckConstraint(
            "day_of_week BETWEEN 1 AND 7", name="timetable_entries_weekday_valid"
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
    timetable_version_id: UUID = Field(sa_column=Column(Uuid, nullable=False))
    teaching_assignment_id: UUID = Field(sa_column=Column(Uuid, nullable=False))
    cycle_week_id: UUID = Field(sa_column=Column(Uuid, nullable=False))
    day_of_week: int = Field(sa_column=Column(SmallInteger, nullable=False))
    time_slot_id: UUID = Field(sa_column=Column(Uuid, nullable=False))
    room_id: UUID | None = Field(default=None, sa_column=Column(Uuid, nullable=True))
    is_locked: bool = Field(
        default=False,
        sa_column=Column(Boolean, nullable=False, server_default=text("false")),
    )


class TimetablePreferences(SQLModel, table=True):
    __tablename__: ClassVar[Any] = "timetable_preferences"
    __table_args__ = (
        ForeignKeyConstraint(["timetable_version_id"], ["timetable_versions.id"]),
        UniqueConstraint("timetable_version_id", "code"),
        CheckConstraint("weight >= 0", name="timetable_preferences_weight_nonnegative"),
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
    timetable_version_id: UUID = Field(sa_column=Column(Uuid, nullable=False))
    code: str = Field(sa_column=Column(String(100), nullable=False))
    weight: int = Field(sa_column=Column(Integer, nullable=False))
    parameters: dict[str, Any] | None = Field(
        default=None, sa_column=Column(JSONB, nullable=True)
    )


class LessonOccurrences(SQLModel, table=True):
    __tablename__: ClassVar[Any] = "lesson_occurrences"
    __table_args__ = (
        ForeignKeyConstraint(["timetable_entry_id"], ["timetable_entries.id"]),
        UniqueConstraint("timetable_entry_id", "scheduled_date"),
        Index("ix_lesson_occurrences_scheduled_date", "scheduled_date"),
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
    timetable_entry_id: UUID = Field(sa_column=Column(Uuid, nullable=False))
    scheduled_date: date = Field(sa_column=Column(Date, nullable=False))


class LessonChanges(SQLModel, table=True):
    __tablename__: ClassVar[Any] = "lesson_changes"
    __table_args__ = (
        ForeignKeyConstraint(["lesson_occurrence_id"], ["lesson_occurrences.id"]),
        ForeignKeyConstraint(["replacement_teacher_id"], ["users.id"]),
        ForeignKeyConstraint(["replacement_room_id"], ["rooms.id"]),
        ForeignKeyConstraint(["replacement_time_slot_id"], ["time_slots.id"]),
        ForeignKeyConstraint(["created_by"], ["users.id"]),
        ForeignKeyConstraint(["updated_by"], ["users.id"]),
        CheckConstraint(
            "room_changed OR replacement_room_id IS NULL",
            name="lesson_changes_room_override_valid",
        ),
        CheckConstraint(
            (
                "change_type <> 'cancelled' OR (replacement_teacher_id IS NULL "
                "AND NOT room_changed AND replacement_room_id IS NULL AND "
                "replacement_date IS NULL AND replacement_time_slot_id IS NULL)"
            ),
            name="lesson_changes_cancellation_valid",
        ),
        CheckConstraint(
            (
                "change_type <> 'modified' OR (replacement_teacher_id IS NOT NULL"
                " OR room_changed OR replacement_date IS NOT NULL OR "
                "replacement_time_slot_id IS NOT NULL)"
            ),
            name="lesson_changes_modification_nonempty",
        ),
        CheckConstraint(
            "change_type IN ('modified', 'cancelled')",
            name="ck_lesson_changes_change_type",
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
    lesson_occurrence_id: UUID = Field(
        sa_column=Column(Uuid, nullable=False, unique=True)
    )
    change_type: str = Field(sa_column=Column(String(32), nullable=False))
    replacement_teacher_id: UUID | None = Field(
        default=None, sa_column=Column(Uuid, nullable=True)
    )
    room_changed: bool = Field(
        default=False,
        sa_column=Column(Boolean, nullable=False, server_default=text("false")),
    )
    replacement_room_id: UUID | None = Field(
        default=None, sa_column=Column(Uuid, nullable=True)
    )
    replacement_date: date | None = Field(
        default=None, sa_column=Column(Date, nullable=True)
    )
    replacement_time_slot_id: UUID | None = Field(
        default=None, sa_column=Column(Uuid, nullable=True)
    )
    note: str | None = Field(default=None, sa_column=Column(Text, nullable=True))
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
