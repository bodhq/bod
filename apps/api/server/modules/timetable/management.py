"""Read models for timetable editors; persistence follows the existing ER entities."""

from collections import Counter
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import Field

from server.core.access.repository import AccessError
from server.core.auth.dependencies import (
    CurrentContextDep,
    SessionDep,
    mutation_guard,
    no_store,
)
from server.core.domain.router import ERROR_RESPONSES
from server.core.domain.schemas import DomainRead
from server.core.domain.services import require
from server.core.exceptions import ErrorCode

from .repository import assignment_workloads, referenced_rows
from .resources import RESOURCES
from .schemas import (
    TeachingCycleWeeksRead,
    TeachingPlansRead,
    TimeSlotsRead,
    TimetableEntriesRead,
    TimetableVersionsRead,
)
from .services import TimetableService

router = APIRouter(
    prefix="/timetable/timetable-versions",
    tags=["timetable management"],
    dependencies=[Depends(mutation_guard), Depends(no_store)],
    responses=ERROR_RESPONSES,
)


class AssignmentOverview(DomainRead):
    teaching_assignment_id: UUID
    group_id: UUID
    group_name: str
    subject_id: UUID
    subject_code: str
    subject_name: str
    teacher_id: UUID
    teacher_name: str
    required_room_type_code: str | None


class WorkloadOverview(DomainRead):
    teaching_assignment_id: UUID
    cycle_week_id: UUID
    required_periods: int
    scheduled_periods: int
    remaining_periods: int = Field(
        description="Kladné číslo: chybějící hodiny; záporné: hodiny nad úvazek."
    )


class EntryOverview(TimetableEntriesRead):
    room_code: str | None
    room_name: str | None


class VersionOverview(DomainRead):
    version: TimetableVersionsRead
    plan: TeachingPlansRead
    editable: bool = Field(description="Verze je návrh a lze měnit její položky.")
    plan_editable: bool = Field(description="Plán výuky dosud není zmrazený.")
    cycle_weeks: list[TeachingCycleWeeksRead]
    time_slots: list[TimeSlotsRead]
    assignments: list[AssignmentOverview]
    workloads: list[WorkloadOverview]
    entries: list[EntryOverview]


class PublicationIssue(DomainRead):
    code: ErrorCode
    message: str


class PublicationCheck(DomainRead):
    can_publish: bool
    issues: list[PublicationIssue] = Field(
        description="První blokující problém. Po opravě spusť kontrolu znovu."
    )


def version_service(session: Any) -> TimetableService:
    return TimetableService(
        session, next(r for r in RESOURCES if r.name == "timetable_versions")
    )


@router.get("/{version_id}/overview", response_model=VersionOverview)
def overview(version_id: UUID, actor: CurrentContextDep, session: SessionDep) -> object:
    """Úplný přehled jedné varianty včetně úvazků a popisků pro editor rozvrhu."""
    current = version_service(session)
    current.access.require(actor, "timetable.edit")
    repo = current.repo
    version = repo.one("timetable_versions", id=version_id)
    plan = repo.one("teaching_plans", id=version["teaching_plan_id"])
    weeks = sorted(
        repo.rows("teaching_cycle_weeks", teaching_plan_id=plan["id"]),
        key=lambda row: row["position"],
    )
    slots = sorted(
        repo.rows("time_slots", time_grid_id=version["time_grid_id"]),
        key=lambda row: row["position"],
    )
    assignments = repo.rows("teaching_assignments", teaching_plan_id=plan["id"])
    groups = referenced_rows(
        repo, "teaching_groups", {a["group_id"] for a in assignments}
    )
    subjects = referenced_rows(repo, "subjects", {a["subject_id"] for a in assignments})
    teachers = referenced_rows(repo, "users", {a["teacher_id"] for a in assignments})
    entries = repo.rows("timetable_entries", timetable_version_id=version_id)
    rooms = referenced_rows(
        repo, "rooms", {e["room_id"] for e in entries if e["room_id"]}
    )
    counts = Counter((e["teaching_assignment_id"], e["cycle_week_id"]) for e in entries)
    # Read only the workloads of this plan, in one query.
    required = assignment_workloads(repo, {a["id"] for a in assignments})
    labels = []
    workloads = []
    for assignment in assignments:
        teacher = teachers[assignment["teacher_id"]]
        teacher_name = (
            teacher["display_name"]
            or " ".join(
                part for part in (teacher["first_name"], teacher["last_name"]) if part
            )
            or teacher["username"]
        )
        subject = subjects[assignment["subject_id"]]
        labels.append(
            dict(
                teaching_assignment_id=assignment["id"],
                group_name=groups[assignment["group_id"]]["name"],
                subject_code=subject["code"],
                subject_name=subject["name"],
                teacher_name=teacher_name,
                **{
                    key: assignment[key]
                    for key in (
                        "group_id",
                        "subject_id",
                        "teacher_id",
                        "required_room_type_code",
                    )
                },
            )
        )
        for week in weeks:
            key = (assignment["id"], week["id"])
            expected, scheduled = required.get(key, 0), counts[key]
            workloads.append(
                dict(
                    teaching_assignment_id=assignment["id"],
                    cycle_week_id=week["id"],
                    required_periods=expected,
                    scheduled_periods=scheduled,
                    remaining_periods=expected - scheduled,
                )
            )
    positions = {slot["id"]: slot["position"] for slot in slots}
    week_positions = {week["id"]: week["position"] for week in weeks}
    entries.sort(
        key=lambda row: (
            week_positions[row["cycle_week_id"]],
            row["day_of_week"],
            positions[row["time_slot_id"]],
            str(row["id"]),
        )
    )
    labels.sort(
        key=lambda row: (
            row["group_name"],
            row["subject_code"],
            row["teacher_name"],
            str(row["teaching_assignment_id"]),
        )
    )
    return dict(
        version=version,
        plan=plan,
        editable=version["status"] == "draft",
        plan_editable=plan["frozen_at"] is None,
        cycle_weeks=weeks,
        time_slots=slots,
        assignments=labels,
        workloads=workloads,
        entries=[
            dict(
                **entry,
                room_code=rooms.get(entry["room_id"], {}).get("code"),
                room_name=rooms.get(entry["room_id"], {}).get("name"),
            )
            for entry in entries
        ],
    )


@router.get("/{version_id}/publication-check", response_model=PublicationCheck)
def publication_check(
    version_id: UUID, actor: CurrentContextDep, session: SessionDep
) -> PublicationCheck:
    """Ověří aktuální návrh bez zápisu, auditu či zmrazení závislostí.

    Výsledek platí pro aktuální data. Publikování kontrolu provede znovu
    v transakci a samostatně vyžaduje timetable.publish.
    """
    current = version_service(session)
    current.access.require(actor, "timetable.edit")
    version = current.repo.one("timetable_versions", id=version_id)
    try:
        require(version["status"] == "draft", "Publikovat lze pouze návrh.")
        current.validate_publication(version)
    except AccessError as error:
        return PublicationCheck(
            can_publish=False,
            issues=[PublicationIssue(code=error.code, message=error.message)],
        )
    return PublicationCheck(can_publish=True, issues=[])
