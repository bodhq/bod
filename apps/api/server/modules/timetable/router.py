from datetime import date
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response

from server.core.auth.dependencies import (
    CurrentContextDep,
    SessionDep,
    mutation_guard,
    no_store,
)
from server.core.domain.router import ERROR_RESPONSES, Pagination

from . import schemas as schemas
from .resources import RESOURCES
from .services import TimetableService

router = APIRouter(
    prefix="/timetable",
    tags=["timetable"],
    dependencies=[Depends(mutation_guard), Depends(no_store)],
    responses=ERROR_RESPONSES,
)


@router.get("/teaching-plans", response_model=list[schemas.TeachingPlansRead])
def list_teaching_plans(
    context: CurrentContextDep,
    session: SessionDep,
    page: Annotated[schemas.TeachingPlansFilter, Query()],
) -> object:
    return TimetableService(
        session, next(r for r in RESOURCES if r.name == "teaching_plans")
    ).list_filtered(
        context, page.offset, page.limit, school_year_id=page.school_year_id
    )


@router.get("/teaching-plans/{id}", response_model=schemas.TeachingPlansRead)
def get_teaching_plans(
    id: UUID, context: CurrentContextDep, session: SessionDep
) -> object:
    return TimetableService(
        session, next(r for r in RESOURCES if r.name == "teaching_plans")
    ).get(context, {"id": id})


@router.post(
    "/teaching-plans", response_model=schemas.TeachingPlansRead, status_code=201
)
def create_teaching_plans(
    payload: schemas.TeachingPlansCreate,
    context: CurrentContextDep,
    session: SessionDep,
) -> object:
    return TimetableService(
        session, next(r for r in RESOURCES if r.name == "teaching_plans")
    ).create(context, payload)


@router.patch("/teaching-plans/{id}", response_model=schemas.TeachingPlansRead)
def patch_teaching_plans(
    id: UUID,
    payload: schemas.TeachingPlansPatch,
    context: CurrentContextDep,
    session: SessionDep,
) -> object:
    return TimetableService(
        session, next(r for r in RESOURCES if r.name == "teaching_plans")
    ).patch(context, {"id": id}, payload)


@router.delete("/teaching-plans/{id}", status_code=204)
def delete_teaching_plans(
    id: UUID, context: CurrentContextDep, session: SessionDep
) -> Response:
    TimetableService(
        session, next(r for r in RESOURCES if r.name == "teaching_plans")
    ).delete(context, {"id": id})
    return Response(status_code=204)


@router.get(
    "/teaching-assignments", response_model=list[schemas.TeachingAssignmentsRead]
)
def list_teaching_assignments(
    context: CurrentContextDep,
    session: SessionDep,
    page: Annotated[schemas.TeachingAssignmentsFilter, Query()],
) -> object:
    return TimetableService(
        session, next(r for r in RESOURCES if r.name == "teaching_assignments")
    ).list_filtered(
        context,
        page.offset,
        page.limit,
        teaching_plan_id=page.teaching_plan_id,
        group_id=page.group_id,
        teacher_id=page.teacher_id,
    )


@router.get(
    "/teaching-assignments/{id}", response_model=schemas.TeachingAssignmentsRead
)
def get_teaching_assignments(
    id: UUID, context: CurrentContextDep, session: SessionDep
) -> object:
    return TimetableService(
        session, next(r for r in RESOURCES if r.name == "teaching_assignments")
    ).get(context, {"id": id})


@router.post(
    "/teaching-assignments",
    response_model=schemas.TeachingAssignmentsRead,
    status_code=201,
)
def create_teaching_assignments(
    payload: schemas.TeachingAssignmentsCreate,
    context: CurrentContextDep,
    session: SessionDep,
) -> object:
    return TimetableService(
        session, next(r for r in RESOURCES if r.name == "teaching_assignments")
    ).create(context, payload)


@router.patch(
    "/teaching-assignments/{id}", response_model=schemas.TeachingAssignmentsRead
)
def patch_teaching_assignments(
    id: UUID,
    payload: schemas.TeachingAssignmentsPatch,
    context: CurrentContextDep,
    session: SessionDep,
) -> object:
    return TimetableService(
        session, next(r for r in RESOURCES if r.name == "teaching_assignments")
    ).patch(context, {"id": id}, payload)


@router.delete("/teaching-assignments/{id}", status_code=204)
def delete_teaching_assignments(
    id: UUID, context: CurrentContextDep, session: SessionDep
) -> Response:
    TimetableService(
        session, next(r for r in RESOURCES if r.name == "teaching_assignments")
    ).delete(context, {"id": id})
    return Response(status_code=204)


