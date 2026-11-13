from collections import defaultdict
from datetime import date
from typing import Any

from server.core.access.services import AccessContext
from server.core.domain.services import DomainService, conflict, overlaps, require
from server.core.users.models import utcnow


class SchoolDomainService(DomainService):
    def validate(
        self,
        data: dict[str, Any],
        old: dict[str, Any] | None,
        actor: AccessContext,
    ) -> None:
        super().validate(data, old, actor)
        table = self.resource.name
        if table in {"class_enrollments", "teaching_group_memberships"}:
            parent_table = (
                "classes" if table == "class_enrollments" else "teaching_groups"
            )
            parent_key = "class_id" if table == "class_enrollments" else "group_id"
            parent = self.repo.one(parent_table, id=data[parent_key])
            year = self.repo.one("school_years", id=parent["school_year_id"])
            if data.get("valid_to") is None:
                data["valid_to"] = year["ends_on"]
        if (
            old
            and table == "school_years"
            and any(
                p["frozen_at"] is not None
                for p in self.repo.rows("teaching_plans", school_year_id=old["id"])
            )
        ):
            conflict(
                data["starts_on"] != old["starts_on"]
                or data["ends_on"] != old["ends_on"],
                "Školní rok zmrazeného plánu nesmí změnit své hranice.",
            )
        if old and table == "teaching_groups":
            referenced = bool(
                self.repo.rows("teaching_assignments", group_id=old["id"])
                or self.repo.rows("classbook_entries", group_id=old["id"])
            )
            if referenced:
                conflict(
                    any(
                        data[k] != old[k]
                        for k in (
                            "school_year_id",
                            "membership_mode",
                            "source_class_id",
                            "division_id",
                            "position",
                        )
                    ),
                    "Používané skupině nelze změnit její zdroj ani školní rok.",
                )
        roles = {
            "class_teacher_id": "teacher",
            "student_id": "student",
            "parent_id": "parent",
        }
        for field, role in roles.items():
            if data.get(field) and (old is None or old.get(field) != data[field]):
                self.user_role(data[field], role)
        if table == "parent_students":
            require(
                data["parent_id"] != data["student_id"], "Rodič a žák se musí lišit."
            )
        if table == "teaching_group_memberships" and (
            old is None or data.get("origin") != old["origin"]
        ):
            require(
                data.get("origin", "manual") == "manual",
                "Generovaný původ nastavuje pouze dělení skupin.",
            )

    def after_write(
        self,
        data: dict[str, Any] | None,
        old: dict[str, Any] | None,
        actor: AccessContext,
    ) -> None:
        if self.resource.name not in {"subjects", "parent_students", "specializations"}:
            self.validate_school()
        if self.resource.name in {
            "class_enrollments",
            "teaching_group_memberships",
        }:
            from server.modules.timetable.repository import SCHOOL_ZONE
            from server.modules.timetable.services import validate_published

            rows = [row for row in (data, old) if row]
            start = min(row["valid_from"] for row in rows)
            end = max(row["valid_to"] or date.max for row in rows)
            # Historical roster changes must still preserve student collisions,
            # but today's room properties cannot rewrite historical requirements.
            validate_published(
                self.repo, date_from=start, date_to=end, check_resources=False
            )
            validate_published(
                self.repo,
                date_from=max(start, utcnow().astimezone(SCHOOL_ZONE).date()),
                date_to=end,
            )

    def validate_school(self) -> None:
        years = self.repo.rows("school_years")
        years_by_id = {year["id"]: year for year in years}
        for i, year in enumerate(years):
            for other in years[i + 1 :]:
                conflict(
                    overlaps(
                        year["starts_on"],
                        year["ends_on"],
                        other["starts_on"],
                        other["ends_on"],
                    ),
                    "Školní roky se nesmějí překrývat.",
                )
        classes = {r["id"]: r for r in self.repo.rows("classes")}
        divisions = {r["id"]: r for r in self.repo.rows("group_divisions")}
        groups = {r["id"]: r for r in self.repo.rows("teaching_groups")}
        enrollments = self.repo.rows("class_enrollments")
        enrollments_by_student: dict[Any, list[dict[str, Any]]] = defaultdict(list)
        for enrollment in enrollments:
            enrollments_by_student[enrollment["student_id"]].append(enrollment)
        for row in enrollments:
            year = years_by_id[classes[row["class_id"]]["school_year_id"]]
            self.within_year(row["valid_from"], row["valid_to"], year)
            for other in enrollments_by_student[row["student_id"]]:
                if row["id"] == other["id"] or row["student_id"] != other["student_id"]:
                    continue
                conflict(
                    overlaps(
                        row["valid_from"],
                        row["valid_to"],
                        other["valid_from"],
                        other["valid_to"],
                    ),
                    "Žák už má v tomto období evidenční třídu.",
                )
        for division in divisions.values():
            year_id = classes[division["class_id"]]["school_year_id"]
            year = years_by_id[year_id]
            require(
                year["starts_on"] <= division["effective_from"] < year["ends_on"],
                "Dělení musí začít uvnitř školního roku.",
            )
        for group in groups.values():
            derived = group["membership_mode"] == "class_enrollment"
            require(
                (
                    derived
                    and group["source_class_id"] is not None
                    and group["division_id"] is None
                )
                or (not derived and group["source_class_id"] is None),
                "Neplatný zdroj členství skupiny.",
            )
            require(
                (group["division_id"] is None and group["position"] is None)
                or (
                    group["division_id"] is not None
                    and group["position"] is not None
                    and group["position"] > 0
                ),
                "Neplatná pozice skupiny v dělení.",
            )
            if derived:
                require(
                    classes[group["source_class_id"]]["school_year_id"]
                    == group["school_year_id"],
                    "Skupina a třída mají jiný školní rok.",
                )
            if group["division_id"]:
                division = divisions[group["division_id"]]
                require(
                    classes[division["class_id"]]["school_year_id"]
                    == group["school_year_id"],
                    "Dělení a skupina mají jiný školní rok.",
                )
        memberships = self.repo.rows("teaching_group_memberships")
        memberships_by_student: dict[Any, list[dict[str, Any]]] = defaultdict(list)
        for membership in memberships:
            memberships_by_student[membership["student_id"]].append(membership)
        for row in memberships:
            group = groups[row["group_id"]]
            require(
                group["membership_mode"] == "explicit",
                "Celá třída odvozuje členství z evidence tříd.",
            )
            year = years_by_id[group["school_year_id"]]
            self.within_year(row["valid_from"], row["valid_to"], year)
            if group["division_id"]:
                division = divisions[group["division_id"]]
                require(
                    row["valid_from"] >= division["effective_from"],
                    "Členství předchází dělení.",
                )
                require(
                    any(
                        e["student_id"] == row["student_id"]
                        and e["class_id"] == division["class_id"]
                        and e["valid_from"] <= row["valid_from"]
                        and (
                            e["valid_to"] is None
                            or (row["valid_to"] or year["ends_on"]) <= e["valid_to"]
                        )
                        for e in enrollments_by_student[row["student_id"]]
                    ),
                    "Členství v dělení musí pokrývat zařazení do zdrojové třídy.",
                )
            for other in memberships_by_student[row["student_id"]]:
                if row["id"] == other["id"] or row["student_id"] != other["student_id"]:
                    continue
                other_group = groups[other["group_id"]]
                same_division = group["division_id"] is not None and (
                    group["division_id"] == other_group["division_id"]
                )
                if row["group_id"] == other["group_id"] or same_division:
                    conflict(
                        overlaps(
                            row["valid_from"],
                            row["valid_to"],
                            other["valid_from"],
                            other["valid_to"],
                        ),
                        "Členství žáka ve skupině nebo dělení se překrývá.",
                    )
        seen: set[tuple[Any, Any]] = set()
        for rule in self.repo.rows("group_specialization_rules"):
            group = groups[rule["group_id"]]
            require(
                group["division_id"] is not None
                and divisions[group["division_id"]]["method"] == "specialization",
                "Pravidlo zaměření vyžaduje dělení podle zaměření.",
            )
            key = (group["division_id"], rule["specialization_id"])
            conflict(key in seen, "Zaměření už v dělení směruje do jiné skupiny.")
            seen.add(key)

    @staticmethod
    def within_year(start: date, end: date | None, year: dict[str, Any]) -> None:
        require(
            year["starts_on"] <= start < year["ends_on"],
            "Začátek intervalu je mimo školní rok.",
        )
        require(
            end is None or start < end <= year["ends_on"],
            "Konec intervalu je mimo školní rok.",
        )
