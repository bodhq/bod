"""Regression tests for complete role-scoped school workflows."""

from uuid import uuid4

import pytest

from .test_er_workflows import post, publish, setup_plan


def make_lesson(api, teacher, student, *, signed=False):
    data = setup_plan(api, teacher, student)
    lesson = post(
        teacher,
        "classbook/lessons",
        {
            "group_id": data["group"]["id"],
            "subject_id": data["subject"]["id"],
            "actual_teacher_id": str(teacher.actor_id),
            "starts_at": "2026-09-01T08:00:00+02:00",
            "ends_at": "2026-09-01T08:45:00+02:00",
            "topic": "Rovnice",
            "note": "Interní poznámka učitele",
        },
    )
    if signed:
        response = teacher.post(
            f"/api/v1/classbook/classbook-entries/{lesson['id']}/sign"
        )
        assert response.status_code == 200, response.text
        lesson = response.json()
    return data, lesson


def mark(teacher, lesson, student, **fields):
    return teacher.put(
        f"/api/v1/classbook/classbook-entries/{lesson['id']}/attendance",
        json={
            "student_id": str(student.actor_id),
            "status": "absent",
            **fields,
        },
    )


def test_next_year_enrollment_has_bounded_end(api, teacher, student):
    data = setup_plan(api, teacher, student)
    enrollment = api.get("/api/v1/school/class-enrollments").json()[0]
    assert enrollment["valid_to"] == "2027-07-01"
    assert data["version"]["valid_to"] == "2027-07-01"
    year = post(
        api,
        "school/school-years",
        {
            "name": "2027/2028",
            "starts_on": "2027-09-01",
            "ends_on": "2028-07-01",
        },
    )
    cls = post(api, "school/classes", {"school_year_id": year["id"], "name": "2.A"})
    post(
        api,
        "school/class-enrollments",
        {
            "student_id": str(student.actor_id),
            "class_id": cls["id"],
            "valid_from": "2027-09-01",
        },
    )


def test_required_room_type_blocks_publication_without_room(api, teacher, student):
    data = setup_plan(api, teacher, student)
    post(api, "rooms/room-types", {"code": "LAB", "name": "Laboratoř"})
    response = api.patch(
        f"/api/v1/timetable/teaching-assignments/{data['assignment']['id']}",
        json={"required_room_type_code": "LAB"},
    )
    assert response.status_code == 200
    response = api.post(
        f"/api/v1/timetable/timetable-versions/{data['version']['id']}/publish"
    )
    assert response.status_code == 422
    assert "místnost" in response.json()["error"]["message"]


def test_absence_is_recorded_and_schedule_shows_unresolved_work(api, teacher, student):
    data = setup_plan(api, teacher, student)
    publish(api, data)
    post(
        api,
        "timetable/teacher-unavailability",
        {
            "teacher_id": str(teacher.actor_id),
            "starts_at": "2026-09-01T05:00:00Z",
            "ends_at": "2026-09-01T08:00:00Z",
            "reason": "Nemoc",
        },
    )
    response = student.get(
        "/api/v1/timetable/schedule",
        params={
            "date_from": "2026-09-01",
            "date_to": "2026-09-02",
        },
    )
    lesson = response.json()[0]
    assert lesson["unresolved_reasons"] == ["teacher_unavailable"]
    assert lesson["subject_name"] == "Matematika"
    assert lesson["group_name"] == "1.A"
    assert lesson["teacher_name"]


def test_draft_delete_cleans_roster_but_retains_attendance(api, teacher, student):
    _, lesson = make_lesson(api, teacher, student)
    path = f"/api/v1/classbook/lessons/{lesson['id']}"
    assert mark(teacher, lesson, student).status_code == 200
    assert teacher.delete(path).status_code == 409
    record = api.get("/api/v1/classbook/attendance-records").json()[0]
    assert (
        api.delete(f"/api/v1/classbook/attendance-records/{record['id']}").status_code
        == 204
    )
    assert teacher.delete(path).status_code == 204
    assert api.get("/api/v1/classbook/classbook-participants").json() == []