@router.get(
    "/teaching-cycle-weeks", response_model=list[schemas.TeachingCycleWeeksRead]
)
def list_teaching_cycle_weeks(
    context: CurrentContextDep,
    session: SessionDep,
    page: Annotated[schemas.TeachingCycleWeeksFilter, Query()],
) -> object:
    return TimetableService(
        session, next(r for r in RESOURCES if r.name == "teaching_cycle_weeks")
    ).list_filtered(
        context, page.offset, page.limit, teaching_plan_id=page.teaching_plan_id
    )


@router.get("/teaching-cycle-weeks/{id}", response_model=schemas.TeachingCycleWeeksRead)
def get_teaching_cycle_weeks(
    id: UUID, context: CurrentContextDep, session: SessionDep
) -> object:
    return TimetableService(
        session, next(r for r in RESOURCES if r.name == "teaching_cycle_weeks")
    ).get(context, {"id": id})


@router.post(
    "/teaching-cycle-weeks",
    response_model=schemas.TeachingCycleWeeksRead,
    status_code=201,
)
def create_teaching_cycle_weeks(
    payload: schemas.TeachingCycleWeeksCreate,
    context: CurrentContextDep,
    session: SessionDep,
) -> object:
    return TimetableService(
        session, next(r for r in RESOURCES if r.name == "teaching_cycle_weeks")
    ).create(context, payload)


@router.patch(
    "/teaching-cycle-weeks/{id}", response_model=schemas.TeachingCycleWeeksRead
)
def patch_teaching_cycle_weeks(
    id: UUID,
    payload: schemas.TeachingCycleWeeksPatch,
    context: CurrentContextDep,
    session: SessionDep,
) -> object:
    return TimetableService(
        session, next(r for r in RESOURCES if r.name == "teaching_cycle_weeks")
    ).patch(context, {"id": id}, payload)


@router.delete("/teaching-cycle-weeks/{id}", status_code=204)
def delete_teaching_cycle_weeks(
    id: UUID, context: CurrentContextDep, session: SessionDep
) -> Response:
    TimetableService(
        session, next(r for r in RESOURCES if r.name == "teaching_cycle_weeks")
    ).delete(context, {"id": id})
    return Response(status_code=204)


@router.get(
    "/teaching-cycle-steps", response_model=list[schemas.TeachingCycleStepsRead]
)
def list_teaching_cycle_steps(
    context: CurrentContextDep,
    session: SessionDep,
    page: Annotated[Pagination, Query()],
) -> object:
    return TimetableService(
        session, next(r for r in RESOURCES if r.name == "teaching_cycle_steps")
    ).list(context, page.offset, page.limit)


@router.get("/teaching-cycle-steps/{id}", response_model=schemas.TeachingCycleStepsRead)
def get_teaching_cycle_steps(
    id: UUID, context: CurrentContextDep, session: SessionDep
) -> object:
    return TimetableService(
        session, next(r for r in RESOURCES if r.name == "teaching_cycle_steps")
    ).get(context, {"id": id})


@router.post(
    "/teaching-cycle-steps",
    response_model=schemas.TeachingCycleStepsRead,
    status_code=201,
)
def create_teaching_cycle_steps(
    payload: schemas.TeachingCycleStepsCreate,
    context: CurrentContextDep,
    session: SessionDep,
) -> object:
    return TimetableService(
        session, next(r for r in RESOURCES if r.name == "teaching_cycle_steps")
    ).create(context, payload)


@router.patch(
    "/teaching-cycle-steps/{id}", response_model=schemas.TeachingCycleStepsRead
)
def patch_teaching_cycle_steps(
    id: UUID,
    payload: schemas.TeachingCycleStepsPatch,
    context: CurrentContextDep,
    session: SessionDep,
) -> object:
    return TimetableService(
        session, next(r for r in RESOURCES if r.name == "teaching_cycle_steps")
    ).patch(context, {"id": id}, payload)


@router.delete("/teaching-cycle-steps/{id}", status_code=204)
def delete_teaching_cycle_steps(
    id: UUID, context: CurrentContextDep, session: SessionDep
) -> Response:
    TimetableService(
        session, next(r for r in RESOURCES if r.name == "teaching_cycle_steps")
    ).delete(context, {"id": id})
    return Response(status_code=204)


@router.get(
    "/teaching-plan-calendar-weeks",
    response_model=list[schemas.TeachingPlanCalendarWeeksRead],
)
def list_teaching_plan_calendar_weeks(
    context: CurrentContextDep,
    session: SessionDep,
    page: Annotated[Pagination, Query()],
) -> object:
    return TimetableService(
        session, next(r for r in RESOURCES if r.name == "teaching_plan_calendar_weeks")
    ).list(context, page.offset, page.limit)


