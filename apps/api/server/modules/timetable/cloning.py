"""Clone frozen teaching plans into independent, editable drafts."""

from typing import Any
from uuid import UUID, uuid4

from server.core.access.services import AccessContext
from server.core.domain.services import require

from .resources import RESOURCES
from .services import TimetableService


def clone_version(
    service: TimetableService,
    actor: AccessContext,
    version_id: UUID,
    name: str,
    plan_name: str,
) -> Any:
    def action(fresh: AccessContext) -> Any:
        repo = service.repo
        version = repo.one("timetable_versions", id=version_id)
        plan = repo.one("teaching_plans", id=version["teaching_plan_id"])
        mapping: dict[UUID, UUID] = {}
        new_plan_id = uuid4()
        mapping[plan["id"]] = new_plan_id

        def copy_row(table: str, row: dict[str, Any], **overrides: Any) -> Any:
            resource = next(r for r in RESOURCES if r.name == table)
            data = dict(row)
            for field in (
                "id",
                "created_at",
                "updated_at",
                "frozen_at",
                "published_at",
            ):
                data.pop(field, None)
            for field, value in list(data.items()):
                if isinstance(value, UUID) and value in mapping:
                    data[field] = mapping[value]
            if "id" in row:
                new_id = mapping.setdefault(row["id"], uuid4())
                data["id"] = new_id
            for field in ("created_by", "updated_by"):
                if field in resource.model.model_fields:
                    data[field] = fresh.user.id
            data.update(overrides)
            entity = resource.model.model_validate(data)
            repo.add(entity)
            repo.flush()
            TimetableService(repo.db, resource).audit(fresh, entity, "created", None)
            return entity

        copy_row("teaching_plans", plan, name=plan_name)
        for table in (
            "teaching_cycle_weeks",
            "teaching_cycle_steps",
            "teaching_plan_calendar_weeks",
            "teaching_plan_calendar_days",
            "teaching_assignments",
        ):
            for row in repo.rows(table, teaching_plan_id=plan["id"]):
                copy_row(table, row)
        assignments = {
            r["id"]
            for r in repo.rows("teaching_assignments", teaching_plan_id=plan["id"])
        }
        weeks = {
            r["id"]
            for r in repo.rows("teaching_cycle_weeks", teaching_plan_id=plan["id"])
        }
        for row in repo.rows("teaching_assignment_weeks"):
            if row["teaching_assignment_id"] in assignments:
                copy_row("teaching_assignment_weeks", row)
        blocks = [
            r for r in repo.rows("teaching_blocks") if r["cycle_week_id"] in weeks
        ]
        for block in blocks:
            copy_row("teaching_blocks", block)
            for row in repo.rows("teaching_block_members", block_id=block["id"]):
                copy_row("teaching_block_members", row)
        entity = copy_row(
            "timetable_versions",
            version,
            name=name,
            status="draft",
            based_on_version_id=version_id,
        )
        for table in ("timetable_entries", "timetable_preferences"):
            for row in repo.rows(table, timetable_version_id=version_id):
                copy_row(table, row)
        require(entity.teaching_plan_id == new_plan_id, "Kopie musí mít vlastní plán.")
        return entity

    return service.transaction(actor, "timetable.edit", action)
