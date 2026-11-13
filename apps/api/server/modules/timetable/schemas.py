"""Explicit request/response DTOs; ORM tables never serve as inputs."""

from datetime import date, datetime, time
from typing import Any, Literal
from uuid import UUID

from pydantic import Field, StrictBool, StrictInt

from server.core.domain.router import Pagination
from server.core.domain.schemas import DomainInput, DomainRead


class TeachingPlansCreate(DomainInput):
    school_year_id: UUID = Field(default=...)
    name: str = Field(default=..., max_length=150, min_length=1)
    cycle_anchor_monday: date = Field(default=...)


class TeachingPlansPatch(DomainInput):
    school_year_id: UUID | None = Field(default=None)
    name: str | None = Field(default=None, max_length=150, min_length=1)
    cycle_anchor_monday: date | None = Field(default=None)


class TeachingPlansRead(DomainRead):
    id: UUID
    school_year_id: UUID
    name: str
    cycle_anchor_monday: date
    created_by: UUID
    created_at: datetime
    frozen_at: datetime | None


class TeachingAssignmentsCreate(DomainInput):
    teaching_plan_id: UUID = Field(default=...)
    group_id: UUID = Field(default=...)
    subject_id: UUID = Field(default=...)
    teacher_id: UUID = Field(default=...)
    required_room_type_code: str | None = Field(default=None, max_length=50)


class TeachingAssignmentsPatch(DomainInput):
    teaching_plan_id: UUID | None = Field(default=None)
    group_id: UUID | None = Field(default=None)
    subject_id: UUID | None = Field(default=None)
    teacher_id: UUID | None = Field(default=None)
    required_room_type_code: str | None = Field(default=None, max_length=50)


class TeachingAssignmentsRead(DomainRead):
    id: UUID
    teaching_plan_id: UUID
    group_id: UUID
    subject_id: UUID
    teacher_id: UUID
    required_room_type_code: str | None


class TeachingCycleWeeksCreate(DomainInput):
    teaching_plan_id: UUID = Field(default=...)
    position: StrictInt = Field(default=...)
    code: str = Field(default=..., max_length=20, min_length=1)
    name: str | None = Field(default=None, max_length=100)


class TeachingCycleWeeksPatch(DomainInput):
    teaching_plan_id: UUID | None = Field(default=None)
    position: StrictInt | None = Field(default=None)
    code: str | None = Field(default=None, max_length=20, min_length=1)
    name: str | None = Field(default=None, max_length=100)


class TeachingCycleWeeksRead(DomainRead):
    id: UUID
    teaching_plan_id: UUID
    position: StrictInt
    code: str
    name: str | None


class TeachingCycleStepsCreate(DomainInput):
    teaching_plan_id: UUID = Field(default=...)
    position: StrictInt = Field(default=...)
    cycle_week_id: UUID = Field(default=...)
    duration_weeks: StrictInt = Field(default=1)


class TeachingCycleStepsPatch(DomainInput):
    teaching_plan_id: UUID | None = Field(default=None)
    position: StrictInt | None = Field(default=None)
    cycle_week_id: UUID | None = Field(default=None)
    duration_weeks: StrictInt | None = Field(default=None)


class TeachingCycleStepsRead(DomainRead):
    id: UUID
    teaching_plan_id: UUID
    position: StrictInt
    cycle_week_id: UUID
    duration_weeks: StrictInt


class TeachingPlanCalendarWeeksCreate(DomainInput):
    teaching_plan_id: UUID = Field(default=...)
    week_starts_on: date = Field(default=...)
    cycle_week_id: UUID = Field(default=...)
    is_override: StrictBool = Field(default=False)


class TeachingPlanCalendarWeeksPatch(DomainInput):
    cycle_week_id: UUID | None = Field(default=None)
    is_override: StrictBool | None = Field(default=None)


class TeachingPlanCalendarWeeksRead(DomainRead):
    teaching_plan_id: UUID
    week_starts_on: date
    cycle_week_id: UUID
    is_override: StrictBool


class TeachingPlanCalendarDaysCreate(DomainInput):
    teaching_plan_id: UUID = Field(default=...)
    calendar_date: date = Field(default=...)
    is_teaching_day: StrictBool = Field(default=...)
    reason: str | None = Field(default=None)


class TeachingPlanCalendarDaysPatch(DomainInput):
    is_teaching_day: StrictBool | None = Field(default=None)
    reason: str | None = Field(default=None)


class TeachingPlanCalendarDaysRead(DomainRead):
    teaching_plan_id: UUID
    calendar_date: date
    is_teaching_day: StrictBool
    reason: str | None