@router.get(
    "/teaching-plan-calendar-weeks/{teaching_plan_id}/{week_starts_on}",
    response_model=schemas.TeachingPlanCalendarWeeksRead,
)
def get_teaching_plan_calendar_weeks(
    teaching_plan_id: UUID,
    week_starts_on: date,
    context: CurrentContextDep,
    session: SessionDep,
) -> object:
    return TimetableService(
        session, next(r for r in RESOURCES if r.name == "teaching_plan_calendar_weeks")
    ).get(
        context,
        {"teaching_plan_id": teaching_plan_id, "week_starts_on": week_starts_on},
    )


@router.post(
    "/teaching-plan-calendar-weeks",
    response_model=schemas.TeachingPlanCalendarWeeksRead,
    status_code=201,
)
def create_teaching_plan_calendar_weeks(
    payload: schemas.TeachingPlanCalendarWeeksCreate,
    context: CurrentContextDep,
    session: SessionDep,
) -> object:
    return TimetableService(
        session, next(r for r in RESOURCES if r.name == "teaching_plan_calendar_weeks")
    ).create(context, payload)


@router.patch(
    "/teaching-plan-calendar-weeks/{teaching_plan_id}/{week_starts_on}",
    response_model=schemas.TeachingPlanCalendarWeeksRead,
)
def patch_teaching_plan_calendar_weeks(
    teaching_plan_id: UUID,
    week_starts_on: date,
    payload: schemas.TeachingPlanCalendarWeeksPatch,
    context: CurrentContextDep,
    session: SessionDep,
) -> object:
    return TimetableService(
        session, next(r for r in RESOURCES if r.name == "teaching_plan_calendar_weeks")
    ).patch(
        context,
        {"teaching_plan_id": teaching_plan_id, "week_starts_on": week_starts_on},
        payload,
    )


@router.delete(
    "/teaching-plan-calendar-weeks/{teaching_plan_id}/{week_starts_on}", status_code=204
)
def delete_teaching_plan_calendar_weeks(
    teaching_plan_id: UUID,
    week_starts_on: date,
    context: CurrentContextDep,
    session: SessionDep,
) -> Response:
    TimetableService(
        session, next(r for r in RESOURCES if r.name == "teaching_plan_calendar_weeks")
    ).delete(
        context,
        {"teaching_plan_id": teaching_plan_id, "week_starts_on": week_starts_on},
    )
    return Response(status_code=204)


@router.get(
    "/teaching-plan-calendar-days",
    response_model=list[schemas.TeachingPlanCalendarDaysRead],
)
def list_teaching_plan_calendar_days(
    context: CurrentContextDep,
    session: SessionDep,
    page: Annotated[Pagination, Query()],
) -> object:
    return TimetableService(
        session, next(r for r in RESOURCES if r.name == "teaching_plan_calendar_days")
    ).list(context, page.offset, page.limit)


@router.get(
    "/teaching-plan-calendar-days/{teaching_plan_id}/{calendar_date}",
    response_model=schemas.TeachingPlanCalendarDaysRead,
)
def get_teaching_plan_calendar_days(
    teaching_plan_id: UUID,
    calendar_date: date,
    context: CurrentContextDep,
    session: SessionDep,
) -> object:
    return TimetableService(
        session, next(r for r in RESOURCES if r.name == "teaching_plan_calendar_days")
    ).get(
        context, {"teaching_plan_id": teaching_plan_id, "calendar_date": calendar_date}
    )


@router.post(
    "/teaching-plan-calendar-days",
    response_model=schemas.TeachingPlanCalendarDaysRead,
    status_code=201,
)
def create_teaching_plan_calendar_days(
    payload: schemas.TeachingPlanCalendarDaysCreate,
    context: CurrentContextDep,
    session: SessionDep,
) -> object:
    return TimetableService(
        session, next(r for r in RESOURCES if r.name == "teaching_plan_calendar_days")
    ).create(context, payload)


@router.patch(
    "/teaching-plan-calendar-days/{teaching_plan_id}/{calendar_date}",
    response_model=schemas.TeachingPlanCalendarDaysRead,
)
def patch_teaching_plan_calendar_days(
    teaching_plan_id: UUID,
    calendar_date: date,
    payload: schemas.TeachingPlanCalendarDaysPatch,
    context: CurrentContextDep,
    session: SessionDep,
) -> object:
    return TimetableService(
        session, next(r for r in RESOURCES if r.name == "teaching_plan_calendar_days")
    ).patch(
        context,
        {"teaching_plan_id": teaching_plan_id, "calendar_date": calendar_date},
        payload,
    )


