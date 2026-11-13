"""Resolve recurring entries and substitutions to concrete school-local times."""

from datetime import date, datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlmodel import SQLModel

from server.core.domain.repository import DomainRepository
from server.modules.school.repository import RosterSnapshot

SCHOOL_ZONE = ZoneInfo("Europe/Prague")


def resolved_lessons(
    repo: DomainRepository,
    versions: list[dict[str, Any]] | None = None,
    *,
    date_from: date | None = None,
    date_to: date | None = None,
    include_cancelled: bool = False,
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
    changes: dict[Any, dict[str, Any]] = {
        c["lesson_occurrence_id"]: c for c in repo.rows("lesson_changes")
    }
    change: dict[str, Any] | None
    occurrence: dict[str, Any] | None
    moved_dates: dict[Any, set[date]] = {}
    for occurrence in occurrences.values():
        change = changes.get(occurrence["id"])
        if change and change["replacement_date"]:
            day = change["replacement_date"]
            if (date_from is None or date_from <= day) and (
                date_to is None or day < date_to
            ):
                moved_dates.setdefault(occurrence["timetable_entry_id"], set()).add(
                    occurrence["scheduled_date"]
                )
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
        window_start = max(start, date_from or start)
        window_end = min(end, date_to or end)
        dates = {
            window_start + timedelta(days=i)
            for i in range(max(0, (window_end - window_start).days))
        }
        for entry in entries:
            dates.update(
                day for day in moved_dates.get(entry["id"], set()) if start <= day < end
            )
        for current in sorted(dates):
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
                if (
                    change
                    and change["change_type"] == "cancelled"
                    and not include_cancelled
                ):
                    continue
                actual_date: date = (
                    change["replacement_date"] if change else None
                ) or current
                if (date_from is not None and actual_date < date_from) or (
                    date_to is not None and actual_date >= date_to
                ):
                    continue
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
                        "change_type": change["change_type"] if change else None,
                        "original_teacher_id": assignment["teacher_id"],
                        "original_room_id": entry["room_id"],
                        "original_starts_at": datetime.combine(
                            current,
                            slots[entry["time_slot_id"]]["start_time"],
                            SCHOOL_ZONE,
                        ),
                        "original_ends_at": datetime.combine(
                            current,
                            slots[entry["time_slot_id"]]["end_time"],
                            SCHOOL_ZONE,
                        ),
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
    return result


def filtered_page(
    repo: DomainRepository,
    model: type[SQLModel],
    offset: int,
    limit: int,
    **filters: Any,
) -> list[SQLModel]:
    """Apply filters before pagination; keep the existing stable primary-key order."""
    table = repo.table(str(model.__tablename__))
    query = select(model)
    for key, value in filters.items():
        if value is not None:
            query = query.where(table.c[key] == value)
    return list(
        repo.db.scalars(
            query.order_by(*table.primary_key.columns).offset(offset).limit(limit)
        ).all()
    )


def referenced_rows(
    repo: DomainRepository, name: str, identities: set[Any]
) -> dict[Any, dict[str, Any]]:
    if not identities:
        return {}
    table = repo.table(name)
    rows = repo.db.execute(select(table).where(table.c.id.in_(identities))).mappings()
    return {row["id"]: dict(row) for row in rows}


def assignment_workloads(
    repo: DomainRepository, assignment_ids: set[Any]
) -> dict[tuple[Any, Any], int]:
    table = repo.table("teaching_assignment_weeks")
    loads = repo.db.execute(
        select(table).where(table.c.teaching_assignment_id.in_(assignment_ids))
    ).mappings()
    return {
        (r["teaching_assignment_id"], r["cycle_week_id"]): r["periods"] for r in loads
    }