def test_manual_lesson_requires_assignment_and_rejects_duplicate(
    api, teacher, student, clients
):
    data, lesson = make_lesson(api, teacher, student)
    payload = {
        key: lesson[key]
        for key in (
            "group_id",
            "subject_id",
            "actual_teacher_id",
            "starts_at",
            "ends_at",
            "topic",
        )
    }
    assert teacher.post("/api/v1/classbook/lessons", json=payload).status_code == 409
    outsider = clients("teacher")
    payload.update(
        actual_teacher_id=str(outsider.actor_id),
        starts_at="2026-09-02T08:00:00+02:00",
        ends_at="2026-09-02T08:45:00+02:00",
    )
    assert outsider.post("/api/v1/classbook/lessons", json=payload).status_code == 403


def test_absence_minutes_and_draft_visibility(api, teacher, student):
    _, lesson = make_lesson(api, teacher, student)
    assert mark(teacher, lesson, student, missed_minutes=0).status_code == 422
    response = mark(teacher, lesson, student)
    assert response.status_code == 200, response.text
    assert response.json()["missed_minutes"] == 45
    response = student.post(
        "/api/v1/classbook/excuse-requests",
        json={
            "student_id": str(student.actor_id),
            "reason": "Nemoc",
            "attendance_record_ids": [response.json()["id"]],
        },
    )
    assert response.status_code == 422
    assert student.get("/api/v1/classbook/my-attendance").json() == []
    assert student.get(f"/api/v1/classbook/lessons/{lesson['id']}").status_code == 403
    assert (
        teacher.post(
            f"/api/v1/classbook/classbook-entries/{lesson['id']}/sign"
        ).status_code
        == 200
    )
    assert len(student.get("/api/v1/classbook/my-attendance").json()) == 1


def test_lesson_detail_is_scoped_and_notes_are_private(api, teacher, student, clients):
    _, lesson = make_lesson(api, teacher, student, signed=True)
    path = f"/api/v1/classbook/lessons/{lesson['id']}"
    response = teacher.get(path)
    assert response.status_code == 200, response.text
    assert response.json()["participants"][0]["student_id"] == str(student.actor_id)
    assert response.json()["lesson"]["note"]
    assert student.get(path).json()["lesson"]["note"] is None
    assert student.get("/api/v1/classbook/my-lessons").json()[0]["note"] is None
    outsider = clients("teacher")
    assert outsider.get(path).status_code == 403
    other_student = clients("student")
    assert other_student.get(path).status_code == 403
    parent = clients("parent")
    assert parent.get(path).status_code == 403
    post(
        api,
        "school/parent-students",
        {"parent_id": str(parent.actor_id), "student_id": str(student.actor_id)},
    )
    assert parent.get(path).status_code == 200
    children = parent.get("/api/v1/classbook/my-children").json()
    assert children[0]["student_id"] == str(student.actor_id)


def test_excuse_inbox_detail_and_decision_scopes(api, teacher, student, clients):
    _, lesson = make_lesson(api, teacher, student)
    record = mark(teacher, lesson, student).json()
    teacher.post(f"/api/v1/classbook/classbook-entries/{lesson['id']}/sign")
    request = post(
        student,
        "classbook/excuse-requests",
        {
            "student_id": str(student.actor_id),
            "reason": "Nemoc",
            "attendance_record_ids": [record["id"]],
        },
    )
    assert (
        teacher.get("/api/v1/classbook/excuse-inbox").json()[0]["id"] == request["id"]
    )
    path = f"/api/v1/classbook/excuse-requests/{request['id']}"
    detail = teacher.get(path)
    assert detail.status_code == 200, detail.text
    assert detail.json()["items"][0]["can_decide"] is True
    assert student.get(path).json()["items"][0]["can_decide"] is False
    manager = clients("classbook_manager", {"classbook.manage"})
    assert manager.get(path).json()["items"][0]["can_decide"] is False
    outsider = clients("teacher")
    assert outsider.get("/api/v1/classbook/excuse-inbox").json() == []
    assert outsider.get(path).status_code == 403
    response = teacher.post(
        f"{path}/items/{record['id']}/decide", json={"decision": "approved"}
    )
    assert response.status_code == 200
    assert teacher.get("/api/v1/classbook/excuse-inbox").json() == []
    assert student.get(path).json()["items"][0]["item"]["decision"] == "approved"