@router.delete(
    "/teaching-plan-calendar-days/{teaching_plan_id}/{calendar_date}", status_code=204
)
def delete_teaching_plan_calendar_days(
    teaching_plan_id: UUID,
    calendar_date: date,
    context: CurrentContextDep,
    session: SessionDep,
) -> Response:
    TimetableService(
        session, next(r for r in RESOURCES if r.name == "teaching_plan_calendar_days")
    ).delete(
        context, {"teaching_plan_id": teaching_plan_id, "calendar_date": calendar_date}
    )
    return Response(status_code=204)


@router.get(
    "/teaching-assignment-weeks",
    response_model=list[schemas.TeachingAssignmentWeeksRead],
)
def list_teaching_assignment_weeks(
    context: CurrentContextDep,
    session: SessionDep,
    page: Annotated[schemas.TeachingAssignmentWeeksFilter, Query()],
) -> object:
    return TimetableService(
        session, next(r for r in RESOURCES if r.name == "teaching_assignment_weeks")
    ).list_filtered(
        context,
        page.offset,
        page.limit,
        teaching_assignment_id=page.teaching_assignment_id,
    )


@router.get(
    "/teaching-assignment-weeks/{teaching_assignment_id}/{cycle_week_id}",
    response_model=schemas.TeachingAssignmentWeeksRead,
)
def get_teaching_assignment_weeks(
    teaching_assignment_id: UUID,
    cycle_week_id: UUID,
    context: CurrentContextDep,
    session: SessionDep,
) -> object:
    return TimetableService(
        session, next(r for r in RESOURCES if r.name == "teaching_assignment_weeks")
    ).get(
        context,
        {
            "teaching_assignment_id": teaching_assignment_id,
            "cycle_week_id": cycle_week_id,
        },
    )


@router.post(
    "/teaching-assignment-weeks",
    response_model=schemas.TeachingAssignmentWeeksRead,
    status_code=201,
)
def create_teaching_assignment_weeks(
    payload: schemas.TeachingAssignmentWeeksCreate,
    context: CurrentContextDep,
    session: SessionDep,
) -> object:
    return TimetableService(
        session, next(r for r in RESOURCES if r.name == "teaching_assignment_weeks")
    ).create(context, payload)


@router.patch(
    "/teaching-assignment-weeks/{teaching_assignment_id}/{cycle_week_id}",
    response_model=schemas.TeachingAssignmentWeeksRead,
)
def patch_teaching_assignment_weeks(
    teaching_assignment_id: UUID,
    cycle_week_id: UUID,
    payload: schemas.TeachingAssignmentWeeksPatch,
    context: CurrentContextDep,
    session: SessionDep,
) -> object:
    return TimetableService(
        session, next(r for r in RESOURCES if r.name == "teaching_assignment_weeks")
    ).patch(
        context,
        {
            "teaching_assignment_id": teaching_assignment_id,
            "cycle_week_id": cycle_week_id,
        },
        payload,
    )


@router.delete(
    "/teaching-assignment-weeks/{teaching_assignment_id}/{cycle_week_id}",
    status_code=204,
)
def delete_teaching_assignment_weeks(
    teaching_assignment_id: UUID,
    cycle_week_id: UUID,
    context: CurrentContextDep,
    session: SessionDep,
) -> Response:
    TimetableService(
        session, next(r for r in RESOURCES if r.name == "teaching_assignment_weeks")
    ).delete(
        context,
        {
            "teaching_assignment_id": teaching_assignment_id,
            "cycle_week_id": cycle_week_id,
        },
    )
    return Response(status_code=204)


@router.get("/teaching-blocks", response_model=list[schemas.TeachingBlocksRead])
def list_teaching_blocks(
    context: CurrentContextDep,
    session: SessionDep,
    page: Annotated[Pagination, Query()],
) -> object:
    return TimetableService(
        session, next(r for r in RESOURCES if r.name == "teaching_blocks")
    ).list(context, page.offset, page.limit)


@router.get("/teaching-blocks/{id}", response_model=schemas.TeachingBlocksRead)
def get_teaching_blocks(
    id: UUID, context: CurrentContextDep, session: SessionDep
) -> object:
    return TimetableService(
        session, next(r for r in RESOURCES if r.name == "teaching_blocks")
    ).get(context, {"id": id})


@router.post(
    "/teaching-blocks", response_model=schemas.TeachingBlocksRead, status_code=201
)
def create_teaching_blocks(
    payload: schemas.TeachingBlocksCreate,
    context: CurrentContextDep,
    session: SessionDep,
) -> object:
    return TimetableService(
        session, next(r for r in RESOURCES if r.name == "teaching_blocks")
    ).create(context, payload)


