from dataclasses import replace
from datetime import date
from typing import Annotated, Any, Literal
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import Field

from server.core.auth.dependencies import (
    CurrentContextDep,
    SessionDep,
    mutation_guard,
    no_store,
)
from server.core.domain.router import ERROR_RESPONSES, Pagination
from server.core.domain.schemas import DomainInput
from server.core.domain.services import authorize, require

from .domain_service import ClassbookDomainService
from .queries import excuse_detail, lesson_detail, person_name, public_record
from .repository import ClassbookRepository
from .resources import RESOURCES
from .schemas import (
    AbsenceExcuseItemsRead,
    AbsenceExcuseRequestsRead,
    AttendanceRecordsRead,
    ChildRead,
    ClassbookEntriesCreate,
    ClassbookEntriesPatch,
    ClassbookEntriesRead,
    ExcuseDetail,
    LessonDetail,
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
    note: str | None = Field(default=None, max_length=10000)


class ExcuseRequest(DomainInput):
    student_id: UUID
    reason: str = Field(min_length=1, max_length=10000)
    attendance_record_ids: list[UUID] = Field(min_length=1, max_length=100)


class MarkAttendanceBatch(DomainInput):
    records: list[MarkAttendance] = Field(min_length=1, max_length=500)


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


@router.put(
    "/lessons/{entry_id}/attendance",
    response_model=list[AttendanceRecordsRead],
)
def mark_batch(
    entry_id: UUID,
    payload: MarkAttendanceBatch,
    actor: CurrentContextDep,
    session: SessionDep,
) -> object:
    return service(session, "attendance_records").mark_many(
        actor, entry_id, list(payload.records)
    )


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
    actor: CurrentContextDep,
    session: SessionDep,
    page: Annotated[Pagination, Depends()],
    student_id: UUID | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
) -> object:
    current = service(session, "attendance_records")
    current.access.require(actor, "classbook.read")
    student_id = student_id or actor.user.id
    authorize(current.owns_student(actor, student_id), "Nemáš přístup k docházce žáka.")
    require(
        date_from is None or date_to is None or date_from < date_to,
        "Začátek musí být před koncem.",
    )
    return [
        public_record(row)
        for row in ClassbookRepository(session).attendance(
            student_id, page.offset, page.limit, date_from, date_to
        )
    ]


@router.get("/my-excuse-requests", response_model=list[AbsenceExcuseRequestsRead])
def my_excuses(
    actor: CurrentContextDep,
    session: SessionDep,
    page: Annotated[Pagination, Depends()],
    status: Literal["open", "closed", "withdrawn"] | None = None,
) -> object:
    current = service(session, "absence_excuse_requests")
    current.access.require(actor, "attendance.request")
    return ClassbookRepository(session).requests(
        actor,
        page.offset,
        page.limit,
        status=status,
    )


@router.get("/my-lessons", response_model=list[ClassbookEntriesRead])
def my_lessons(
    actor: CurrentContextDep,
    session: SessionDep,
    page: Annotated[Pagination, Depends()],
    date_from: date | None = None,
    date_to: date | None = None,
) -> object:
    current = service(session, "classbook_entries")
    current.access.require(actor, "classbook.read")
    require(
        date_from is None or date_to is None or date_from < date_to,
        "Začátek musí být před koncem.",
    )
    internal = (
        actor.school_role_code == "teacher" or "classbook.manage" in actor.permissions
    )
    return [
        public_record(row, internal=internal)
        for row in ClassbookRepository(session).lessons(
            actor, page.offset, page.limit, date_from, date_to
        )
    ]


@router.get("/lessons/{entry_id}", response_model=LessonDetail)
def read_lesson(
    entry_id: UUID, actor: CurrentContextDep, session: SessionDep
) -> object:
    return lesson_detail(service(session, "classbook_entries"), actor, entry_id)


@router.delete("/lessons/{entry_id}", status_code=204)
def delete_lesson(
    entry_id: UUID, actor: CurrentContextDep, session: SessionDep
) -> None:
    service(session, "classbook_entries", "classbook.write").delete(
        actor, {"id": entry_id}
    )


@router.get("/excuse-inbox", response_model=list[AbsenceExcuseRequestsRead])
def excuse_inbox(
    actor: CurrentContextDep,
    session: SessionDep,
    page: Annotated[Pagination, Depends()],
) -> object:
    current = service(session, "absence_excuse_requests")
    current.access.require(actor, "attendance.excuse")
    return ClassbookRepository(session).requests(
        actor, page.offset, page.limit, inbox=True
    )


@router.get("/excuse-requests/{request_id}", response_model=ExcuseDetail)
def read_excuse(
    request_id: UUID, actor: CurrentContextDep, session: SessionDep
) -> object:
    return excuse_detail(service(session, "absence_excuse_requests"), actor, request_id)


@router.get("/my-children", response_model=list[ChildRead])
def my_children(actor: CurrentContextDep, session: SessionDep) -> object:
    current = service(session, "classbook_entries")
    current.access.require(actor, "classbook.read")
    authorize(actor.school_role_code == "parent", "Přehled je určen rodičům.")
    from server.modules.timetable.repository import referenced_rows

    users = referenced_rows(
        current.repo, "users", ClassbookRepository(session).students(actor)
    )
    return sorted(
        [
            {"student_id": identity, "name": person_name(user)}
            for identity, user in users.items()
        ],
        key=lambda row: str(row["name"]).casefold(),
    )