def test_attendance_batch_is_atomic(api, teacher, student):
    _, lesson = make_lesson(api, teacher, student)
    path = f"/api/v1/classbook/lessons/{lesson['id']}/attendance"
    records = [
        {"student_id": str(student.actor_id), "status": "present"},
        {"student_id": str(uuid4()), "status": "present"},
    ]
    assert teacher.put(path, json={"records": records}).status_code == 404
    assert api.get("/api/v1/classbook/attendance-records").json() == []
    assert teacher.put(path, json={"records": records[:1] * 2}).status_code == 422
    assert teacher.put(path, json={"records": records[:1]}).status_code == 200


def test_stale_edits_and_signed_corrections(api, teacher, student):
    _, lesson = make_lesson(api, teacher, student)
    path = f"/api/v1/classbook/lessons/{lesson['id']}"
    payload = {"topic": "Nové téma", "expected_updated_at": lesson["updated_at"]}
    assert teacher.patch(path, json=payload).status_code == 200
    assert teacher.patch(path, json=payload).status_code == 409
    signed = teacher.post(
        f"/api/v1/classbook/classbook-entries/{lesson['id']}/sign"
    ).json()
    assert teacher.patch(path, json={"topic": "Oprava"}).status_code == 422
    assert (
        teacher.patch(
            path,
            json={
                "topic": "Oprava",
                "correction_reason": "Překlep",
                "expected_updated_at": signed["updated_at"],
            },
        ).status_code
        == 200
    )


def test_period_filter_and_pagination_apply_to_visible_lessons(api, teacher, student):
    _, lesson = make_lesson(api, teacher, student, signed=True)
    assert (
        teacher.get("/api/v1/classbook/my-lessons", params={"offset": 1}).json() == []
    )
    assert (
        student.get(
            "/api/v1/classbook/my-lessons", params={"date_from": "2026-09-02"}
        ).json()
        == []
    )
    assert (
        teacher.get(
            "/api/v1/classbook/my-lessons",
            params={"date_from": "2026-09-02", "date_to": "2026-09-01"},
        ).status_code
        == 422
    )


@pytest.mark.postgres
def test_workflow_reads_on_postgres(api, teacher, student, clients):
    test_excuse_inbox_detail_and_decision_scopes(api, teacher, student, clients)


def test_schedule_keeps_moved_and_cancelled_lessons(api, teacher, student):
    data = setup_plan(api, teacher, student)
    publish(api, data)
    occurrence = post(
        api,
        "timetable/lesson-occurrences",
        {
            "timetable_entry_id": data["entries"][0]["id"],
            "scheduled_date": "2026-09-01",
        },
    )
    post(
        api,
        "timetable/lesson-changes",
        {
            "lesson_occurrence_id": occurrence["id"],
            "change_type": "modified",
            "replacement_date": "2026-09-07",
        },
    )
    path = "/api/v1/timetable/schedule"
    moved = student.get(
        path, params={"date_from": "2026-09-07", "date_to": "2026-09-08"}
    ).json()
    assert len(moved) == 1
    assert moved[0]["scheduled_date"] == "2026-09-01"
    assert moved[0]["change_type"] == "modified"
    assert moved[0]["original_starts_at"].startswith("2026-09-01")
    assert (
        student.get(
            path, params={"date_from": "2026-09-01", "date_to": "2026-09-02"}
        ).json()
        == []
    )
    post(
        api,
        "timetable/lesson-changes",
        {
            "lesson_occurrence_id": post(
                api,
                "timetable/lesson-occurrences",
                {
                    "timetable_entry_id": data["entries"][0]["id"],
                    "scheduled_date": "2026-09-08",
                },
            )["id"],
            "change_type": "cancelled",
        },
    )
    params = {"date_from": "2026-09-08", "date_to": "2026-09-09"}
    assert student.get(path, params=params).json() == []
    assert (
        student.get(path, params=params | {"include_cancelled": True}).json()[0][
            "change_type"
        ]
        == "cancelled"
    )