class TeachingAssignmentWeeksCreate(DomainInput):
    teaching_assignment_id: UUID = Field(default=...)
    cycle_week_id: UUID = Field(default=...)
    periods: StrictInt = Field(default=...)


class TeachingAssignmentWeeksPatch(DomainInput):
    periods: StrictInt | None = Field(default=None)


class TeachingAssignmentWeeksRead(DomainRead):
    teaching_assignment_id: UUID
    cycle_week_id: UUID
    periods: StrictInt


class TeachingBlocksCreate(DomainInput):
    cycle_week_id: UUID = Field(default=...)
    name: str = Field(default=..., max_length=100, min_length=1)


class TeachingBlocksPatch(DomainInput):
    cycle_week_id: UUID | None = Field(default=None)
    name: str | None = Field(default=None, max_length=100, min_length=1)


class TeachingBlocksRead(DomainRead):
    id: UUID
    cycle_week_id: UUID
    name: str


class TeachingBlockMembersCreate(DomainInput):
    block_id: UUID = Field(default=...)
    teaching_assignment_id: UUID = Field(default=...)
    cycle_week_id: UUID = Field(default=...)


class TeachingBlockMembersPatch(DomainInput):
    cycle_week_id: UUID | None = Field(default=None)


class TeachingBlockMembersRead(DomainRead):
    block_id: UUID
    teaching_assignment_id: UUID
    cycle_week_id: UUID


class TeacherUnavailabilityCreate(DomainInput):
    teacher_id: UUID = Field(default=...)
    starts_at: datetime = Field(default=...)
    ends_at: datetime = Field(default=...)
    reason: str | None = Field(default=None)


class TeacherUnavailabilityPatch(DomainInput):
    teacher_id: UUID | None = Field(default=None)
    starts_at: datetime | None = Field(default=None)
    ends_at: datetime | None = Field(default=None)
    reason: str | None = Field(default=None)


class TeacherUnavailabilityRead(DomainRead):
    id: UUID
    teacher_id: UUID
    starts_at: datetime
    ends_at: datetime
    reason: str | None


class TimeGridsCreate(DomainInput):
    name: str = Field(default=..., max_length=100, min_length=1)
    description: str | None = Field(default=None)


class TimeGridsPatch(DomainInput):
    name: str | None = Field(default=None, max_length=100, min_length=1)
    description: str | None = Field(default=None)


class TimeGridsRead(DomainRead):
    id: UUID
    name: str
    description: str | None
    frozen_at: datetime | None


class TimeSlotsCreate(DomainInput):
    time_grid_id: UUID = Field(default=...)
    position: StrictInt = Field(default=...)
    start_time: time = Field(default=...)
    end_time: time = Field(default=...)


class TimeSlotsPatch(DomainInput):
    time_grid_id: UUID | None = Field(default=None)
    position: StrictInt | None = Field(default=None)
    start_time: time | None = Field(default=None)
    end_time: time | None = Field(default=None)


class TimeSlotsRead(DomainRead):
    id: UUID
    time_grid_id: UUID
    position: StrictInt
    start_time: time
    end_time: time


class TimetableVersionsCreate(DomainInput):
    teaching_plan_id: UUID = Field(default=...)
    time_grid_id: UUID = Field(default=...)
    distance_model_id: UUID = Field(default=...)
    name: str = Field(default=..., max_length=150, min_length=1)
    status: Literal["draft", "published", "archived"] = Field(default="draft")
    based_on_version_id: UUID | None = Field(default=None)
    valid_from: date | None = Field(default=None)
    valid_to: date | None = Field(default=None)


class TimetableVersionsPatch(DomainInput):
    teaching_plan_id: UUID | None = Field(default=None)
    time_grid_id: UUID | None = Field(default=None)
    distance_model_id: UUID | None = Field(default=None)
    name: str | None = Field(default=None, max_length=150, min_length=1)
    status: Literal["draft", "published", "archived"] | None = Field(default=None)
    based_on_version_id: UUID | None = Field(default=None)
    valid_from: date | None = Field(default=None)
    valid_to: date | None = Field(default=None)


class TimetableVersionsRead(DomainRead):
    id: UUID
    teaching_plan_id: UUID
    time_grid_id: UUID
    distance_model_id: UUID
    name: str
    status: Literal["draft", "published", "archived"]
    based_on_version_id: UUID | None
    valid_from: date | None
    valid_to: date | None
    created_by: UUID
    created_at: datetime
    published_at: datetime | None


class TimetableEntriesCreate(DomainInput):
    timetable_version_id: UUID = Field(default=...)
    teaching_assignment_id: UUID = Field(default=...)
    cycle_week_id: UUID = Field(default=...)
    day_of_week: StrictInt = Field(default=...)
    time_slot_id: UUID = Field(default=...)
    room_id: UUID | None = Field(default=None)
    is_locked: StrictBool = Field(default=False)