@router.patch("/teaching-blocks/{id}", response_model=schemas.TeachingBlocksRead)
def patch_teaching_blocks(
    id: UUID,
    payload: schemas.TeachingBlocksPatch,
    context: CurrentContextDep,
    session: SessionDep,
) -> object:
    return TimetableService(
        session, next(r for r in RESOURCES if r.name == "teaching_blocks")
    ).patch(context, {"id": id}, payload)


@router.delete("/teaching-blocks/{id}", status_code=204)
def delete_teaching_blocks(
    id: UUID, context: CurrentContextDep, session: SessionDep
) -> Response:
    TimetableService(
        session, next(r for r in RESOURCES if r.name == "teaching_blocks")
    ).delete(context, {"id": id})
    return Response(status_code=204)


@router.get(
    "/teaching-block-members", response_model=list[schemas.TeachingBlockMembersRead]
)
def list_teaching_block_members(
    context: CurrentContextDep,
    session: SessionDep,
    page: Annotated[Pagination, Query()],
) -> object:
    return TimetableService(
        session, next(r for r in RESOURCES if r.name == "teaching_block_members")
    ).list(context, page.offset, page.limit)


@router.get(
    "/teaching-block-members/{block_id}/{teaching_assignment_id}",
    response_model=schemas.TeachingBlockMembersRead,
)
def get_teaching_block_members(
    block_id: UUID,
    teaching_assignment_id: UUID,
    context: CurrentContextDep,
    session: SessionDep,
) -> object:
    return TimetableService(
        session, next(r for r in RESOURCES if r.name == "teaching_block_members")
    ).get(
        context,
        {"block_id": block_id, "teaching_assignment_id": teaching_assignment_id},
    )


@router.post(
    "/teaching-block-members",
    response_model=schemas.TeachingBlockMembersRead,
    status_code=201,
)
def create_teaching_block_members(
    payload: schemas.TeachingBlockMembersCreate,
    context: CurrentContextDep,
    session: SessionDep,
) -> object:
    return TimetableService(
        session, next(r for r in RESOURCES if r.name == "teaching_block_members")
    ).create(context, payload)


@router.patch(
    "/teaching-block-members/{block_id}/{teaching_assignment_id}",
    response_model=schemas.TeachingBlockMembersRead,
)
def patch_teaching_block_members(
    block_id: UUID,
    teaching_assignment_id: UUID,
    payload: schemas.TeachingBlockMembersPatch,
    context: CurrentContextDep,
    session: SessionDep,
) -> object:
    return TimetableService(
        session, next(r for r in RESOURCES if r.name == "teaching_block_members")
    ).patch(
        context,
        {"block_id": block_id, "teaching_assignment_id": teaching_assignment_id},
        payload,
    )


@router.delete(
    "/teaching-block-members/{block_id}/{teaching_assignment_id}", status_code=204
)
def delete_teaching_block_members(
    block_id: UUID,
    teaching_assignment_id: UUID,
    context: CurrentContextDep,
    session: SessionDep,
) -> Response:
    TimetableService(
        session, next(r for r in RESOURCES if r.name == "teaching_block_members")
    ).delete(
        context,
        {"block_id": block_id, "teaching_assignment_id": teaching_assignment_id},
    )
    return Response(status_code=204)


@router.get(
    "/teacher-unavailability", response_model=list[schemas.TeacherUnavailabilityRead]
)
def list_teacher_unavailability(
    context: CurrentContextDep,
    session: SessionDep,
    page: Annotated[Pagination, Query()],
) -> object:
    return TimetableService(
        session, next(r for r in RESOURCES if r.name == "teacher_unavailability")
    ).list(context, page.offset, page.limit)


@router.get(
    "/teacher-unavailability/{id}", response_model=schemas.TeacherUnavailabilityRead
)
def get_teacher_unavailability(
    id: UUID, context: CurrentContextDep, session: SessionDep
) -> object:
    return TimetableService(
        session, next(r for r in RESOURCES if r.name == "teacher_unavailability")
    ).get(context, {"id": id})


@router.post(
    "/teacher-unavailability",
    response_model=schemas.TeacherUnavailabilityRead,
    status_code=201,
)
def create_teacher_unavailability(
    payload: schemas.TeacherUnavailabilityCreate,
    context: CurrentContextDep,
    session: SessionDep,
) -> object:
    return TimetableService(
        session, next(r for r in RESOURCES if r.name == "teacher_unavailability")
    ).create(context, payload)


