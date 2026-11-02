from dataclasses import replace
from typing import Any, Literal
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import Field

from server.core.auth.dependencies import (
    CurrentContextDep,
    SessionDep,
    mutation_guard,
    no_store,
)
from server.core.domain.router import ERROR_RESPONSES
from server.core.domain.schemas import DomainInput
from server.core.domain.services import authorize

from .domain_service import ClassbookDomainService
from .resources import RESOURCES
from .schemas import (
    AbsenceExcuseItemsRead,
    AbsenceExcuseRequestsRead,
    AttendanceRecordsRead,
    ClassbookEntriesCreate,
    ClassbookEntriesPatch,
    ClassbookEntriesRead,
)

router = APIRouter(
    prefix="/classbook",
    tags=["classbook workflows"],
    dependencies=[Depends(mutation_guard), Depends(no_store)],
    responses=ERROR_RESPONSES,
)


class MarkAttendance(DomainInput):
    student_id: UUID
    status: Literal["present", "absent", "late", "released_early"]
    late_minutes: int | None = Field(default=None, ge=0, strict=True)
    missed_minutes: int | None = Field(default=None, ge=0, strict=True)
    note: str | None = None


class ExcuseRequest(DomainInput):
    student_id: UUID
    reason: str = Field(min_length=1, max_length=10000)
    attendance_record_ids: list[UUID] = Field(min_length=1, max_length=100)


class Decision(DomainInput):
    decision: Literal["approved", "rejected"]
    note: str | None = Field(default=None, max_length=10000)


def service(
    session: Any, name: str, permission: str | None = None
) -> ClassbookDomainService:
    resource = next(r for r in RESOURCES if r.name == name)
    if permission:
        resource = replace(resource, permission=permission)
    return ClassbookDomainService(session, resource)


@router.post("/lessons", response_model=ClassbookEntriesRead, status_code=201)
def create_lesson(
    payload: ClassbookEntriesCreate, actor: CurrentContextDep, session: SessionDep
) -> object:
    return service(session, "classbook_entries", "classbook.write").create(
        actor, payload
    )


@router.patch("/lessons/{entry_id}", response_model=ClassbookEntriesRead)
def patch_lesson(
    entry_id: UUID,
    payload: ClassbookEntriesPatch,
    actor: CurrentContextDep,
    session: SessionDep,
) -> object:
    return service(session, "classbook_entries", "classbook.write").patch(
        actor, {"id": entry_id}, payload
    )


@router.post("/classbook-entries/{entry_id}/sign", response_model=ClassbookEntriesRead)
def sign(entry_id: UUID, actor: CurrentContextDep, session: SessionDep) -> object:
    return service(session, "classbook_entries").sign(actor, entry_id)


@router.put(
    "/classbook-entries/{entry_id}/attendance", response_model=AttendanceRecordsRead
)
def mark(
    entry_id: UUID,
    payload: MarkAttendance,
    actor: CurrentContextDep,
    session: SessionDep,
) -> object:
    return service(session, "attendance_records").mark(actor, entry_id, payload)


@router.post(
    "/excuse-requests", response_model=AbsenceExcuseRequestsRead, status_code=201
)
def request_excuse(
    payload: ExcuseRequest, actor: CurrentContextDep, session: SessionDep
) -> object:
    return service(session, "absence_excuse_requests").request_excuse(
        actor, payload.student_id, payload.reason, payload.attendance_record_ids
    )


@router.post(
    "/excuse-requests/{request_id}/items/{record_id}/decide",
    response_model=AbsenceExcuseItemsRead,
)
def decide(
    request_id: UUID,
    record_id: UUID,
    payload: Decision,
    actor: CurrentContextDep,
    session: SessionDep,
) -> object:
    return service(session, "absence_excuse_items").decide(
        actor, request_id, record_id, payload.decision, payload.note
    )


@router.post(
    "/excuse-requests/{request_id}/withdraw", response_model=AbsenceExcuseRequestsRead
)
def withdraw(request_id: UUID, actor: CurrentContextDep, session: SessionDep) -> object:
    return service(session, "absence_excuse_requests").withdraw(actor, request_id)


@router.get("/my-attendance", response_model=list[AttendanceRecordsRead])
def my_attendance(
    actor: CurrentContextDep, session: SessionDep, student_id: UUID | None = None
) -> object:
    current = service(session, "attendance_records")
    current.access.require(actor, "classbook.read")
    student_id = student_id or actor.user.id
    authorize(current.owns_student(actor, student_id), "Nemáš přístup k docházce žáka.")
    return current.repo.rows("attendance_records", student_id=student_id)


@router.get("/my-excuse-requests", response_model=list[AbsenceExcuseRequestsRead])
def my_excuses(actor: CurrentContextDep, session: SessionDep) -> object:
    current = service(session, "absence_excuse_requests")
    current.access.require(actor, "attendance.request")
    return current.repo.rows("absence_excuse_requests", requested_by=actor.user.id)


@router.get("/my-lessons", response_model=list[ClassbookEntriesRead])
def my_lessons(actor: CurrentContextDep, session: SessionDep) -> object:
    current = service(session, "classbook_entries")
    current.access.require(actor, "classbook.read")
    if actor.active_role_code == "teacher":
        return current.repo.rows("classbook_entries", actual_teacher_id=actor.user.id)
    students = (
        {actor.user.id}
        if actor.active_role_code == "student"
        else {
            row["student_id"]
            for row in current.repo.rows("parent_students", parent_id=actor.user.id)
        }
        if actor.active_role_code == "parent"
        else set()
    )
    entries = {
        r["classbook_entry_id"]
        for student in students
        for r in current.repo.rows("classbook_participants", student_id=student)
    }
    return [
        row
        for row in current.repo.rows("classbook_entries")
        if row["id"] in entries and row["status"] == "signed"
    ]