class TimetableEntryState(TimetableEntriesCreate):
    id: UUID


class TimetableEntriesPatch(DomainInput):
    expected_state: TimetableEntryState | None = Field(
        default=None,
        description="Úplný naposledy načtený stav položky pro ochranu souběhu.",
    )
    timetable_version_id: UUID | None = Field(default=None)
    teaching_assignment_id: UUID | None = Field(default=None)
    cycle_week_id: UUID | None = Field(default=None)
    day_of_week: StrictInt | None = Field(default=None)
    time_slot_id: UUID | None = Field(default=None)
    room_id: UUID | None = Field(default=None)
    is_locked: StrictBool | None = Field(default=None)


class TimetableEntriesRead(DomainRead):
    id: UUID
    timetable_version_id: UUID
    teaching_assignment_id: UUID
    cycle_week_id: UUID
    day_of_week: StrictInt
    time_slot_id: UUID
    room_id: UUID | None
    is_locked: StrictBool


class TimetablePreferencesCreate(DomainInput):
    timetable_version_id: UUID = Field(default=...)
    code: str = Field(default=..., max_length=100, min_length=1)
    weight: StrictInt = Field(default=...)
    parameters: dict[str, Any] | None = Field(default=None)


class TimetablePreferencesPatch(DomainInput):
    timetable_version_id: UUID | None = Field(default=None)
    code: str | None = Field(default=None, max_length=100, min_length=1)
    weight: StrictInt | None = Field(default=None)
    parameters: dict[str, Any] | None = Field(default=None)


class TimetablePreferencesRead(DomainRead):
    id: UUID
    timetable_version_id: UUID
    code: str
    weight: StrictInt
    parameters: dict[str, Any] | None


class LessonOccurrencesCreate(DomainInput):
    timetable_entry_id: UUID = Field(default=...)
    scheduled_date: date = Field(default=...)


class LessonOccurrencesPatch(DomainInput):
    timetable_entry_id: UUID | None = Field(default=None)
    scheduled_date: date | None = Field(default=None)


class LessonOccurrencesRead(DomainRead):
    id: UUID
    timetable_entry_id: UUID
    scheduled_date: date


class LessonChangesCreate(DomainInput):
    lesson_occurrence_id: UUID = Field(default=...)
    change_type: Literal["modified", "cancelled"] = Field(default=...)
    replacement_teacher_id: UUID | None = Field(default=None)
    room_changed: StrictBool = Field(default=False)
    replacement_room_id: UUID | None = Field(default=None)
    replacement_date: date | None = Field(default=None)
    replacement_time_slot_id: UUID | None = Field(default=None)
    note: str | None = Field(default=None)


class LessonChangesPatch(DomainInput):
    lesson_occurrence_id: UUID | None = Field(default=None)
    change_type: Literal["modified", "cancelled"] | None = Field(default=None)
    replacement_teacher_id: UUID | None = Field(default=None)
    room_changed: StrictBool | None = Field(default=None)
    replacement_room_id: UUID | None = Field(default=None)
    replacement_date: date | None = Field(default=None)
    replacement_time_slot_id: UUID | None = Field(default=None)
    note: str | None = Field(default=None)


class LessonChangesRead(DomainRead):
    id: UUID
    lesson_occurrence_id: UUID
    change_type: Literal["modified", "cancelled"]
    replacement_teacher_id: UUID | None
    room_changed: StrictBool
    replacement_room_id: UUID | None
    replacement_date: date | None
    replacement_time_slot_id: UUID | None
    note: str | None
    created_by: UUID
    updated_by: UUID
    created_at: datetime
    updated_at: datetime


class TeachingPlansFilter(Pagination):
    school_year_id: UUID | None = None


class TeachingAssignmentsFilter(Pagination):
    teaching_plan_id: UUID | None = None
    group_id: UUID | None = None
    teacher_id: UUID | None = None


class TimetableVersionsFilter(Pagination):
    teaching_plan_id: UUID | None = None
    status: Literal["draft", "published", "archived"] | None = None


class TimetableEntriesFilter(Pagination):
    timetable_version_id: UUID | None = None
    cycle_week_id: UUID | None = None


class TimeSlotsFilter(Pagination):
    time_grid_id: UUID | None = None


class TeachingCycleWeeksFilter(Pagination):
    teaching_plan_id: UUID | None = None


class TeachingAssignmentWeeksFilter(Pagination):
    teaching_assignment_id: UUID | None = None
