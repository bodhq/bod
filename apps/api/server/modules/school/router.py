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
from .domain_service import SchoolDomainService
from .resources import RESOURCES

router = APIRouter(
    prefix="/school",
    tags=["school"],
    dependencies=[Depends(mutation_guard), Depends(no_store)],
    responses=ERROR_RESPONSES,
)


@router.get("/school-years", response_model=list[schemas.SchoolYearsRead])
def list_school_years(
    context: CurrentContextDep,
    session: SessionDep,
    page: Annotated[Pagination, Query()],
) -> object:
    return SchoolDomainService(
        session, next(r for r in RESOURCES if r.name == "school_years")
    ).list(context, page.offset, page.limit)


@router.get("/school-years/{id}", response_model=schemas.SchoolYearsRead)
def get_school_years(
    id: UUID, context: CurrentContextDep, session: SessionDep
) -> object:
    return SchoolDomainService(
        session, next(r for r in RESOURCES if r.name == "school_years")
    ).get(context, {"id": id})


@router.post("/school-years", response_model=schemas.SchoolYearsRead, status_code=201)
def create_school_years(
    payload: schemas.SchoolYearsCreate, context: CurrentContextDep, session: SessionDep
) -> object:
    return SchoolDomainService(
        session, next(r for r in RESOURCES if r.name == "school_years")
    ).create(context, payload)


@router.patch("/school-years/{id}", response_model=schemas.SchoolYearsRead)
def patch_school_years(
    id: UUID,
    payload: schemas.SchoolYearsPatch,
    context: CurrentContextDep,
    session: SessionDep,
) -> object:
    return SchoolDomainService(
        session, next(r for r in RESOURCES if r.name == "school_years")
    ).patch(context, {"id": id}, payload)


@router.delete("/school-years/{id}", status_code=204)
def delete_school_years(
    id: UUID, context: CurrentContextDep, session: SessionDep
) -> Response:
    SchoolDomainService(
        session, next(r for r in RESOURCES if r.name == "school_years")
    ).delete(context, {"id": id})
    return Response(status_code=204)


@router.get("/specializations", response_model=list[schemas.SpecializationsRead])
def list_specializations(
    context: CurrentContextDep,
    session: SessionDep,
    page: Annotated[Pagination, Query()],
) -> object:
    return SchoolDomainService(
        session, next(r for r in RESOURCES if r.name == "specializations")
    ).list(context, page.offset, page.limit)


@router.get("/specializations/{id}", response_model=schemas.SpecializationsRead)
def get_specializations(
    id: UUID, context: CurrentContextDep, session: SessionDep
) -> object:
    return SchoolDomainService(
        session, next(r for r in RESOURCES if r.name == "specializations")
    ).get(context, {"id": id})


@router.post(
    "/specializations", response_model=schemas.SpecializationsRead, status_code=201
)
def create_specializations(
    payload: schemas.SpecializationsCreate,
    context: CurrentContextDep,
    session: SessionDep,
) -> object:
    return SchoolDomainService(
        session, next(r for r in RESOURCES if r.name == "specializations")
    ).create(context, payload)


@router.patch("/specializations/{id}", response_model=schemas.SpecializationsRead)
def patch_specializations(
    id: UUID,
    payload: schemas.SpecializationsPatch,
    context: CurrentContextDep,
    session: SessionDep,
) -> object:
    return SchoolDomainService(
        session, next(r for r in RESOURCES if r.name == "specializations")
    ).patch(context, {"id": id}, payload)


@router.delete("/specializations/{id}", status_code=204)
def delete_specializations(
    id: UUID, context: CurrentContextDep, session: SessionDep
) -> Response:
    SchoolDomainService(
        session, next(r for r in RESOURCES if r.name == "specializations")
    ).delete(context, {"id": id})
    return Response(status_code=204)


@router.get("/classes", response_model=list[schemas.ClassesRead])
def list_classes(
    context: CurrentContextDep,
    session: SessionDep,
    page: Annotated[Pagination, Query()],
) -> object:
    return SchoolDomainService(
        session, next(r for r in RESOURCES if r.name == "classes")
    ).list(context, page.offset, page.limit)


@router.get("/classes/{id}", response_model=schemas.ClassesRead)
def get_classes(id: UUID, context: CurrentContextDep, session: SessionDep) -> object:
    return SchoolDomainService(
        session, next(r for r in RESOURCES if r.name == "classes")
    ).get(context, {"id": id})


