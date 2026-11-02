"""Resolve recurring entries and substitutions to concrete school-local times."""

from datetime import date, datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from server.core.domain.repository import DomainRepository
from server.modules.school.repository import RosterSnapshot

SCHOOL_ZONE = ZoneInfo("Europe/Prague")


def resolved_lessons(
    repo: DomainRepository,
    versions: list[dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    if versions is None:
        versions = [
            v
            for v in repo.rows("timetable_versions")
            if v["status"] in {"published", "archived"}
        ]
    result: list[dict[str, Any]] = []
    roster = RosterSnapshot(repo)
    occurrences = {
        (o["timetable_entry_id"], o["scheduled_date"]): o
        for o in repo.rows("lesson_occurrences")
    }
    changes = {c["lesson_occurrence_id"]: c for c in repo.rows("lesson_changes")}
    slots = {s["id"]: s for s in repo.rows("time_slots")}
    assignments = {a["id"]: a for a in repo.rows("teaching_assignments")}
    for version in versions:
        plan = repo.one("teaching_plans", id=version["teaching_plan_id"])
        year = repo.one("school_years", id=plan["school_year_id"])
        start = max(version["valid_from"] or year["starts_on"], year["starts_on"])
        end = min(version["valid_to"] or year["ends_on"], year["ends_on"])
        weeks = {
            w["week_starts_on"]: w["cycle_week_id"]
            for w in repo.rows(
                "teaching_plan_calendar_weeks", teaching_plan_id=plan["id"]
            )
        }
        days = {
            d["calendar_date"]: d["is_teaching_day"]
            for d in repo.rows(
                "teaching_plan_calendar_days", teaching_plan_id=plan["id"]
            )
        }
        entries = repo.rows("timetable_entries", timetable_version_id=version["id"])
        current = start
        while current < end:
            monday = current - timedelta(days=current.weekday())
            for entry in entries:
                if (
                    entry["day_of_week"] != current.isoweekday()
                    or (weeks.get(monday) != entry["cycle_week_id"])
                    or not days.get(current, current.weekday() < 5)
                ):
                    continue
                assignment = assignments[entry["teaching_assignment_id"]]
                occurrence = occurrences.get((entry["id"], current))
                change = changes.get(occurrence["id"]) if occurrence else None
                if change and change["change_type"] == "cancelled":
                    continue
                actual_date: date = (
                    change["replacement_date"] if change else None
                ) or current
                slot_id = (
                    change["replacement_time_slot_id"] if change else None
                ) or entry["time_slot_id"]
                slot = slots[slot_id]
                room_id = entry["room_id"]
                if change and change["room_changed"]:
                    room_id = change["replacement_room_id"]
                result.append(
                    {
                        "timetable_entry_id": entry["id"],
                        "lesson_occurrence_id": occurrence["id"]
                        if occurrence
                        else None,
                        "timetable_version_id": version["id"],
                        "scheduled_date": current,
                        "group_id": assignment["group_id"],
                        "subject_id": assignment["subject_id"],
                        "teacher_id": (
                            change["replacement_teacher_id"] if change else None
                        )
                        or assignment["teacher_id"],
                        "room_id": room_id,
                        "starts_at": datetime.combine(
                            actual_date, slot["start_time"], SCHOOL_ZONE
                        ),
                        "ends_at": datetime.combine(
                            actual_date, slot["end_time"], SCHOOL_ZONE
                        ),
                        "students": roster.students(
                            assignment["group_id"], actual_date
                        ),
                    }
                )
            current += timedelta(days=1)
    return result