def test_timetable_edit_rejects_stale_state(api, teacher, student):
    data = setup_plan(api, teacher, student)
    entry = data["entries"][0]
    path = f"/api/v1/timetable/timetable-entries/{entry['id']}"
    assert api.patch(path, json={"day_of_week": 3}).status_code == 422
    payload = {"day_of_week": 3, "expected_state": entry}
    assert api.patch(path, json=payload).status_code == 200
    assert api.patch(path, json=payload).status_code == 409


def test_custom_role_school_scope_does_not_combine_permissions(api, student, clients):
    response = api.post(
        "/api/v1/admin/roles",
        json={
            "code": "custom_teacher",
            "name": "Vyučující",
            "school_role_code": "teacher",
            "permission_codes": ["timetable.read", "classbook.read", "classbook.write"],
        },
    )
    assert response.status_code == 201, response.text
    teacher = clients("custom_teacher")
    data = setup_plan(api, teacher, student)
    publish(api, data)
    response = teacher.get(
        "/api/v1/timetable/schedule",
        params={
            "date_from": "2026-09-01",
            "date_to": "2026-09-02",
        },
    )
    assert response.status_code == 200 and len(response.json()) == 1
    lesson = post(
        teacher,
        "classbook/lessons",
        {
            "group_id": data["group"]["id"],
            "subject_id": data["subject"]["id"],
            "actual_teacher_id": str(teacher.actor_id),
            "starts_at": "2026-09-01T08:00:00+02:00",
            "ends_at": "2026-09-01T08:45:00+02:00",
        },
    )
    assert teacher.get(f"/api/v1/classbook/lessons/{lesson['id']}").status_code == 200
    assert mark(teacher, lesson, student).status_code == 403


@pytest.mark.postgres
def test_migration_bounds_existing_annual_intervals(api, teacher, student, engine):
    from sqlalchemy import text
    from server.core.migrations import migrate

    data = setup_plan(api, teacher, student)
    publish(api, data)
    with engine.begin() as connection:
        connection.execute(
            text("ALTER TABLE timetable_versions DISABLE TRIGGER guard_er_history")
        )
        connection.execute(text("UPDATE timetable_versions SET valid_to=NULL"))
        connection.execute(
            text("ALTER TABLE timetable_versions ENABLE TRIGGER guard_er_history")
        )
        connection.execute(text("UPDATE class_enrollments SET valid_to=NULL"))
        connection.execute(
            text(
                "DELETE FROM schema_migrations WHERE version='20261113_07_annual_intervals'"
            )
        )
    migrate(engine)
    assert (
        api.get("/api/v1/school/class-enrollments").json()[0]["valid_to"]
        == "2027-07-01"
    )
    version = api.get(
        f"/api/v1/timetable/timetable-versions/{data['version']['id']}"
    ).json()
    assert version["status"] == "published" and version["valid_to"] == "2027-07-01"


@pytest.mark.postgres
def test_independent_lessons_do_not_share_exclusive_write_lock(
    api, teacher, student, engine
):
    from concurrent.futures import ThreadPoolExecutor
    from fastapi.testclient import TestClient
    from sqlalchemy import text
    from server.main import app

    data, lesson = make_lesson(api, teacher, student)
    second = post(
        teacher,
        "classbook/lessons",
        {
            "group_id": data["group"]["id"],
            "subject_id": data["subject"]["id"],
            "actual_teacher_id": str(teacher.actor_id),
            "starts_at": "2026-09-02T08:00:00+02:00",
            "ends_at": "2026-09-02T08:45:00+02:00",
        },
    )

    def write_other():
        with TestClient(app, headers={"X-Requested-With": "bod"}) as client:
            client.cookies.update(teacher.cookies)
            return mark(client, second, student).status_code

    with engine.connect() as connection, ThreadPoolExecutor(max_workers=1) as pool:
        transaction = connection.begin()
        connection.execute(text("SELECT pg_advisory_xact_lock_shared(7463812041)"))
        connection.execute(text("SELECT pg_advisory_xact_lock_shared(7463812042)"))
        connection.execute(
            text("SELECT pg_advisory_xact_lock(hashtextextended(:key,0))"),
            {"key": "bod:classbook:entry:" + lesson["id"]},
        )
        future = pool.submit(write_other)
        try:
            assert future.result(timeout=5) == 200
        finally:
            transaction.rollback()