@router.patch(
    "/teacher-unavailability/{id}", response_model=schemas.TeacherUnavailabilityRead
)
def patch_teacher_unavailability(
    id: UUID,
    payload: schemas.TeacherUnavailabilityPatch,
    context: CurrentContextDep,
    session: SessionDep,
) -> object:
    return TimetableService(
        session, next(r for r in RESOURCES if r.name == "teacher_unavailability")
    ).patch(context, {"id": id}, payload)


@router.delete("/teacher-unavailability/{id}", status_code=204)
def delete_teacher_unavailability(
    id: UUID, context: CurrentContextDep, session: SessionDep
) -> Response:
    TimetableService(
        session, next(r for r in RESOURCES if r.name == "teacher_unavailability")
    ).delete(context, {"id": id})
    return Response(status_code=204)


@router.get("/time-grids", response_model=list[schemas.TimeGridsRead])
def list_time_grids(
    context: CurrentContextDep,
    session: SessionDep,
    page: Annotated[Pagination, Query()],
) -> object:
    return TimetableService(
        session, next(r for r in RESOURCES if r.name == "time_grids")
    ).list(context, page.offset, page.limit)


@router.get("/time-grids/{id}", response_model=schemas.TimeGridsRead)
def get_time_grids(id: UUID, context: CurrentContextDep, session: SessionDep) -> object:
    return TimetableService(
        session, next(r for r in RESOURCES if r.name == "time_grids")
    ).get(context, {"id": id})


@router.post("/time-grids", response_model=schemas.TimeGridsRead, status_code=201)
def create_time_grids(
    payload: schemas.TimeGridsCreate, context: CurrentContextDep, session: SessionDep
) -> object:
    return TimetableService(
        session, next(r for r in RESOURCES if r.name == "time_grids")
    ).create(context, payload)


@router.patch("/time-grids/{id}", response_model=schemas.TimeGridsRead)
def patch_time_grids(
    id: UUID,
    payload: schemas.TimeGridsPatch,
    context: CurrentContextDep,
    session: SessionDep,
) -> object:
    return TimetableService(
        session, next(r for r in RESOURCES if r.name == "time_grids")
    ).patch(context, {"id": id}, payload)


@router.delete("/time-grids/{id}", status_code=204)
def delete_time_grids(
    id: UUID, context: CurrentContextDep, session: SessionDep
) -> Response:
    TimetableService(
        session, next(r for r in RESOURCES if r.name == "time_grids")
    ).delete(context, {"id": id})
    return Response(status_code=204)


@router.get("/time-slots", response_model=list[schemas.TimeSlotsRead])
def list_time_slots(
    context: CurrentContextDep,
    session: SessionDep,
    page: Annotated[schemas.TimeSlotsFilter, Query()],
) -> object:
    return TimetableService(
        session, next(r for r in RESOURCES if r.name == "time_slots")
    ).list_filtered(context, page.offset, page.limit, time_grid_id=page.time_grid_id)


@router.get("/time-slots/{id}", response_model=schemas.TimeSlotsRead)
def get_time_slots(id: UUID, context: CurrentContextDep, session: SessionDep) -> object:
    return TimetableService(
        session, next(r for r in RESOURCES if r.name == "time_slots")
    ).get(context, {"id": id})


@router.post("/time-slots", response_model=schemas.TimeSlotsRead, status_code=201)
def create_time_slots(
    payload: schemas.TimeSlotsCreate, context: CurrentContextDep, session: SessionDep
) -> object:
    return TimetableService(
        session, next(r for r in RESOURCES if r.name == "time_slots")
    ).create(context, payload)


@router.patch("/time-slots/{id}", response_model=schemas.TimeSlotsRead)
def patch_time_slots(
    id: UUID,
    payload: schemas.TimeSlotsPatch,
    context: CurrentContextDep,
    session: SessionDep,
) -> object:
    return TimetableService(
        session, next(r for r in RESOURCES if r.name == "time_slots")
    ).patch(context, {"id": id}, payload)


@router.delete("/time-slots/{id}", status_code=204)
def delete_time_slots(
    id: UUID, context: CurrentContextDep, session: SessionDep
) -> Response:
    TimetableService(
        session, next(r for r in RESOURCES if r.name == "time_slots")
    ).delete(context, {"id": id})
    return Response(status_code=204)


@router.get("/timetable-versions", response_model=list[schemas.TimetableVersionsRead])
def list_timetable_versions(
    context: CurrentContextDep,
    session: SessionDep,
    page: Annotated[schemas.TimetableVersionsFilter, Query()],
) -> object:
    return TimetableService(
        session, next(r for r in RESOURCES if r.name == "timetable_versions")
    ).list_filtered(
        context,
        page.offset,
        page.limit,
        teaching_plan_id=page.teaching_plan_id,
        status=page.status,
    )


