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

from . import schemas
from .domain_service import ClassbookDomainService
from .resources import RESOURCES

router = APIRouter(
    prefix="/classbook",
    tags=["classbook"],
    dependencies=[Depends(mutation_guard), Depends(no_store)],
    responses=ERROR_RESPONSES,
)


@router.get("/classbook-entries", response_model=list[schemas.ClassbookEntriesRead])
def list_classbook_entries(
    context: CurrentContextDep,
    session: SessionDep,
    page: Annotated[Pagination, Query()],
) -> object:
    return ClassbookDomainService(
        session, next(r for r in RESOURCES if r.name == "classbook_entries")
    ).list(context, page.offset, page.limit)


@router.get("/classbook-entries/{id}", response_model=schemas.ClassbookEntriesRead)
def get_classbook_entries(
    id: UUID, context: CurrentContextDep, session: SessionDep
) -> object:
    return ClassbookDomainService(
        session, next(r for r in RESOURCES if r.name == "classbook_entries")
    ).get(context, {"id": id})


@router.post(
    "/classbook-entries", response_model=schemas.ClassbookEntriesRead, status_code=201
)
def create_classbook_entries(
    payload: schemas.ClassbookEntriesCreate,
    context: CurrentContextDep,
    session: SessionDep,
) -> object:
    return ClassbookDomainService(
        session, next(r for r in RESOURCES if r.name == "classbook_entries")
    ).create(context, payload)


@router.patch("/classbook-entries/{id}", response_model=schemas.ClassbookEntriesRead)
def patch_classbook_entries(
    id: UUID,
    payload: schemas.ClassbookEntriesPatch,
    context: CurrentContextDep,
    session: SessionDep,
) -> object:
    return ClassbookDomainService(
        session, next(r for r in RESOURCES if r.name == "classbook_entries")
    ).patch(context, {"id": id}, payload)


@router.delete("/classbook-entries/{id}", status_code=204)
def delete_classbook_entries(
    id: UUID, context: CurrentContextDep, session: SessionDep
) -> Response:
    ClassbookDomainService(
        session, next(r for r in RESOURCES if r.name == "classbook_entries")
    ).delete(context, {"id": id})
    return Response(status_code=204)


@router.get(
    "/classbook-participants", response_model=list[schemas.ClassbookParticipantsRead]
)
def list_classbook_participants(
    context: CurrentContextDep,
    session: SessionDep,
    page: Annotated[Pagination, Query()],
) -> object:
    return ClassbookDomainService(
        session, next(r for r in RESOURCES if r.name == "classbook_participants")
    ).list(context, page.offset, page.limit)


@router.get(
    "/classbook-participants/{classbook_entry_id}/{student_id}",
    response_model=schemas.ClassbookParticipantsRead,
)
def get_classbook_participants(
    classbook_entry_id: UUID,
    student_id: UUID,
    context: CurrentContextDep,
    session: SessionDep,
) -> object:
    return ClassbookDomainService(
        session, next(r for r in RESOURCES if r.name == "classbook_participants")
    ).get(context, {"classbook_entry_id": classbook_entry_id, "student_id": student_id})


@router.post(
    "/classbook-participants",
    response_model=schemas.ClassbookParticipantsRead,
    status_code=201,
)
def create_classbook_participants(
    payload: schemas.ClassbookParticipantsCreate,
    context: CurrentContextDep,
    session: SessionDep,
) -> object:
    return ClassbookDomainService(
        session, next(r for r in RESOURCES if r.name == "classbook_participants")
    ).create(context, payload)


@router.delete(
    "/classbook-participants/{classbook_entry_id}/{student_id}", status_code=204
)
def delete_classbook_participants(
    classbook_entry_id: UUID,
    student_id: UUID,
    context: CurrentContextDep,
    session: SessionDep,
) -> Response:
    ClassbookDomainService(
        session, next(r for r in RESOURCES if r.name == "classbook_participants")
    ).delete(
        context, {"classbook_entry_id": classbook_entry_id, "student_id": student_id}
    )
    return Response(status_code=204)


@router.get("/attendance-records", response_model=list[schemas.AttendanceRecordsRead])
def list_attendance_records(
    context: CurrentContextDep,
    session: SessionDep,
    page: Annotated[Pagination, Query()],
) -> object:
    return ClassbookDomainService(
        session, next(r for r in RESOURCES if r.name == "attendance_records")
    ).list(context, page.offset, page.limit)


@router.get("/attendance-records/{id}", response_model=schemas.AttendanceRecordsRead)
def get_attendance_records(
    id: UUID, context: CurrentContextDep, session: SessionDep
) -> object:
    return ClassbookDomainService(
        session, next(r for r in RESOURCES if r.name == "attendance_records")
    ).get(context, {"id": id})


