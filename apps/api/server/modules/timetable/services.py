from collections import Counter
from datetime import date, timedelta
from typing import Any

from server.core.access.services import AccessContext
from server.core.domain.repository import DomainRepository
from server.core.domain.services import (
    DomainService,
    conflict,
    instant,
    overlaps,
    require,
)
from server.core.users.models import utcnow

from .cycles import cycle_type, mondays
from .models import TeachingPlanCalendarWeeks
from .repository import SCHOOL_ZONE, filtered_page, resolved_lessons


def validate_collisions(
    repo: DomainRepository,
    lessons: list[dict[str, Any]],
    *,
    check_unavailability: bool = True,
    check_resources: bool = True,
) -> None:
    rooms = {r["id"]: r for r in repo.rows("rooms")}
    assignments = {a["id"]: a for a in repo.rows("teaching_assignments")}
    entry_assignments = {
        e["id"]: e["teaching_assignment_id"] for e in repo.rows("timetable_entries")
    }
    teacher_unavailable = repo.rows("teacher_unavailability")
    room_unavailable = repo.rows("room_unavailability")
    ordered = sorted(lessons, key=lambda row: row["starts_at"])
    for index, row in enumerate(ordered):
        assignment = assignments[entry_assignments[row["timetable_entry_id"]]]
        required_type = assignment["required_room_type_code"]
        require(
            not check_resources or required_type is None or row["room_id"] is not None,
            "Výuka s požadovaným typem místnosti musí mít přiřazenou místnost.",
        )
        if row["room_id"] and check_resources:
            room = rooms[row["room_id"]]
            require(room["is_active"], "Místnost není aktivní.")
            require(room["capacity"] >= len(row["students"]), "Místnost nemá kapacitu.")
            require(
                required_type is None or room["room_type_code"] == required_type,
                "Nesprávný typ místnosti.",
            )
        for absence in teacher_unavailable if check_unavailability else []:
            conflict(
                absence["teacher_id"] == row["teacher_id"]
                and overlaps(
                    row["starts_at"],
                    row["ends_at"],
                    instant(absence["starts_at"]),
                    instant(absence["ends_at"]),
                ),
                "Učitel je v tomto termínu nedostupný.",
            )
        for absence in room_unavailable if check_unavailability else []:
            conflict(
                row["room_id"] is not None
                and absence["room_id"] == row["room_id"]
                and overlaps(
                    row["starts_at"],
                    row["ends_at"],
                    instant(absence["starts_at"]),
                    instant(absence["ends_at"]),
                ),
                "Místnost je v tomto termínu nedostupná.",
            )
        next_index = index + 1
        while next_index < len(ordered):
            other = ordered[next_index]
            if other["starts_at"] >= row["ends_at"]:
                break
            shared = (
                row["teacher_id"] == other["teacher_id"]
                or (row["room_id"] is not None and row["room_id"] == other["room_id"])
                or row["group_id"] == other["group_id"]
                or bool(row["students"] & other["students"])
            )
            conflict(shared, "Kolize učitele, místnosti nebo žáků v termínu výuky.")
            next_index += 1


def validate_published(
    repo: DomainRepository,
    *,
    date_from: date | None = None,
    date_to: date | None = None,
    check_resources: bool = True,
) -> None:
    if date_from is None:
        date_from = utcnow().astimezone(SCHOOL_ZONE).date()
    published_plans = {
        v["teaching_plan_id"]
        for v in repo.rows("timetable_versions")
        if v["status"] != "draft"
    }
    plans = {p["id"]: p for p in repo.rows("teaching_plans")}
    groups = {g["id"]: g for g in repo.rows("teaching_groups")}
    for assignment in repo.rows("teaching_assignments"):
        if assignment["teaching_plan_id"] in published_plans:
            require(
                groups[assignment["group_id"]]["school_year_id"]
                == plans[assignment["teaching_plan_id"]]["school_year_id"],
                "Skupina publikovaného plánu má jiný školní rok.",
            )
    validate_collisions(
        repo,
        resolved_lessons(repo, date_from=date_from, date_to=date_to),
        check_unavailability=False,
        check_resources=check_resources,
    )


