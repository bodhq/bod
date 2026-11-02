"""Explicit request/response DTOs; ORM tables never serve as inputs."""

from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import Field, StrictBool, StrictInt

from server.core.domain.schemas import DomainInput, DomainRead


class SchoolYearsCreate(DomainInput):
    name: str = Field(default=..., max_length=20, min_length=1)
    starts_on: date = Field(default=...)
    ends_on: date = Field(default=...)


class SchoolYearsPatch(DomainInput):
    name: str | None = Field(default=None, max_length=20, min_length=1)
    starts_on: date | None = Field(default=None)
    ends_on: date | None = Field(default=None)


class SchoolYearsRead(DomainRead):
    id: UUID
    name: str
    starts_on: date
    ends_on: date


class SpecializationsCreate(DomainInput):
    code: str = Field(default=..., max_length=30, min_length=1)
    name: str = Field(default=..., max_length=100, min_length=1)
    is_active: StrictBool = Field(default=True)


class SpecializationsPatch(DomainInput):
    code: str | None = Field(default=None, max_length=30, min_length=1)
    name: str | None = Field(default=None, max_length=100, min_length=1)
    is_active: StrictBool | None = Field(default=None)


class SpecializationsRead(DomainRead):
    id: UUID
    code: str
    name: str
    is_active: StrictBool


class ClassesCreate(DomainInput):
    school_year_id: UUID = Field(default=...)
    name: str = Field(default=..., max_length=30, min_length=1)
    class_teacher_id: UUID | None = Field(default=None)


class ClassesPatch(DomainInput):
    school_year_id: UUID | None = Field(default=None)
    name: str | None = Field(default=None, max_length=30, min_length=1)
    class_teacher_id: UUID | None = Field(default=None)


class ClassesRead(DomainRead):
    id: UUID
    school_year_id: UUID
    name: str
    class_teacher_id: UUID | None


class ClassEnrollmentsCreate(DomainInput):
    student_id: UUID = Field(default=...)
    class_id: UUID = Field(default=...)
    specialization_id: UUID | None = Field(default=None)
    valid_from: date = Field(default=...)
    valid_to: date | None = Field(default=None)


class ClassEnrollmentsPatch(DomainInput):
    student_id: UUID | None = Field(default=None)
    class_id: UUID | None = Field(default=None)
    specialization_id: UUID | None = Field(default=None)
    valid_from: date | None = Field(default=None)
    valid_to: date | None = Field(default=None)


class ClassEnrollmentsRead(DomainRead):
    id: UUID
    student_id: UUID
    class_id: UUID
    specialization_id: UUID | None
    valid_from: date
    valid_to: date | None


class ParentStudentsCreate(DomainInput):
    parent_id: UUID = Field(default=...)
    student_id: UUID = Field(default=...)


class ParentStudentsPatch(DomainInput):
    pass


class ParentStudentsRead(DomainRead):
    parent_id: UUID
    student_id: UUID


class SubjectsCreate(DomainInput):
    code: str = Field(default=..., max_length=20, min_length=1)
    name: str = Field(default=..., max_length=100, min_length=1)


class SubjectsPatch(DomainInput):
    code: str | None = Field(default=None, max_length=20, min_length=1)
    name: str | None = Field(default=None, max_length=100, min_length=1)


class SubjectsRead(DomainRead):
    id: UUID
    code: str
    name: str


class GroupDivisionsCreate(DomainInput):
    class_id: UUID = Field(default=...)
    name: str = Field(default=..., max_length=100, min_length=1)
    method: Literal["alphabetical", "specialization", "manual"] = Field(default=...)
    effective_from: date = Field(default=...)


class GroupDivisionsPatch(DomainInput):
    class_id: UUID | None = Field(default=None)
    name: str | None = Field(default=None, max_length=100, min_length=1)
    method: Literal["alphabetical", "specialization", "manual"] | None = Field(
        default=None
    )
    effective_from: date | None = Field(default=None)


class GroupDivisionsRead(DomainRead):
    id: UUID
    class_id: UUID
    name: str
    method: Literal["alphabetical", "specialization", "manual"]
    effective_from: date
    created_by: UUID
    created_at: datetime


class TeachingGroupsCreate(DomainInput):
    school_year_id: UUID = Field(default=...)
    name: str = Field(default=..., max_length=100, min_length=1)
    description: str | None = Field(default=None)
    membership_mode: Literal["class_enrollment", "explicit"] = Field(default=...)
    source_class_id: UUID | None = Field(default=None)
    division_id: UUID | None = Field(default=None)
    position: StrictInt | None = Field(default=None)


class TeachingGroupsPatch(DomainInput):
    school_year_id: UUID | None = Field(default=None)
    name: str | None = Field(default=None, max_length=100, min_length=1)
    description: str | None = Field(default=None)
    membership_mode: Literal["class_enrollment", "explicit"] | None = Field(
        default=None
    )
    source_class_id: UUID | None = Field(default=None)
    division_id: UUID | None = Field(default=None)
    position: StrictInt | None = Field(default=None)


class TeachingGroupsRead(DomainRead):
    id: UUID
    school_year_id: UUID
    name: str
    description: str | None
    membership_mode: Literal["class_enrollment", "explicit"]
    source_class_id: UUID | None
    division_id: UUID | None
    position: StrictInt | None


class TeachingGroupMembershipsCreate(DomainInput):
    group_id: UUID = Field(default=...)
    student_id: UUID = Field(default=...)
    valid_from: date = Field(default=...)
    valid_to: date | None = Field(default=None)
    origin: Literal["generated", "manual"] = Field(default="manual")


class TeachingGroupMembershipsPatch(DomainInput):
    group_id: UUID | None = Field(default=None)
    student_id: UUID | None = Field(default=None)
    valid_from: date | None = Field(default=None)
    valid_to: date | None = Field(default=None)
    origin: Literal["generated", "manual"] | None = Field(default=None)


class TeachingGroupMembershipsRead(DomainRead):
    id: UUID
    group_id: UUID
    student_id: UUID
    valid_from: date
    valid_to: date | None
    origin: Literal["generated", "manual"]
    created_by: UUID | None
    created_at: datetime


class GroupSpecializationRulesCreate(DomainInput):
    group_id: UUID = Field(default=...)
    specialization_id: UUID = Field(default=...)


class GroupSpecializationRulesPatch(DomainInput):
    pass


class GroupSpecializationRulesRead(DomainRead):
    group_id: UUID
    specialization_id: UUID