@router.post(
    "/attendance-records", response_model=schemas.AttendanceRecordsRead, status_code=201
)
def create_attendance_records(
    payload: schemas.AttendanceRecordsCreate,
    context: CurrentContextDep,
    session: SessionDep,
) -> object:
    return ClassbookDomainService(
        session, next(r for r in RESOURCES if r.name == "attendance_records")
    ).create(context, payload)


@router.patch("/attendance-records/{id}", response_model=schemas.AttendanceRecordsRead)
def patch_attendance_records(
    id: UUID,
    payload: schemas.AttendanceRecordsPatch,
    context: CurrentContextDep,
    session: SessionDep,
) -> object:
    return ClassbookDomainService(
        session, next(r for r in RESOURCES if r.name == "attendance_records")
    ).patch(context, {"id": id}, payload)


@router.delete("/attendance-records/{id}", status_code=204)
def delete_attendance_records(
    id: UUID, context: CurrentContextDep, session: SessionDep
) -> Response:
    ClassbookDomainService(
        session, next(r for r in RESOURCES if r.name == "attendance_records")
    ).delete(context, {"id": id})
    return Response(status_code=204)


@router.get(
    "/absence-excuse-requests", response_model=list[schemas.AbsenceExcuseRequestsRead]
)
def list_absence_excuse_requests(
    context: CurrentContextDep,
    session: SessionDep,
    page: Annotated[Pagination, Query()],
) -> object:
    return ClassbookDomainService(
        session, next(r for r in RESOURCES if r.name == "absence_excuse_requests")
    ).list(context, page.offset, page.limit)


@router.get(
    "/absence-excuse-requests/{id}", response_model=schemas.AbsenceExcuseRequestsRead
)
def get_absence_excuse_requests(
    id: UUID, context: CurrentContextDep, session: SessionDep
) -> object:
    return ClassbookDomainService(
        session, next(r for r in RESOURCES if r.name == "absence_excuse_requests")
    ).get(context, {"id": id})


@router.post(
    "/absence-excuse-requests",
    response_model=schemas.AbsenceExcuseRequestsRead,
    status_code=201,
)
def create_absence_excuse_requests(
    payload: schemas.AbsenceExcuseRequestsCreate,
    context: CurrentContextDep,
    session: SessionDep,
) -> object:
    return ClassbookDomainService(
        session, next(r for r in RESOURCES if r.name == "absence_excuse_requests")
    ).create(context, payload)


@router.patch(
    "/absence-excuse-requests/{id}", response_model=schemas.AbsenceExcuseRequestsRead
)
def patch_absence_excuse_requests(
    id: UUID,
    payload: schemas.AbsenceExcuseRequestsPatch,
    context: CurrentContextDep,
    session: SessionDep,
) -> object:
    return ClassbookDomainService(
        session, next(r for r in RESOURCES if r.name == "absence_excuse_requests")
    ).patch(context, {"id": id}, payload)


@router.get(
    "/absence-excuse-items", response_model=list[schemas.AbsenceExcuseItemsRead]
)
def list_absence_excuse_items(
    context: CurrentContextDep,
    session: SessionDep,
    page: Annotated[Pagination, Query()],
) -> object:
    return ClassbookDomainService(
        session, next(r for r in RESOURCES if r.name == "absence_excuse_items")
    ).list(context, page.offset, page.limit)


@router.get(
    "/absence-excuse-items/{request_id}/{attendance_record_id}",
    response_model=schemas.AbsenceExcuseItemsRead,
)
def get_absence_excuse_items(
    request_id: UUID,
    attendance_record_id: UUID,
    context: CurrentContextDep,
    session: SessionDep,
) -> object:
    return ClassbookDomainService(
        session, next(r for r in RESOURCES if r.name == "absence_excuse_items")
    ).get(
        context,
        {"request_id": request_id, "attendance_record_id": attendance_record_id},
    )


@router.post(
    "/absence-excuse-items",
    response_model=schemas.AbsenceExcuseItemsRead,
    status_code=201,
)
def create_absence_excuse_items(
    payload: schemas.AbsenceExcuseItemsCreate,
    context: CurrentContextDep,
    session: SessionDep,
) -> object:
    return ClassbookDomainService(
        session, next(r for r in RESOURCES if r.name == "absence_excuse_items")
    ).create(context, payload)


@router.patch(
    "/absence-excuse-items/{request_id}/{attendance_record_id}",
    response_model=schemas.AbsenceExcuseItemsRead,
)
def patch_absence_excuse_items(
    request_id: UUID,
    attendance_record_id: UUID,
    payload: schemas.AbsenceExcuseItemsPatch,
    context: CurrentContextDep,
    session: SessionDep,
) -> object:
    return ClassbookDomainService(
        session, next(r for r in RESOURCES if r.name == "absence_excuse_items")
    ).patch(
        context,
        {"request_id": request_id, "attendance_record_id": attendance_record_id},
        payload,
    )