@router.post("/classes", response_model=schemas.ClassesRead, status_code=201)
def create_classes(
    payload: schemas.ClassesCreate, context: CurrentContextDep, session: SessionDep
) -> object:
    return SchoolDomainService(
        session, next(r for r in RESOURCES if r.name == "classes")
    ).create(context, payload)


@router.patch("/classes/{id}", response_model=schemas.ClassesRead)
def patch_classes(
    id: UUID,
    payload: schemas.ClassesPatch,
    context: CurrentContextDep,
    session: SessionDep,
) -> object:
    return SchoolDomainService(
        session, next(r for r in RESOURCES if r.name == "classes")
    ).patch(context, {"id": id}, payload)


@router.delete("/classes/{id}", status_code=204)
def delete_classes(
    id: UUID, context: CurrentContextDep, session: SessionDep
) -> Response:
    SchoolDomainService(
        session, next(r for r in RESOURCES if r.name == "classes")
    ).delete(context, {"id": id})
    return Response(status_code=204)


@router.get("/class-enrollments", response_model=list[schemas.ClassEnrollmentsRead])
def list_class_enrollments(
    context: CurrentContextDep,
    session: SessionDep,
    page: Annotated[Pagination, Query()],
) -> object:
    return SchoolDomainService(
        session, next(r for r in RESOURCES if r.name == "class_enrollments")
    ).list(context, page.offset, page.limit)


@router.get("/class-enrollments/{id}", response_model=schemas.ClassEnrollmentsRead)
def get_class_enrollments(
    id: UUID, context: CurrentContextDep, session: SessionDep
) -> object:
    return SchoolDomainService(
        session, next(r for r in RESOURCES if r.name == "class_enrollments")
    ).get(context, {"id": id})


@router.post(
    "/class-enrollments", response_model=schemas.ClassEnrollmentsRead, status_code=201
)
def create_class_enrollments(
    payload: schemas.ClassEnrollmentsCreate,
    context: CurrentContextDep,
    session: SessionDep,
) -> object:
    return SchoolDomainService(
        session, next(r for r in RESOURCES if r.name == "class_enrollments")
    ).create(context, payload)


@router.patch("/class-enrollments/{id}", response_model=schemas.ClassEnrollmentsRead)
def patch_class_enrollments(
    id: UUID,
    payload: schemas.ClassEnrollmentsPatch,
    context: CurrentContextDep,
    session: SessionDep,
) -> object:
    return SchoolDomainService(
        session, next(r for r in RESOURCES if r.name == "class_enrollments")
    ).patch(context, {"id": id}, payload)


@router.delete("/class-enrollments/{id}", status_code=204)
def delete_class_enrollments(
    id: UUID, context: CurrentContextDep, session: SessionDep
) -> Response:
    SchoolDomainService(
        session, next(r for r in RESOURCES if r.name == "class_enrollments")
    ).delete(context, {"id": id})
    return Response(status_code=204)


@router.get("/parent-students", response_model=list[schemas.ParentStudentsRead])
def list_parent_students(
    context: CurrentContextDep,
    session: SessionDep,
    page: Annotated[Pagination, Query()],
) -> object:
    return SchoolDomainService(
        session, next(r for r in RESOURCES if r.name == "parent_students")
    ).list(context, page.offset, page.limit)


@router.get(
    "/parent-students/{parent_id}/{student_id}",
    response_model=schemas.ParentStudentsRead,
)
def get_parent_students(
    parent_id: UUID, student_id: UUID, context: CurrentContextDep, session: SessionDep
) -> object:
    return SchoolDomainService(
        session, next(r for r in RESOURCES if r.name == "parent_students")
    ).get(context, {"parent_id": parent_id, "student_id": student_id})


@router.post(
    "/parent-students", response_model=schemas.ParentStudentsRead, status_code=201
)
def create_parent_students(
    payload: schemas.ParentStudentsCreate,
    context: CurrentContextDep,
    session: SessionDep,
) -> object:
    return SchoolDomainService(
        session, next(r for r in RESOURCES if r.name == "parent_students")
    ).create(context, payload)


@router.delete("/parent-students/{parent_id}/{student_id}", status_code=204)
def delete_parent_students(
    parent_id: UUID, student_id: UUID, context: CurrentContextDep, session: SessionDep
) -> Response:
    SchoolDomainService(
        session, next(r for r in RESOURCES if r.name == "parent_students")
    ).delete(context, {"parent_id": parent_id, "student_id": student_id})
    return Response(status_code=204)


@router.get("/subjects", response_model=list[schemas.SubjectsRead])
def list_subjects(
    context: CurrentContextDep,
    session: SessionDep,
    page: Annotated[Pagination, Query()],
) -> object:
    return SchoolDomainService(
        session, next(r for r in RESOURCES if r.name == "subjects")
    ).list(context, page.offset, page.limit)


