from dataclasses import replace
from datetime import date, datetime, timedelta
from typing import Annotated, Any, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import Field

from server.core.auth.dependencies import (
    CurrentContextDep,
    SessionDep,
    mutation_guard,
    no_store,
)
from server.core.domain.router import ERROR_RESPONSES
from server.core.domain.schemas import DomainInput, DomainRead
from server.core.domain.services import authorize, instant, overlaps, require
from server.modules.classbook.domain_service import ClassbookDomainService
from server.modules.classbook.resources import RESOURCES as CLASSBOOK

from .repository import referenced_rows, resolved_lessons
from .resources import RESOURCES
from .schemas import (
    LessonOccurrencesCreate,
    LessonOccurrencesRead,
    TeachingPlanCalendarWeeksRead,
    TimetableVersionsRead,
)
from .services import TimetableService

router = APIRouter(
    prefix="/timetable",
    tags=["timetable workflows"],
    dependencies=[Depends(mutation_guard), Depends(no_store)],
    responses=ERROR_RESPONSES,
)


class CloseVersion(DomainInput):
    valid_to: date


class CloneVersion(DomainInput):
    name: str = Field(min_length=1, max_length=150)
    plan_name: str = Field(min_length=1, max_length=150)


class ScheduleLesson(DomainRead):
    timetable_entry_id: UUID
    lesson_occurrence_id: UUID | None
    timetable_version_id: UUID
    scheduled_date: date
    group_id: UUID
    subject_id: UUID
    teacher_id: UUID
    room_id: UUID | None
    starts_at: datetime
    ends_at: datetime
    group_name: str
    subject_code: str
    subject_name: str
    teacher_name: str
    room_code: str | None
    room_name: str | None
    change_type: Literal["modified", "cancelled"] | None
    original_teacher_id: UUID
    original_room_id: UUID | None
    original_starts_at: datetime
    original_ends_at: datetime
    unresolved_reasons: list[Literal["teacher_unavailable", "room_unavailable"]]


def service(session: Any, name: str) -> TimetableService:
    return TimetableService(session, next(r for r in RESOURCES if r.name == name))


@router.post(
    "/timetable-versions/{version_id}/publish", response_model=TimetableVersionsRead
)
def publish(version_id: UUID, actor: CurrentContextDep, session: SessionDep) -> object:
    return service(session, "timetable_versions").publish(actor, {"id": version_id})


@router.post(
    "/timetable-versions/{version_id}/close", response_model=TimetableVersionsRead
)
def close(
    version_id: UUID,
    payload: CloseVersion,
    actor: CurrentContextDep,
    session: SessionDep,
) -> object:
    return service(session, "timetable_versions").close(
        actor, {"id": version_id}, payload.valid_to
    )


@router.post(
    "/timetable-versions/{version_id}/clone",
    response_model=TimetableVersionsRead,
    status_code=201,
)
def clone(
    version_id: UUID,
    payload: CloneVersion,
    actor: CurrentContextDep,
    session: SessionDep,
) -> object:
    from .cloning import clone_version

    return clone_version(
        service(session, "timetable_versions"),
        actor,
        version_id,
        payload.name,
        payload.plan_name,
    )


@router.post(
    "/teaching-plans/{plan_id}/regenerate-calendar",
    response_model=list[TeachingPlanCalendarWeeksRead],
)
def regenerate(plan_id: UUID, actor: CurrentContextDep, session: SessionDep) -> object:
    current = service(session, "teaching_plans")

    def action(fresh: Any) -> object:
        current.regenerate_calendar(plan_id)
        entity = current.repo.entity(current.resource.model, {"id": plan_id})
        current.audit(fresh, entity, "updated", entity.model_dump())
        return current.repo.rows(
            "teaching_plan_calendar_weeks", teaching_plan_id=plan_id
        )

    return current.transaction(actor, "timetable.edit", action)


