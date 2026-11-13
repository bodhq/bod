"""Read authorization and presentation for teachers, pupils and parents."""

from typing import Any
from uuid import UUID

from server.core.access.services import AccessContext
from server.core.domain.services import authorize
from server.modules.timetable.repository import referenced_rows

from .domain_service import ClassbookDomainService
from .repository import ClassbookRepository


def person_name(user: dict[str, Any]) -> str:
    return (
        user["display_name"]
        or " ".join(p for p in (user["first_name"], user["last_name"]) if p)
        or user["username"]
    )


def public_record(row: dict[str, Any], *, internal: bool = False) -> dict[str, Any]:
    # Notes are internal; topics and explicit excuse reasons are public.
    return row if internal else row | {"note": None}


def lesson_detail(
    current: ClassbookDomainService,
    actor: AccessContext,
    entry_id: UUID,
) -> dict[str, Any]:
    current.access.require(
        actor,
        "classbook.manage"
        if "classbook.manage" in actor.permissions
        else "classbook.read",
    )
    repo = ClassbookRepository(current.repo.db)
    lesson = repo.one("classbook_entries", id=entry_id)
    internal = "classbook.manage" in actor.permissions or (
        actor.school_role_code == "teacher"
        and lesson["actual_teacher_id"] == actor.user.id
    )
    participants = repo.rows("classbook_participants", classbook_entry_id=entry_id)
    if not internal:
        students = repo.students(actor)
        authorize(
            lesson["status"] == "signed"
            and any(row["student_id"] in students for row in participants),
            "Nemáš přístup k této hodině.",
        )
        participants = [row for row in participants if row["student_id"] in students]
    records = {
        row["student_id"]: public_record(row, internal=internal)
        for row in repo.rows("attendance_records", classbook_entry_id=entry_id)
    }
    users = referenced_rows(repo, "users", {p["student_id"] for p in participants})
    return {
        "lesson": public_record(lesson, internal=internal),
        "participants": sorted(
            [
                {
                    "student_id": p["student_id"],
                    "name": person_name(users[p["student_id"]]),
                    "attendance": records.get(p["student_id"]),
                }
                for p in participants
            ],
            key=lambda row: (str(row["name"]).casefold(), str(row["student_id"])),
        ),
    }


def excuse_detail(
    current: ClassbookDomainService,
    actor: AccessContext,
    request_id: UUID,
) -> dict[str, Any]:
    repo = ClassbookRepository(current.repo.db)
    request = repo.one("absence_excuse_requests", id=request_id)
    owner = current.owns_student(actor, request["student_id"])
    manager = "classbook.manage" in actor.permissions
    current.access.require(
        actor,
        "classbook.manage"
        if manager
        else "attendance.request"
        if owner
        else "attendance.excuse",
    )
    details = []
    for item in repo.rows("absence_excuse_items", request_id=request_id):
        record = repo.one("attendance_records", id=item["attendance_record_id"])
        allowed = "attendance.excuse" in actor.permissions and repo.can_decide(
            actor, record["id"]
        )
        if not (owner or manager or allowed):
            continue
        lesson = repo.one("classbook_entries", id=record["classbook_entry_id"])
        subject = repo.one("subjects", id=lesson["subject_id"])
        details.append(
            {
                "item": item,
                "attendance": public_record(record),
                "lesson_id": lesson["id"],
                "starts_at": lesson["starts_at"],
                "ends_at": lesson["ends_at"],
                "subject_name": subject["name"],
                "can_decide": "attendance.excuse" in actor.permissions
                and (allowed or manager)
                and request["status"] == "open"
                and item["decision"] == "pending",
            }
        )
    authorize(owner or manager or bool(details), "Nemáš přístup k této žádosti.")
    user = repo.one("users", id=request["student_id"])
    return request | {"student_name": person_name(user), "items": details}