@router.get("/subjects/{id}", response_model=schemas.SubjectsRead)
def get_subjects(id: UUID, context: CurrentContextDep, session: SessionDep) -> object:
    return SchoolDomainService(
        session, next(r for r in RESOURCES if r.name == "subjects")
    ).get(context, {"id": id})


@router.post("/subjects", response_model=schemas.SubjectsRead, status_code=201)
def create_subjects(
    payload: schemas.SubjectsCreate, context: CurrentContextDep, session: SessionDep
) -> object:
    return SchoolDomainService(
        session, next(r for r in RESOURCES if r.name == "subjects")
    ).create(context, payload)


@router.patch("/subjects/{id}", response_model=schemas.SubjectsRead)
def patch_subjects(
    id: UUID,
    payload: schemas.SubjectsPatch,
    context: CurrentContextDep,
    session: SessionDep,
) -> object:
    return SchoolDomainService(
        session, next(r for r in RESOURCES if r.name == "subjects")
    ).patch(context, {"id": id}, payload)


@router.delete("/subjects/{id}", status_code=204)
def delete_subjects(
    id: UUID, context: CurrentContextDep, session: SessionDep
) -> Response:
    SchoolDomainService(
        session, next(r for r in RESOURCES if r.name == "subjects")
    ).delete(context, {"id": id})
    return Response(status_code=204)


@router.get("/group-divisions", response_model=list[schemas.GroupDivisionsRead])
def list_group_divisions(
    context: CurrentContextDep,
    session: SessionDep,
    page: Annotated[Pagination, Query()],
) -> object:
    return SchoolDomainService(
        session, next(r for r in RESOURCES if r.name == "group_divisions")
    ).list(context, page.offset, page.limit)


@router.get("/group-divisions/{id}", response_model=schemas.GroupDivisionsRead)
def get_group_divisions(
    id: UUID, context: CurrentContextDep, session: SessionDep
) -> object:
    return SchoolDomainService(
        session, next(r for r in RESOURCES if r.name == "group_divisions")
    ).get(context, {"id": id})


@router.post(
    "/group-divisions", response_model=schemas.GroupDivisionsRead, status_code=201
)
def create_group_divisions(
    payload: schemas.GroupDivisionsCreate,
    context: CurrentContextDep,
    session: SessionDep,
) -> object:
    return SchoolDomainService(
        session, next(r for r in RESOURCES if r.name == "group_divisions")
    ).create(context, payload)


@router.patch("/group-divisions/{id}", response_model=schemas.GroupDivisionsRead)
def patch_group_divisions(
    id: UUID,
    payload: schemas.GroupDivisionsPatch,
    context: CurrentContextDep,
    session: SessionDep,
) -> object:
    return SchoolDomainService(
        session, next(r for r in RESOURCES if r.name == "group_divisions")
    ).patch(context, {"id": id}, payload)


@router.delete("/group-divisions/{id}", status_code=204)
def delete_group_divisions(
    id: UUID, context: CurrentContextDep, session: SessionDep
) -> Response:
    SchoolDomainService(
        session, next(r for r in RESOURCES if r.name == "group_divisions")
    ).delete(context, {"id": id})
    return Response(status_code=204)


@router.get("/teaching-groups", response_model=list[schemas.TeachingGroupsRead])
def list_teaching_groups(
    context: CurrentContextDep,
    session: SessionDep,
    page: Annotated[Pagination, Query()],
) -> object:
    return SchoolDomainService(
        session, next(r for r in RESOURCES if r.name == "teaching_groups")
    ).list(context, page.offset, page.limit)


@router.get("/teaching-groups/{id}", response_model=schemas.TeachingGroupsRead)
def get_teaching_groups(
    id: UUID, context: CurrentContextDep, session: SessionDep
) -> object:
    return SchoolDomainService(
        session, next(r for r in RESOURCES if r.name == "teaching_groups")
    ).get(context, {"id": id})


@router.post(
    "/teaching-groups", response_model=schemas.TeachingGroupsRead, status_code=201
)
def create_teaching_groups(
    payload: schemas.TeachingGroupsCreate,
    context: CurrentContextDep,
    session: SessionDep,
) -> object:
    return SchoolDomainService(
        session, next(r for r in RESOURCES if r.name == "teaching_groups")
    ).create(context, payload)