class TimetableService(DomainService):
    def list_filtered(
        self, actor: AccessContext, offset: int, limit: int, **filters: Any
    ) -> list[Any]:
        self.access.require(actor, self.resource.permission)
        return filtered_page(self.repo, self.resource.model, offset, limit, **filters)

    def plan_for(self, name: str, data: dict[str, Any]) -> dict[str, Any] | None:
        if name == "teaching_plans":
            return data
        if "teaching_plan_id" in data:
            return self.repo.one("teaching_plans", id=data["teaching_plan_id"])
        if name == "teaching_assignment_weeks":
            assignment = self.repo.one(
                "teaching_assignments", id=data["teaching_assignment_id"]
            )
            return self.repo.one("teaching_plans", id=assignment["teaching_plan_id"])
        if name in {"teaching_blocks", "teaching_block_members"}:
            week = self.repo.one("teaching_cycle_weeks", id=data["cycle_week_id"])
            return self.repo.one("teaching_plans", id=week["teaching_plan_id"])
        return None

    def frozen(self, data: dict[str, Any]) -> None:
        name = self.resource.name
        plan = self.plan_for(name, data)
        # An unfrozen draft version can be created against an already frozen plan.
        if plan and name != "timetable_versions":
            conflict(plan.get("frozen_at") is not None, "Plán výuky je zmrazený.")
        if name == "timetable_versions":
            conflict(
                data.get("status", "draft") != "draft", "Publikovaná verze je neměnná."
            )
        if name in {"timetable_entries", "timetable_preferences"}:
            version = self.repo.one(
                "timetable_versions", id=data["timetable_version_id"]
            )
            conflict(version["status"] != "draft", "Publikovaná verze je neměnná.")
        if name == "time_grids":
            conflict(data.get("frozen_at") is not None, "Zvonění je zmrazené.")
        if name == "time_slots":
            grid = self.repo.one("time_grids", id=data["time_grid_id"])
            conflict(grid["frozen_at"] is not None, "Zvonění je zmrazené.")

    def validate(
        self,
        data: dict[str, Any],
        old: dict[str, Any] | None,
        actor: AccessContext,
    ) -> None:
        super().validate(data, old, actor)
        name = self.resource.name
        self.frozen(data)
        if old:
            self.frozen(old)
        if name == "teaching_plans":
            self.repo.one("school_years", id=data["school_year_id"])
        if name in {"teaching_cycle_steps", "teaching_plan_calendar_weeks"}:
            week = self.repo.one("teaching_cycle_weeks", id=data["cycle_week_id"])
            require(
                week["teaching_plan_id"] == data["teaching_plan_id"],
                "Typ týdne patří do jiného plánu.",
            )
        if name in {"teaching_plan_calendar_weeks", "teaching_plan_calendar_days"}:
            plan = self.repo.one("teaching_plans", id=data["teaching_plan_id"])
            year = self.repo.one("school_years", id=plan["school_year_id"])
            if name.endswith("weeks"):
                require(
                    data["week_starts_on"]
                    in mondays(year["starts_on"], year["ends_on"]),
                    "Týden nezasahuje do školního roku.",
                )
                if not data.get("is_override"):
                    expected = cycle_type(
                        plan["cycle_anchor_monday"],
                        data["week_starts_on"],
                        self.repo.rows(
                            "teaching_cycle_steps", teaching_plan_id=plan["id"]
                        ),
                    )
                    require(
                        data["cycle_week_id"] == expected,
                        "Automatický týden neodpovídá cyklu.",
                    )
            else:
                require(
                    year["starts_on"] <= data["calendar_date"] < year["ends_on"],
                    "Datum je mimo školní rok.",
                )
        if name == "teaching_assignments":
            plan = self.repo.one("teaching_plans", id=data["teaching_plan_id"])
            group = self.repo.one("teaching_groups", id=data["group_id"])
            require(
                group["school_year_id"] == plan["school_year_id"],
                "Skupina má jiný školní rok.",
            )
        if name == "teaching_assignment_weeks":
            assignment = self.repo.one(
                "teaching_assignments", id=data["teaching_assignment_id"]
            )
            week = self.repo.one("teaching_cycle_weeks", id=data["cycle_week_id"])
            require(
                assignment["teaching_plan_id"] == week["teaching_plan_id"],
                "Zadání a týden mají jiný plán.",
            )
        if name == "teaching_block_members":
            block = self.repo.one("teaching_blocks", id=data["block_id"])
            require(
                block["cycle_week_id"] == data["cycle_week_id"],
                "Blok má jiný typ týdne.",
            )
            assignment = self.repo.one(
                "teaching_assignments", id=data["teaching_assignment_id"]
            )
            week = self.repo.one("teaching_cycle_weeks", id=data["cycle_week_id"])
            require(
                assignment["teaching_plan_id"] == week["teaching_plan_id"],
                "Blok a zadání mají jiný plán.",
            )
        if name == "time_slots":
            for slot in self.repo.rows("time_slots", time_grid_id=data["time_grid_id"]):
                if old and slot["id"] == old["id"]:
                    continue
                conflict(
                    overlaps(
                        data["start_time"],
                        data["end_time"],
                        slot["start_time"],
                        slot["end_time"],
                    ),
                    "Sloty zvonění se překrývají.",
                )
        if name == "timetable_versions":
            if data.get("valid_to") is None:
                plan = self.repo.one("teaching_plans", id=data["teaching_plan_id"])
                year = self.repo.one("school_years", id=plan["school_year_id"])
                data["valid_to"] = year["ends_on"]
            require(data.get("status", "draft") == "draft", "Použij akci publikování.")
            require(
                data.get("based_on_version_id") != data.get("id")
                or data.get("id") is None,
                "Verze nemůže vycházet ze sebe.",
            )
            if data.get("based_on_version_id"):
                base = self.repo.one(
                    "timetable_versions", id=data["based_on_version_id"]
                )
                base_plan = self.repo.one("teaching_plans", id=base["teaching_plan_id"])
                plan = self.repo.one("teaching_plans", id=data["teaching_plan_id"])
                require(
                    base_plan["school_year_id"] == plan["school_year_id"],
                    "Původní verze má jiný školní rok.",
                )
        if name == "timetable_entries":
            if old:
                require(
                    data.get("expected_state") is not None,
                    "Pošli expected_state z načtené položky rozvrhu.",
                )
                conflict(
                    data["expected_state"] != old,
                    "Položku mezitím změnil jiný uživatel. Načti aktuální verzi.",
                )
            self.validate_entry(data)
        if name == "timetable_preferences":
            require(
                data["code"]
                in {"minimize_gaps", "minimize_transfers", "prefer_home_room"},
                "Nepodporovaná preference.",
            )
            require(
                data["weight"] is not None and data["weight"] >= 0,
                "Váha musí být nezáporná.",
            )
        if "teacher_id" in data and (
            old is None or old.get("teacher_id") != data["teacher_id"]
        ):
            self.user_role(data["teacher_id"], "teacher")
        if name == "lesson_occurrences":
            require(old is None, "Identita konkrétní hodiny je neměnná.")
            entry = self.repo.one("timetable_entries", id=data["timetable_entry_id"])
            version = self.repo.one(
                "timetable_versions", id=entry["timetable_version_id"]
            )
            require(
                version["status"] in {"published", "archived"},
                "Hodina vyžaduje publikovanou verzi.",
            )
            lessons = resolved_lessons(self.repo, [version])
            require(
                any(
                    r["timetable_entry_id"] == entry["id"]
                    and r["scheduled_date"] == data["scheduled_date"]
                    for r in lessons
                ),
                "Datum neodpovídá výukovému dni, cyklu nebo platnosti rozvrhu.",
            )
        if name == "lesson_changes":
            self.access.require(actor, "timetable.substitute")
            self.validate_change(data, old)

    def validate_entry(self, data: dict[str, Any]) -> None:
        version = self.repo.one("timetable_versions", id=data["timetable_version_id"])
        assignment = self.repo.one(
            "teaching_assignments", id=data["teaching_assignment_id"]
        )
        week = self.repo.one("teaching_cycle_weeks", id=data["cycle_week_id"])
        slot = self.repo.one("time_slots", id=data["time_slot_id"])
        require(
            version["teaching_plan_id"]
            == assignment["teaching_plan_id"]
            == week["teaching_plan_id"],
            "Verze, zadání a typ týdne musí mít stejný plán.",
        )
        require(
            slot["time_grid_id"] == version["time_grid_id"],
            "Slot patří do jiného zvonění.",
        )
        self.repo.one(
            "teaching_assignment_weeks",
            teaching_assignment_id=assignment["id"],
            cycle_week_id=week["id"],
        )
        if data["room_id"]:
            room = self.repo.one("rooms", id=data["room_id"])
            require(room["is_active"], "Místnost není aktivní.")

    def validate_change(self, data: dict[str, Any], old: dict[str, Any] | None) -> None:
        occurrence = self.repo.one(
            "lesson_occurrences", id=data["lesson_occurrence_id"]
        )
        if old:
            require(
                old["lesson_occurrence_id"] == occurrence["id"],
                "Nelze změnit identitu hodiny.",
            )
        entry = self.repo.one("timetable_entries", id=occurrence["timetable_entry_id"])
        version = self.repo.one("timetable_versions", id=entry["timetable_version_id"])
        conflict(
            bool(
                self.repo.rows(
                    "classbook_entries", lesson_occurrence_id=occurrence["id"]
                )
            ),
            "Výuka už má zápis v třídnici; změň skutečnost oprávněnou opravou.",
        )
        if data.get("replacement_teacher_id"):
            self.user_role(data["replacement_teacher_id"], "teacher")
        if data.get("replacement_time_slot_id"):
            slot = self.repo.one("time_slots", id=data["replacement_time_slot_id"])
            require(
                slot["time_grid_id"] == version["time_grid_id"],
                "Náhradní slot má jiné zvonění.",
            )
        if data.get("replacement_date"):
            plan = self.repo.one("teaching_plans", id=version["teaching_plan_id"])
            year = self.repo.one("school_years", id=plan["school_year_id"])
            require(
                year["starts_on"] <= data["replacement_date"] < year["ends_on"],
                "Přesun je mimo školní rok.",
            )
        if data.get("replacement_room_id"):
            room = self.repo.one("rooms", id=data["replacement_room_id"])
            require(room["is_active"], "Náhradní místnost není aktivní.")
        if data["change_type"] == "cancelled":
            require(
                not any(
                    data.get(k)
                    for k in (
                        "replacement_teacher_id",
                        "room_changed",
                        "replacement_room_id",
                        "replacement_date",
                        "replacement_time_slot_id",
                    )
                ),
                "Zrušená hodina nesmí mít náhrady.",
            )
        else:
            require(
                any(
                    data.get(k)
                    for k in (
                        "replacement_teacher_id",
                        "room_changed",
                        "replacement_date",
                        "replacement_time_slot_id",
                    )
                ),
                "Změna je prázdná.",
            )
        require(
            data.get("room_changed") or data.get("replacement_room_id") is None,
            "Náhradní místnost vyžaduje room_changed.",
        )

    def validate_delete(self, old: dict[str, Any], actor: AccessContext) -> None:
        self.frozen(old)
        if self.resource.name == "lesson_changes":
            self.access.require(actor, "timetable.substitute")
            self.validate_change(old, old)
        if self.resource.name == "lesson_occurrences":
            conflict(True, "Konkrétní hodiny tvoří historii a nemažou se.")

    def after_write(
        self,
        data: dict[str, Any] | None,
        old: dict[str, Any] | None,
        actor: AccessContext,
    ) -> None:
        name = self.resource.name
        if name in {"teaching_cycle_steps", "teaching_plans"}:
            rows = [row for row in (data, old) if row]
            plan_ids = {
                row["id"] if name == "teaching_plans" else row["teaching_plan_id"]
                for row in rows
            }
            for plan_id in plan_ids:
                if self.repo.rows("teaching_plans", id=plan_id):
                    self.regenerate_calendar(plan_id, allow_incomplete=True)
        if name == "lesson_changes":
            # Absence is a fact that may have unresolved substitutions. Keep
            # timetable collisions strict without rejecting unrelated absences.
            change = data or old
            assert change is not None
            occurrence = self.repo.one(
                "lesson_occurrences", id=change["lesson_occurrence_id"]
            )
            dates = {occurrence["scheduled_date"]}
            dates.update(
                row["replacement_date"]
                for row in (data, old)
                if row and row.get("replacement_date") is not None
            )
            lessons = resolved_lessons(
                self.repo, date_from=min(dates), date_to=max(dates) + timedelta(days=1)
            )
            validate_collisions(
                self.repo, lessons, check_unavailability=False, check_resources=False
            )
            if data and data["change_type"] != "cancelled":
                affected = [
                    row
                    for row in lessons
                    if row["lesson_occurrence_id"] == occurrence["id"]
                ]
                validate_collisions(self.repo, affected)

    def regenerate_calendar(
        self, plan_id: Any, *, allow_incomplete: bool = False
    ) -> None:
        plan = self.repo.one("teaching_plans", id=plan_id)
        conflict(plan["frozen_at"] is not None, "Plán výuky je zmrazený.")
        steps = self.repo.rows("teaching_cycle_steps", teaching_plan_id=plan_id)
        self.repo.remove_rows(
            "teaching_plan_calendar_weeks", teaching_plan_id=plan_id, is_override=False
        )
        positions = sorted(s["position"] for s in steps)
        complete = positions == list(range(1, len(steps) + 1)) and bool(steps)
        if allow_incomplete and not complete:
            return
        require(complete, "Cyklus musí mít kroky souvisle očíslované od 1.")
        year = self.repo.one("school_years", id=plan["school_year_id"])
        overrides = {
            r["week_starts_on"]
            for r in self.repo.rows(
                "teaching_plan_calendar_weeks", teaching_plan_id=plan_id
            )
        }
        for monday in mondays(year["starts_on"], year["ends_on"]):
            if monday not in overrides:
                self.repo.add(
                    TeachingPlanCalendarWeeks(
                        teaching_plan_id=plan_id,
                        week_starts_on=monday,
                        cycle_week_id=cycle_type(
                            plan["cycle_anchor_monday"], monday, steps
                        ),
                    )
                )
        self.repo.flush()

    def validate_publication(self, version: dict[str, Any]) -> None:
        plan = self.repo.one("teaching_plans", id=version["teaching_plan_id"])
        year = self.repo.one("school_years", id=plan["school_year_id"])
        start, end = version["valid_from"], version["valid_to"]
        require(
            start is not None and year["starts_on"] <= start < year["ends_on"],
            "Neplatný začátek platnosti.",
        )
        require(
            end is None or start < end <= year["ends_on"], "Neplatný konec platnosti."
        )
        for other in self.repo.rows("timetable_versions"):
            if other["id"] == version["id"] or other["status"] == "draft":
                continue
            other_plan = self.repo.one("teaching_plans", id=other["teaching_plan_id"])
            if other_plan["school_year_id"] == plan["school_year_id"]:
                conflict(
                    overlaps(
                        start,
                        end or year["ends_on"],
                        other["valid_from"],
                        other["valid_to"] or year["ends_on"],
                    ),
                    "Platnost publikovaných verzí se překrývá.",
                )
        steps = self.repo.rows("teaching_cycle_steps", teaching_plan_id=plan["id"])
        calendar = self.repo.rows(
            "teaching_plan_calendar_weeks", teaching_plan_id=plan["id"]
        )
        require(
            {w["week_starts_on"] for w in calendar}
            == set(mondays(year["starts_on"], year["ends_on"])),
            "Kalendář není úplný.",
        )
        for week in calendar:
            expected = cycle_type(
                plan["cycle_anchor_monday"], week["week_starts_on"], steps
            )
            require(
                week["is_override"] or week["cycle_week_id"] == expected,
                "Kalendář neodpovídá cyklu.",
            )
        assignments = self.repo.rows(
            "teaching_assignments", teaching_plan_id=plan["id"]
        )
        entries = self.repo.rows(
            "timetable_entries", timetable_version_id=version["id"]
        )
        require(bool(assignments), "Plán musí obsahovat zadání výuky.")
        counts = Counter(
            (e["teaching_assignment_id"], e["cycle_week_id"]) for e in entries
        )
        expected_counts = {}
        for assignment in assignments:
            self.user_role(assignment["teacher_id"], "teacher")
            loads = self.repo.rows(
                "teaching_assignment_weeks", teaching_assignment_id=assignment["id"]
            )
            require(
                bool(loads), "Každé zadání musí mít rozsah alespoň pro jeden typ týdne."
            )
            for load in loads:
                expected_counts[(assignment["id"], load["cycle_week_id"])] = load[
                    "periods"
                ]
        require(
            dict(counts) == expected_counts,
            "Počet hodin neodpovídá úvazkům jednotlivých typů týdnů.",
        )
        for entry in entries:
            self.validate_entry(entry)
        for block in self.repo.rows("teaching_blocks"):
            week = self.repo.one("teaching_cycle_weeks", id=block["cycle_week_id"])
            if week["teaching_plan_id"] != plan["id"]:
                continue
            members = self.repo.rows("teaching_block_members", block_id=block["id"])
            require(
                len(members) >= 2, "Synchronizační blok musí mít alespoň dvě zadání."
            )
            terms = [
                {
                    (e["day_of_week"], e["time_slot_id"])
                    for e in entries
                    if e["teaching_assignment_id"] == m["teaching_assignment_id"]
                    and e["cycle_week_id"] == block["cycle_week_id"]
                }
                for m in members
            ]
            require(
                all(t == terms[0] for t in terms),
                "Výuky v synchronizačním bloku mají různé termíny.",
            )
        others = [
            v
            for v in self.repo.rows("timetable_versions")
            if v["status"] != "draft" and v["id"] != version["id"]
        ]
        validate_collisions(self.repo, resolved_lessons(self.repo, [version]))
        validate_collisions(
            self.repo,
            resolved_lessons(self.repo, [*others, version]),
            check_unavailability=False,
            check_resources=False,
        )

    def publish(self, actor: AccessContext, key: dict[str, Any]) -> Any:
        def action(fresh: AccessContext) -> Any:
            entity = self.repo.entity(self.resource.model, key)
            old = entity.model_dump()
            require(old["status"] == "draft", "Publikovat lze pouze návrh.")
            self.validate_publication(old)
            entity.status = "published"
            entity.published_at = utcnow()
            for table, identity in (
                ("teaching_plans", old["teaching_plan_id"]),
                ("time_grids", old["time_grid_id"]),
                ("room_distance_models", old["distance_model_id"]),
            ):
                self.freeze_parent(table, identity)
            self.repo.flush()
            self.audit(fresh, entity, "updated", old)
            return entity

        return self.transaction(actor, "timetable.publish", action)

    def freeze_parent(self, name: str, identity: Any) -> None:
        # Keep writes in the repository while resolving model classes lazily.
        from server.modules.rooms.resources import RESOURCES as rooms

        from .resources import RESOURCES

        resource = next(r for r in [*RESOURCES, *rooms] if r.name == name)
        parent = self.repo.entity(resource.model, {"id": identity})
        if parent.model_dump()["frozen_at"] is None:
            parent.frozen_at = utcnow()

    def close(self, actor: AccessContext, key: dict[str, Any], valid_to: Any) -> Any:
        def action(fresh: AccessContext) -> Any:
            entity = self.repo.entity(self.resource.model, key)
            old = entity.model_dump()
            require(old["status"] == "published", "Ukončit lze publikovanou verzi.")
            plan = self.repo.one("teaching_plans", id=old["teaching_plan_id"])
            year = self.repo.one("school_years", id=plan["school_year_id"])
            require(
                old["valid_from"] < valid_to
                and valid_to <= year["ends_on"]
                and (old["valid_to"] is None or valid_to <= old["valid_to"]),
                "Platnost lze pouze zkrátit.",
            )
            entry_ids = {
                r["id"]
                for r in self.repo.rows(
                    "timetable_entries", timetable_version_id=old["id"]
                )
            }
            conflict(
                any(
                    o["timetable_entry_id"] in entry_ids
                    and o["scheduled_date"] >= valid_to
                    for o in self.repo.rows("lesson_occurrences")
                ),
                "Ukončení by odřízlo existující konkrétní hodiny.",
            )
            entity.valid_to = valid_to
            entity.status = "archived"
            self.repo.flush()
            self.audit(fresh, entity, "updated", old)
            return entity

        return self.transaction(actor, "timetable.publish", action)