@router.get("/timetable-versions/{id}", response_model=schemas.TimetableVersionsRead)
def get_timetable_versions(
    id: UUID, context: CurrentContextDep, session: SessionDep
) -> object:
    return TimetableService(
        session, next(r for r in RESOURCES if r.name == "timetable_versions")
    ).get(context, {"id": id})


@router.post(
    "/timetable-versions", response_model=schemas.TimetableVersionsRead, status_code=201
)
def create_timetable_versions(
    payload: schemas.TimetableVersionsCreate,
    context: CurrentContextDep,
    session: SessionDep,
) -> object:
    return TimetableService(
        session, next(r for r in RESOURCES if r.name == "timetable_versions")
    ).create(context, payload)


@router.patch("/timetable-versions/{id}", response_model=schemas.TimetableVersionsRead)
def patch_timetable_versions(
    id: UUID,
    payload: schemas.TimetableVersionsPatch,
    context: CurrentContextDep,
    session: SessionDep,
) -> object:
    return TimetableService(
        session, next(r for r in RESOURCES if r.name == "timetable_versions")
    ).patch(context, {"id": id}, payload)


@router.delete("/timetable-versions/{id}", status_code=204)
def delete_timetable_versions(
    id: UUID, context: CurrentContextDep, session: SessionDep
) -> Response:
    TimetableService(
        session, next(r for r in RESOURCES if r.name == "timetable_versions")
    ).delete(context, {"id": id})
    return Response(status_code=204)


@router.get("/timetable-entries", response_model=list[schemas.TimetableEntriesRead])
def list_timetable_entries(
    context: CurrentContextDep,
    session: SessionDep,
    page: Annotated[schemas.TimetableEntriesFilter, Query()],
) -> object:
    return TimetableService(
        session, next(r for r in RESOURCES if r.name == "timetable_entries")
    ).list_filtered(
        context,
        page.offset,
        page.limit,
        timetable_version_id=page.timetable_version_id,
        cycle_week_id=page.cycle_week_id,
    )


@router.get("/timetable-entries/{id}", response_model=schemas.TimetableEntriesRead)
def get_timetable_entries(
    id: UUID, context: CurrentContextDep, session: SessionDep
) -> object:
    return TimetableService(
        session, next(r for r in RESOURCES if r.name == "timetable_entries")
    ).get(context, {"id": id})


@router.post(
    "/timetable-entries", response_model=schemas.TimetableEntriesRead, status_code=201
)
def create_timetable_entries(
    payload: schemas.TimetableEntriesCreate,
    context: CurrentContextDep,
    session: SessionDep,
) -> object:
    return TimetableService(
        session, next(r for r in RESOURCES if r.name == "timetable_entries")
    ).create(context, payload)


@router.patch("/timetable-entries/{id}", response_model=schemas.TimetableEntriesRead)
def patch_timetable_entries(
    id: UUID,
    payload: schemas.TimetableEntriesPatch,
    context: CurrentContextDep,
    session: SessionDep,
) -> object:
    return TimetableService(
        session, next(r for r in RESOURCES if r.name == "timetable_entries")
    ).patch(context, {"id": id}, payload)


@router.delete("/timetable-entries/{id}", status_code=204)
def delete_timetable_entries(
    id: UUID, context: CurrentContextDep, session: SessionDep
) -> Response:
    TimetableService(
        session, next(r for r in RESOURCES if r.name == "timetable_entries")
    ).delete(context, {"id": id})
    return Response(status_code=204)


@router.get(
    "/timetable-preferences", response_model=list[schemas.TimetablePreferencesRead]
)
def list_timetable_preferences(
    context: CurrentContextDep,
    session: SessionDep,
    page: Annotated[Pagination, Query()],
) -> object:
    return TimetableService(
        session, next(r for r in RESOURCES if r.name == "timetable_preferences")
    ).list(context, page.offset, page.limit)


@router.get(
    "/timetable-preferences/{id}", response_model=schemas.TimetablePreferencesRead
)
def get_timetable_preferences(
    id: UUID, context: CurrentContextDep, session: SessionDep
) -> object:
    return TimetableService(
        session, next(r for r in RESOURCES if r.name == "timetable_preferences")
    ).get(context, {"id": id})


@router.post(
    "/timetable-preferences",
    response_model=schemas.TimetablePreferencesRead,
    status_code=201,
)
def create_timetable_preferences(
    payload: schemas.TimetablePreferencesCreate,
    context: CurrentContextDep,
    session: SessionDep,
) -> object:
    return TimetableService(
        session, next(r for r in RESOURCES if r.name == "timetable_preferences")
    ).create(context, payload)