def test_historical_membership_change_still_rejects_student_collision(
    api, teacher, student, clients
):
    data = setup_plan(api, teacher, student)
    other = clients("teacher")
    group = post(
        api,
        "school/teaching-groups",
        {
            "school_year_id": data["year"]["id"],
            "name": "Druhá skupina",
            "membership_mode": "explicit",
        },
    )
    assignment = post(
        api,
        "timetable/teaching-assignments",
        {
            "teaching_plan_id": data["plan"]["id"],
            "group_id": group["id"],
            "subject_id": data["subject"]["id"],
            "teacher_id": str(other.actor_id),
        },
    )
    for week in data["weeks"]:
        post(
            api,
            "timetable/teaching-assignment-weeks",
            {
                "teaching_assignment_id": assignment["id"],
                "cycle_week_id": week["id"],
                "periods": 1,
            },
        )
        post(
            api,
            "timetable/timetable-entries",
            {
                "timetable_version_id": data["version"]["id"],
                "teaching_assignment_id": assignment["id"],
                "cycle_week_id": week["id"],
                "day_of_week": 2,
                "time_slot_id": data["slot"]["id"],
            },
        )
    publish(api, data)
    response = api.post(
        "/api/v1/school/teaching-group-memberships",
        json={
            "group_id": group["id"],
            "student_id": str(student.actor_id),
            "valid_from": "2026-09-01",
            "valid_to": "2026-09-02",
        },
    )
    assert response.status_code == 409, response.text
    assert api.get("/api/v1/school/teaching-group-memberships").json() == []


def test_current_room_type_does_not_revalidate_archived_requirements(
    api, teacher, student, monkeypatch
):
    from datetime import UTC, datetime

    data = setup_plan(api, teacher, student)
    post(api, "rooms/room-types", {"code": "LAB", "name": "Laboratoř"})
    post(api, "rooms/room-types", {"code": "STD", "name": "Běžná učebna"})
    room = post(
        api,
        "rooms",
        {"code": "A1", "name": "Laboratoř", "capacity": 30, "room_type_code": "LAB"},
    )
    api.patch(
        f"/api/v1/timetable/teaching-assignments/{data['assignment']['id']}",
        json={"required_room_type_code": "LAB"},
    )
    for entry in data["entries"]:
        response = api.patch(
            f"/api/v1/timetable/timetable-entries/{entry['id']}",
            json={"room_id": room["id"], "expected_state": entry},
        )
        assert response.status_code == 200, response.text
    publish(api, data)
    response = api.post(
        f"/api/v1/timetable/timetable-versions/{data['version']['id']}/close",
        json={"valid_to": "2026-09-02"},
    )
    assert response.status_code == 200, response.text
    for module in (
        "rooms.domain_service",
        "school.domain_service",
        "timetable.services",
    ):
        monkeypatch.setattr(
            "server.modules." + module + ".utcnow",
            lambda: datetime(2028, 1, 1, tzinfo=UTC),
        )
    response = api.patch(f"/api/v1/rooms/{room['id']}", json={"room_type_code": "STD"})
    assert response.status_code == 200, response.text
    enrollment = api.get("/api/v1/school/class-enrollments").json()[0]
    response = api.patch(
        f"/api/v1/school/class-enrollments/{enrollment['id']}",
        json={"valid_to": "2026-09-03"},
    )
    assert response.status_code == 200, response.text
