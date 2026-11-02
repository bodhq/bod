from server.core.domain.resource import Resource

from . import models, schemas

RESOURCES = [
    Resource(
        "classbook_entries",
        models.ClassbookEntries,
        schemas.ClassbookEntriesCreate,
        schemas.ClassbookEntriesPatch,
        schemas.ClassbookEntriesRead,
        "classbook.manage",
    ),
    Resource(
        "classbook_participants",
        models.ClassbookParticipants,
        schemas.ClassbookParticipantsCreate,
        schemas.ClassbookParticipantsPatch,
        schemas.ClassbookParticipantsRead,
        "classbook.manage",
    ),
    Resource(
        "attendance_records",
        models.AttendanceRecords,
        schemas.AttendanceRecordsCreate,
        schemas.AttendanceRecordsPatch,
        schemas.AttendanceRecordsRead,
        "classbook.manage",
    ),
    Resource(
        "absence_excuse_requests",
        models.AbsenceExcuseRequests,
        schemas.AbsenceExcuseRequestsCreate,
        schemas.AbsenceExcuseRequestsPatch,
        schemas.AbsenceExcuseRequestsRead,
        "classbook.manage",
    ),
    Resource(
        "absence_excuse_items",
        models.AbsenceExcuseItems,
        schemas.AbsenceExcuseItemsCreate,
        schemas.AbsenceExcuseItemsPatch,
        schemas.AbsenceExcuseItemsRead,
        "classbook.manage",
    ),
]