@router.patch(
    "/timetable-preferences/{id}", response_model=schemas.TimetablePreferencesRead
)
def patch_timetable_preferences(
    id: UUID,
    payload: schemas.TimetablePreferencesPatch,
    context: CurrentContextDep,
    session: SessionDep,
) -> object:
    return TimetableService(
        session, next(r for r in RESOURCES if r.name == "timetable_preferences")
    ).patch(context, {"id": id}, payload)


@router.delete("/timetable-preferences/{id}", status_code=204)
def delete_timetable_preferences(
    id: UUID, context: CurrentContextDep, session: SessionDep
) -> Response:
    TimetableService(
        session, next(r for r in RESOURCES if r.name == "timetable_preferences")
    ).delete(context, {"id": id})
    return Response(status_code=204)


@router.get("/lesson-occurrences", response_model=list[schemas.LessonOccurrencesRead])
def list_lesson_occurrences(
    context: CurrentContextDep,
    session: SessionDep,
    page: Annotated[Pagination, Query()],
) -> object:
    return TimetableService(
        session, next(r for r in RESOURCES if r.name == "lesson_occurrences")
    ).list(context, page.offset, page.limit)


@router.get("/lesson-occurrences/{id}", response_model=schemas.LessonOccurrencesRead)
def get_lesson_occurrences(
    id: UUID, context: CurrentContextDep, session: SessionDep
) -> object:
    return TimetableService(
        session, next(r for r in RESOURCES if r.name == "lesson_occurrences")
    ).get(context, {"id": id})


@router.post(
    "/lesson-occurrences", response_model=schemas.LessonOccurrencesRead, status_code=201
)
def create_lesson_occurrences(
    payload: schemas.LessonOccurrencesCreate,
    context: CurrentContextDep,
    session: SessionDep,
) -> object:
    return TimetableService(
        session, next(r for r in RESOURCES if r.name == "lesson_occurrences")
    ).create(context, payload)


@router.patch("/lesson-occurrences/{id}", response_model=schemas.LessonOccurrencesRead)
def patch_lesson_occurrences(
    id: UUID,
    payload: schemas.LessonOccurrencesPatch,
    context: CurrentContextDep,
    session: SessionDep,
) -> object:
    return TimetableService(
        session, next(r for r in RESOURCES if r.name == "lesson_occurrences")
    ).patch(context, {"id": id}, payload)


@router.delete("/lesson-occurrences/{id}", status_code=204)
def delete_lesson_occurrences(
    id: UUID, context: CurrentContextDep, session: SessionDep
) -> Response:
    TimetableService(
        session, next(r for r in RESOURCES if r.name == "lesson_occurrences")
    ).delete(context, {"id": id})
    return Response(status_code=204)


@router.get("/lesson-changes", response_model=list[schemas.LessonChangesRead])
def list_lesson_changes(
    context: CurrentContextDep,
    session: SessionDep,
    page: Annotated[Pagination, Query()],
) -> object:
    return TimetableService(
        session, next(r for r in RESOURCES if r.name == "lesson_changes")
    ).list(context, page.offset, page.limit)


@router.get("/lesson-changes/{id}", response_model=schemas.LessonChangesRead)
def get_lesson_changes(
    id: UUID, context: CurrentContextDep, session: SessionDep
) -> object:
    return TimetableService(
        session, next(r for r in RESOURCES if r.name == "lesson_changes")
    ).get(context, {"id": id})


@router.post(
    "/lesson-changes", response_model=schemas.LessonChangesRead, status_code=201
)
def create_lesson_changes(
    payload: schemas.LessonChangesCreate,
    context: CurrentContextDep,
    session: SessionDep,
) -> object:
    return TimetableService(
        session, next(r for r in RESOURCES if r.name == "lesson_changes")
    ).create(context, payload)


@router.patch("/lesson-changes/{id}", response_model=schemas.LessonChangesRead)
def patch_lesson_changes(
    id: UUID,
    payload: schemas.LessonChangesPatch,
    context: CurrentContextDep,
    session: SessionDep,
) -> object:
    return TimetableService(
        session, next(r for r in RESOURCES if r.name == "lesson_changes")
    ).patch(context, {"id": id}, payload)


@router.delete("/lesson-changes/{id}", status_code=204)
def delete_lesson_changes(
    id: UUID, context: CurrentContextDep, session: SessionDep
) -> Response:
    TimetableService(
        session, next(r for r in RESOURCES if r.name == "lesson_changes")
    ).delete(context, {"id": id})
    return Response(status_code=204)