@router.get("/schedule", response_model=list[ScheduleLesson])
def schedule(
    actor: CurrentContextDep,
    session: SessionDep,
    date_from: Annotated[date, Query()],
    date_to: Annotated[date, Query()],
    student_id: UUID | None = None,
    include_cancelled: bool = False,
) -> object:
    current = service(session, "timetable_versions")
    current.access.require(actor, "timetable.read")
    require(
        date_from < date_to <= date_from + timedelta(days=93),
        "Rozsah musí mít 1 až 93 dní; konec je výlučný.",
    )
    manager = "timetable.edit" in actor.permissions
    if student_id is not None and not manager:
        checker = ClassbookDomainService(session, CLASSBOOK[0])
        authorize(
            checker.owns_student(actor, student_id), "Nemáš přístup k rozvrhu žáka."
        )
    children = (
        {
            p["student_id"]
            for p in current.repo.rows("parent_students", parent_id=actor.user.id)
        }
        if actor.school_role_code == "parent"
        else set()
    )
    result = []
    for lesson in resolved_lessons(
        current.repo,
        date_from=date_from,
        date_to=date_to,
        include_cancelled=include_cancelled,
    ):
        actual_day = lesson["starts_at"].date()
        if not date_from <= actual_day < date_to:
            continue
        visible = (
            (student_id in lesson["students"])
            if student_id
            else (
                manager
                or (
                    actor.school_role_code == "teacher"
                    and lesson["teacher_id"] == actor.user.id
                )
                or (
                    actor.school_role_code == "student"
                    and actor.user.id in lesson["students"]
                )
                or bool(children & lesson["students"])
            )
        )
        if visible:
            result.append(lesson)
    groups = referenced_rows(
        current.repo, "teaching_groups", {r["group_id"] for r in result}
    )
    subjects = referenced_rows(
        current.repo, "subjects", {r["subject_id"] for r in result}
    )
    teachers = referenced_rows(current.repo, "users", {r["teacher_id"] for r in result})
    rooms = referenced_rows(
        current.repo, "rooms", {r["room_id"] for r in result if r["room_id"]}
    )
    teacher_absences = current.repo.rows("teacher_unavailability")
    room_absences = current.repo.rows("room_unavailability")
    for lesson in result:
        subject, teacher = (
            subjects[lesson["subject_id"]],
            teachers[lesson["teacher_id"]],
        )
        room = rooms.get(lesson["room_id"], {})
        reasons = []
        if lesson["change_type"] != "cancelled":
            for name, absences, key in (
                ("teacher_unavailable", teacher_absences, "teacher_id"),
                ("room_unavailable", room_absences, "room_id"),
            ):
                if any(
                    lesson[key] is not None
                    and a[key] == lesson[key]
                    and overlaps(
                        lesson["starts_at"],
                        lesson["ends_at"],
                        instant(a["starts_at"]),
                        instant(a["ends_at"]),
                    )
                    for a in absences
                ):
                    reasons.append(name)
        lesson.update(
            group_name=groups[lesson["group_id"]]["name"],
            subject_code=subject["code"],
            subject_name=subject["name"],
            teacher_name=teacher["display_name"]
            or " ".join(p for p in (teacher["first_name"], teacher["last_name"]) if p)
            or teacher["username"],
            room_code=room.get("code"),
            room_name=room.get("name"),
            unresolved_reasons=reasons,
        )
    return sorted(result, key=lambda row: row["starts_at"])


@router.post("/materialize", response_model=LessonOccurrencesRead, status_code=201)
def materialize(
    payload: LessonOccurrencesCreate, actor: CurrentContextDep, session: SessionDep
) -> object:
    current = service(session, "lesson_occurrences")
    # A teacher may materialize only their own effective lesson for classbook use.
    resource = replace(current.resource, permission="classbook.write")
    current = TimetableService(session, resource)

    def action(fresh: Any) -> object:
        lesson = next(
            (
                row
                for row in resolved_lessons(current.repo)
                if row["timetable_entry_id"] == payload.timetable_entry_id
                and row["scheduled_date"] == payload.scheduled_date
            ),
            None,
        )
        require(lesson is not None, "Plánovaná hodina nebyla nalezena.")
        assert lesson is not None
        authorize(
            "classbook.manage" in fresh.permissions
            or (
                fresh.school_role_code == "teacher"
                and lesson["teacher_id"] == fresh.user.id
            ),
            "Hodina patří jinému učiteli.",
        )
        existing = current.repo.rows(
            "lesson_occurrences",
            timetable_entry_id=payload.timetable_entry_id,
            scheduled_date=payload.scheduled_date,
        )
        if existing:
            return existing[0]
        current.validate(payload.model_dump(), None, fresh)
        entity = current.resource.model.model_validate(payload.model_dump())
        current.repo.add(entity)
        current.repo.flush()
        current.audit(fresh, entity, "created", None)
        return entity

    return current.transaction(actor, "classbook.write", action)
