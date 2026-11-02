"""School membership queries over the shared domain repository."""

from collections import defaultdict
from datetime import date
from typing import Any
from uuid import UUID

from server.core.domain.repository import DomainRepository


def active_on(row: dict[str, Any], day: date) -> bool:
    return row["valid_from"] <= day and (
        row["valid_to"] is None or day < row["valid_to"]
    )


def group_students(repo: DomainRepository, group_id: UUID, day: date) -> set[UUID]:
    group = repo.one("teaching_groups", id=group_id)
    year = repo.one("school_years", id=group["school_year_id"])
    if not year["starts_on"] <= day < year["ends_on"]:
        return set()
    if group["membership_mode"] == "class_enrollment":
        rows = repo.rows("class_enrollments", class_id=group["source_class_id"])
    else:
        rows = repo.rows("teaching_group_memberships", group_id=group_id)
    return {row["student_id"] for row in rows if active_on(row, day)}


class RosterSnapshot:
    """Load memberships once for resolving many timetable dates in a request."""

    def __init__(self, repo: DomainRepository) -> None:
        self.groups = {r["id"]: r for r in repo.rows("teaching_groups")}
        self.years = {r["id"]: r for r in repo.rows("school_years")}
        self.enrollments: dict[UUID, list[dict[str, Any]]] = defaultdict(list)
        self.memberships: dict[UUID, list[dict[str, Any]]] = defaultdict(list)
        for row in repo.rows("class_enrollments"):
            self.enrollments[row["class_id"]].append(row)
        for row in repo.rows("teaching_group_memberships"):
            self.memberships[row["group_id"]].append(row)
        self.cache: dict[tuple[UUID, date], set[UUID]] = {}

    def students(self, group_id: UUID, day: date) -> set[UUID]:
        key = (group_id, day)
        if key not in self.cache:
            group = self.groups[group_id]
            year = self.years[group["school_year_id"]]
            if not year["starts_on"] <= day < year["ends_on"]:
                self.cache[key] = set()
            else:
                rows = (
                    self.enrollments[group["source_class_id"]]
                    if (group["membership_mode"] == "class_enrollment")
                    else self.memberships[group_id]
                )
                self.cache[key] = {r["student_id"] for r in rows if active_on(r, day)}
        return self.cache[key]