@router.patch("/teaching-groups/{id}", response_model=schemas.TeachingGroupsRead)
def patch_teaching_groups(
    id: UUID,
    payload: schemas.TeachingGroupsPatch,
    context: CurrentContextDep,
    session: SessionDep,
) -> object:
    return SchoolDomainService(
        session, next(r for r in RESOURCES if r.name == "teaching_groups")
    ).patch(context, {"id": id}, payload)


@router.delete("/teaching-groups/{id}", status_code=204)
def delete_teaching_groups(
    id: UUID, context: CurrentContextDep, session: SessionDep
) -> Response:
    SchoolDomainService(
        session, next(r for r in RESOURCES if r.name == "teaching_groups")
    ).delete(context, {"id": id})
    return Response(status_code=204)


@router.get(
    "/teaching-group-memberships",
    response_model=list[schemas.TeachingGroupMembershipsRead],
)
def list_teaching_group_memberships(
    context: CurrentContextDep,
    session: SessionDep,
    page: Annotated[Pagination, Query()],
) -> object:
    return SchoolDomainService(
        session, next(r for r in RESOURCES if r.name == "teaching_group_memberships")
    ).list(context, page.offset, page.limit)


@router.get(
    "/teaching-group-memberships/{id}",
    response_model=schemas.TeachingGroupMembershipsRead,
)
def get_teaching_group_memberships(
    id: UUID, context: CurrentContextDep, session: SessionDep
) -> object:
    return SchoolDomainService(
        session, next(r for r in RESOURCES if r.name == "teaching_group_memberships")
    ).get(context, {"id": id})


@router.post(
    "/teaching-group-memberships",
    response_model=schemas.TeachingGroupMembershipsRead,
    status_code=201,
)
def create_teaching_group_memberships(
    payload: schemas.TeachingGroupMembershipsCreate,
    context: CurrentContextDep,
    session: SessionDep,
) -> object:
    return SchoolDomainService(
        session, next(r for r in RESOURCES if r.name == "teaching_group_memberships")
    ).create(context, payload)


@router.patch(
    "/teaching-group-memberships/{id}",
    response_model=schemas.TeachingGroupMembershipsRead,
)
def patch_teaching_group_memberships(
    id: UUID,
    payload: schemas.TeachingGroupMembershipsPatch,
    context: CurrentContextDep,
    session: SessionDep,
) -> object:
    return SchoolDomainService(
        session, next(r for r in RESOURCES if r.name == "teaching_group_memberships")
    ).patch(context, {"id": id}, payload)


@router.delete("/teaching-group-memberships/{id}", status_code=204)
def delete_teaching_group_memberships(
    id: UUID, context: CurrentContextDep, session: SessionDep
) -> Response:
    SchoolDomainService(
        session, next(r for r in RESOURCES if r.name == "teaching_group_memberships")
    ).delete(context, {"id": id})
    return Response(status_code=204)


@router.get(
    "/group-specialization-rules",
    response_model=list[schemas.GroupSpecializationRulesRead],
)
def list_group_specialization_rules(
    context: CurrentContextDep,
    session: SessionDep,
    page: Annotated[Pagination, Query()],
) -> object:
    return SchoolDomainService(
        session, next(r for r in RESOURCES if r.name == "group_specialization_rules")
    ).list(context, page.offset, page.limit)


@router.get(
    "/group-specialization-rules/{group_id}/{specialization_id}",
    response_model=schemas.GroupSpecializationRulesRead,
)
def get_group_specialization_rules(
    group_id: UUID,
    specialization_id: UUID,
    context: CurrentContextDep,
    session: SessionDep,
) -> object:
    return SchoolDomainService(
        session, next(r for r in RESOURCES if r.name == "group_specialization_rules")
    ).get(context, {"group_id": group_id, "specialization_id": specialization_id})


@router.post(
    "/group-specialization-rules",
    response_model=schemas.GroupSpecializationRulesRead,
    status_code=201,
)
def create_group_specialization_rules(
    payload: schemas.GroupSpecializationRulesCreate,
    context: CurrentContextDep,
    session: SessionDep,
) -> object:
    return SchoolDomainService(
        session, next(r for r in RESOURCES if r.name == "group_specialization_rules")
    ).create(context, payload)


@router.delete(
    "/group-specialization-rules/{group_id}/{specialization_id}", status_code=204
)
def delete_group_specialization_rules(
    group_id: UUID,
    specialization_id: UUID,
    context: CurrentContextDep,
    session: SessionDep,
) -> Response:
    SchoolDomainService(
        session, next(r for r in RESOURCES if r.name == "group_specialization_rules")
    ).delete(context, {"group_id": group_id, "specialization_id": specialization_id})
    return Response(status_code=204)
