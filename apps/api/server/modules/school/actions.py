from datetime import date
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import StrictBool

from server.core.access.services import AccessContext
from server.core.auth.dependencies import (
    CurrentContextDep,
    SessionDep,
    mutation_guard,
    no_store,
)
from server.core.domain.router import ERROR_RESPONSES
from server.core.domain.schemas import DomainInput
from server.core.domain.services import conflict, require
from server.modules.timetable.services import validate_published

from .domain_service import SchoolDomainService
from .models import TeachingGroupMemberships
from .repository import active_on
from .resources import RESOURCES
from .schemas import TeachingGroupMembershipsRead

router = APIRouter(
    prefix="/school",
    tags=["school workflows"],
    dependencies=[Depends(mutation_guard), Depends(no_store)],
    responses=ERROR_RESPONSES,
)


class GenerateDivision(DomainInput):
    effective_from: date
    confirm_recompute: StrictBool = False


@router.post(
    "/group-divisions/{division_id}/generate",
    response_model=list[TeachingGroupMembershipsRead],
)
def generate(
    division_id: UUID,
    payload: GenerateDivision,
    actor: CurrentContextDep,
    session: SessionDep,
) -> object:
    resource = next(r for r in RESOURCES if r.name == "teaching_group_memberships")
    service = SchoolDomainService(session, resource)

    def action(fresh: AccessContext) -> object:
        repo = service.repo
        division = repo.one("group_divisions", id=division_id)
        require(division["method"] != "manual", "Ruční dělení se negeneruje.")
        groups = sorted(
            repo.rows("teaching_groups", division_id=division_id),
            key=lambda g: g["position"],
        )
        require(
            len(groups) >= 2, "Nejdřív vytvoř alespoň dvě výsledné explicitní skupiny."
        )
        cls = repo.one("classes", id=division["class_id"])
        year = repo.one("school_years", id=cls["school_year_id"])
        day = payload.effective_from
        require(
            max(year["starts_on"], division["effective_from"]) <= day < year["ends_on"],
            "Datum je mimo platnost dělení.",
        )
        group_ids = {g["id"] for g in groups}
        previous = [
            m
            for m in repo.rows("teaching_group_memberships")
            if m["group_id"] in group_ids
            and (m["valid_to"] is None or m["valid_to"] > day)
        ]
        conflict(
            bool(previous) and not payload.confirm_recompute,
            "Přepočet existujících členství vyžaduje potvrzení.",
        )
        enrollments = [
            e
            for e in repo.rows("class_enrollments", class_id=cls["id"])
            if active_on(e, day)
        ]
        users = {u["id"]: u for u in repo.rows("users")}
        enrollments.sort(
            key=lambda e: (
                (users[e["student_id"]]["last_name"] or "").casefold(),
                (users[e["student_id"]]["first_name"] or "").casefold(),
                users[e["student_id"]]["username"],
            )
        )
        require(bool(enrollments), "Ve třídě nejsou k datu žádní žáci.")
        rules = {
            r["specialization_id"]: r["group_id"]
            for r in repo.rows("group_specialization_rules")
            if r["group_id"] in group_ids
        }
        placements: list[tuple[dict[str, Any], Any]] = []
        for index, enrollment in enumerate(enrollments):
            if division["method"] == "specialization":
                require(
                    enrollment["specialization_id"] in rules,
                    "Zaměření žáka nemá pravidlo pro cílovou skupinu.",
                )
                group_id = rules[enrollment["specialization_id"]]
            else:
                group_id = groups[index * len(groups) // len(enrollments)]["id"]
            placements.append((enrollment, group_id))
        # Preserve old intervals; a confirmed recompute replaces only the future.
        for row in previous:
            entity = repo.entity(TeachingGroupMemberships, {"id": row["id"]})
            if row["valid_from"] < day:
                entity.valid_to = day
                operation = "updated"
            else:
                repo.remove(entity)
                operation = "deleted"
            service.audit(fresh, entity, operation, row)
        repo.flush()
        created = []
        for enrollment, group_id in placements:
            service.user_role(enrollment["student_id"], "student")
            entity = TeachingGroupMemberships(
                group_id=group_id,
                student_id=enrollment["student_id"],
                valid_from=day,
                valid_to=enrollment["valid_to"],
                origin="generated",
                created_by=fresh.user.id,
            )
            repo.add(entity)
            repo.flush()
            service.audit(fresh, entity, "created", None)
            created.append(entity)
        service.validate_school()
        validate_published(repo)
        return created

    return service.transaction(actor, "school.manage", action)
