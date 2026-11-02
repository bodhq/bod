"""Explicit request/response DTOs; ORM tables never serve as inputs."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import Field, StrictBool, StrictInt

from server.core.domain.schemas import DomainInput, DomainRead


class ClassbookEntriesCreate(DomainInput):
    lesson_occurrence_id: UUID | None = Field(default=None)
    group_id: UUID = Field(default=...)
    subject_id: UUID = Field(default=...)
    actual_teacher_id: UUID = Field(default=...)
    actual_room_id: UUID | None = Field(default=None)
    starts_at: datetime = Field(default=...)
    ends_at: datetime = Field(default=...)
    topic: str | None = Field(default=None)
    note: str | None = Field(default=None)
    status: Literal["draft", "signed"] = Field(default="draft")


class ClassbookEntriesPatch(DomainInput):
    lesson_occurrence_id: UUID | None = Field(default=None)
    group_id: UUID | None = Field(default=None)
    subject_id: UUID | None = Field(default=None)
    actual_teacher_id: UUID | None = Field(default=None)
    actual_room_id: UUID | None = Field(default=None)
    starts_at: datetime | None = Field(default=None)
    ends_at: datetime | None = Field(default=None)
    topic: str | None = Field(default=None)
    note: str | None = Field(default=None)
    status: Literal["draft", "signed"] | None = Field(default=None)


class ClassbookEntriesRead(DomainRead):
    id: UUID
    lesson_occurrence_id: UUID | None
    group_id: UUID
    subject_id: UUID
    actual_teacher_id: UUID
    actual_room_id: UUID | None
    starts_at: datetime
    ends_at: datetime
    topic: str | None
    note: str | None
    status: Literal["draft", "signed"]
    signed_by: UUID | None
    signed_at: datetime | None
    created_by: UUID
    updated_by: UUID
    created_at: datetime
    updated_at: datetime


class ClassbookParticipantsCreate(DomainInput):
    classbook_entry_id: UUID = Field(default=...)
    student_id: UUID = Field(default=...)


class ClassbookParticipantsPatch(DomainInput):
    pass


class ClassbookParticipantsRead(DomainRead):
    classbook_entry_id: UUID
    student_id: UUID


class AttendanceRecordsCreate(DomainInput):
    classbook_entry_id: UUID = Field(default=...)
    student_id: UUID = Field(default=...)
    status: Literal["present", "absent", "late", "released_early"] = Field(default=...)
    late_minutes: StrictInt | None = Field(default=None)
    missed_minutes: StrictInt | None = Field(default=None)
    note: str | None = Field(default=None)


class AttendanceRecordsPatch(DomainInput):
    classbook_entry_id: UUID | None = Field(default=None)
    student_id: UUID | None = Field(default=None)
    status: Literal["present", "absent", "late", "released_early"] | None = Field(
        default=None
    )
    late_minutes: StrictInt | None = Field(default=None)
    missed_minutes: StrictInt | None = Field(default=None)
    note: str | None = Field(default=None)


class AttendanceRecordsRead(DomainRead):
    id: UUID
    classbook_entry_id: UUID
    student_id: UUID
    status: Literal["present", "absent", "late", "released_early"]
    late_minutes: StrictInt | None
    missed_minutes: StrictInt | None
    is_excused: StrictBool
    excuse_reason: str | None
    excused_by: UUID | None
    excused_at: datetime | None
    note: str | None
    recorded_by: UUID
    recorded_at: datetime
    updated_at: datetime


class AbsenceExcuseRequestsCreate(DomainInput):
    student_id: UUID = Field(default=...)
    requested_by: UUID = Field(default=...)
    reason: str = Field(default=..., min_length=1)
    status: Literal["open", "closed", "withdrawn"] = Field(default="open")


class AbsenceExcuseRequestsPatch(DomainInput):
    student_id: UUID | None = Field(default=None)
    requested_by: UUID | None = Field(default=None)
    reason: str | None = Field(default=None, min_length=1)
    status: Literal["open", "closed", "withdrawn"] | None = Field(default=None)


class AbsenceExcuseRequestsRead(DomainRead):
    id: UUID
    student_id: UUID
    requested_by: UUID
    reason: str
    status: Literal["open", "closed", "withdrawn"]
    created_at: datetime
    updated_at: datetime
    closed_at: datetime | None


class AbsenceExcuseItemsCreate(DomainInput):
    request_id: UUID = Field(default=...)
    attendance_record_id: UUID = Field(default=...)
    decision_note: str | None = Field(default=None)


class AbsenceExcuseItemsPatch(DomainInput):
    decision_note: str | None = Field(default=None)


class AbsenceExcuseItemsRead(DomainRead):
    request_id: UUID
    attendance_record_id: UUID
    decision: Literal["pending", "approved", "rejected"]
    decision_note: str | None
    decided_by: UUID | None
    decided_at: datetime | None
