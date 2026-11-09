from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from .test_er_workflows import post, publish, setup_plan

from server.main import app


def domain_operations():
    for path, methods in app.openapi()["paths"].items():
        if not any(
            path == "/api/v1/" + module or path.startswith("/api/v1/" + module + "/")
            for module in ("school", "rooms", "timetable", "classbook")
        ):
            continue
        for method in methods:
            if method in {"get", "post", "put", "patch", "delete"}:
                yield path, method


@pytest.mark.parametrize("path,method", list(domain_operations()))
def test_every_domain_endpoint_requires_authentication(path, method):
    import re

    path = re.sub(r"\{[^}]+\}", str(uuid4()), path)
    client = TestClient(app, headers={"X-Requested-With": "bod"})
    try:
        response = client.request(method, path, json={})
    finally:
        client.close()
    assert response.status_code == 401, (method, path, response.text)


def test_class_enrollments_are_exclusive_and_bounded(api, teacher, student):
    data = setup_plan(api, teacher, student)
    response = api.post(
        "/api/v1/school/class-enrollments",
        json={
            "student_id": str(student.actor_id),
            "class_id": data["cls"]["id"],
            "valid_from": "2026-10-01",
        },
    )
    assert response.status_code == 409, response.text
    response = api.post(
        "/api/v1/school/class-enrollments",
        json={
            "student_id": str(student.actor_id),
            "class_id": data["cls"]["id"],
            "valid_from": "2026-08-01",
            "valid_to": "2026-08-31",
        },
    )
    assert response.status_code == 422


def test_slots_do_not_overlap_but_can_touch(api):
    grid = post(api, "timetable/time-grids", {"name": "Test"})
    post(
        api,
        "timetable/time-slots",
        {
            "time_grid_id": grid["id"],
            "position": 1,
            "start_time": "08:00",
            "end_time": "08:45",
        },
    )
    response = api.post(
        "/api/v1/timetable/time-slots",
        json={
            "time_grid_id": grid["id"],
            "position": 2,
            "start_time": "08:30",
            "end_time": "09:00",
        },
    )
    assert response.status_code == 409
    post(
        api,
        "timetable/time-slots",
        {
            "time_grid_id": grid["id"],
            "position": 2,
            "start_time": "08:45",
            "end_time": "09:30",
        },
    )


def test_wrong_cycle_and_holiday_cannot_be_materialized(api, teacher, student):
    data = setup_plan(api, teacher, student)
    post(
        api,
        "timetable/teaching-plan-calendar-days",
        {
            "teaching_plan_id": data["plan"]["id"],
            "calendar_date": "2026-09-08",
            "is_teaching_day": False,
            "reason": "Volno",
        },
    )
    publish(api, data)
    for entry, day in [
        (data["entries"][1], "2026-09-01"),
        (data["entries"][0], "2026-09-08"),
    ]:
        response = api.post(
            "/api/v1/timetable/lesson-occurrences",
            json={"timetable_entry_id": entry["id"], "scheduled_date": day},
        )
        assert response.status_code == 422


def test_teacher_collision_rejects_publication_atomically(api, teacher, student):
    data = setup_plan(api, teacher, student)
    subject = post(api, "school/subjects", {"code": "FYZ", "name": "Fyzika"})
    assignment = post(
        api,
        "timetable/teaching-assignments",
        {
            "teaching_plan_id": data["plan"]["id"],
            "group_id": data["group"]["id"],
            "subject_id": subject["id"],
            "teacher_id": str(teacher.actor_id),
        },
    )
    post(
        api,
        "timetable/teaching-assignment-weeks",
        {
            "teaching_assignment_id": assignment["id"],
            "cycle_week_id": data["weeks"][0]["id"],
            "periods": 1,
        },
    )
    post(
        api,
        "timetable/timetable-entries",
        {
            "timetable_version_id": data["version"]["id"],
            "teaching_assignment_id": assignment["id"],
            "cycle_week_id": data["weeks"][0]["id"],
            "day_of_week": 2,
            "time_slot_id": data["slot"]["id"],
        },
    )
    response = api.post(
        f"/api/v1/timetable/timetable-versions/{data['version']['id']}/publish"
    )
    assert response.status_code == 409, response.text
    assert (
        api.get("/api/v1/timetable/timetable-versions/" + data["version"]["id"]).json()[
            "status"
        ]
        == "draft"
    )


def test_substitution_collision_is_rolled_back_and_cancellation_frees_slot(
    api, teacher, student
):
    data = setup_plan(api, teacher, student)
    publish(api, data)
    occurrences = [
        post(
            api,
            "timetable/lesson-occurrences",
            {"timetable_entry_id": data["entries"][0]["id"], "scheduled_date": day},
        )
        for day in ("2026-09-01", "2026-09-08")
    ]
    payload = {
        "lesson_occurrence_id": occurrences[1]["id"],
        "change_type": "modified",
        "replacement_date": "2026-09-01",
    }
    response = api.post("/api/v1/timetable/lesson-changes", json=payload)
    assert response.status_code == 409
    assert api.get("/api/v1/timetable/lesson-changes").json() == []
    cancellation = post(
        api,
        "timetable/lesson-changes",
        {"lesson_occurrence_id": occurrences[0]["id"], "change_type": "cancelled"},
    )
    post(api, "timetable/lesson-changes", payload)
    # Restoring the cancelled original would collide with the moved lesson.
    assert (
        api.delete("/api/v1/timetable/lesson-changes/" + cancellation["id"]).status_code
        == 409
    )


def test_cloning_a_published_version_makes_cycle_editable(api, teacher, student):
    data = setup_plan(api, teacher, student)
    publish(api, data)
    clone = post(
        api,
        "timetable/timetable-versions/" + data["version"]["id"] + "/clone",
        {"name": "Nová varianta", "plan_name": "Nový plán"},
    )
    assert (
        clone["status"] == "draft" and clone["teaching_plan_id"] != data["plan"]["id"]
    )
    steps = api.get("/api/v1/timetable/teaching-cycle-steps").json()
    copied = next(
        s
        for s in steps
        if s["teaching_plan_id"] == clone["teaching_plan_id"] and s["position"] == 1
    )
    assert (
        api.patch(
            "/api/v1/timetable/teaching-cycle-steps/" + copied["id"],
            json={"duration_weeks": 4},
        ).status_code
        == 200
    )
    assert (
        api.get("/api/v1/timetable/teaching-plans/" + clone["teaching_plan_id"]).json()[
            "frozen_at"
        ]
        is None
    )


def test_generation_preserves_old_memberships_and_requires_confirmation(
    api, teacher, student
):
    data = setup_plan(api, teacher, student)
    division = post(
        api,
        "school/group-divisions",
        {
            "class_id": data["cls"]["id"],
            "name": "Jazyky",
            "method": "alphabetical",
            "effective_from": "2026-09-01",
        },
    )
    for i in (1, 2):
        post(
            api,
            "school/teaching-groups",
            {
                "school_year_id": data["year"]["id"],
                "name": f"Jazyky {i}",
                "membership_mode": "explicit",
                "division_id": division["id"],
                "position": i,
            },
        )
    path = "/api/v1/school/group-divisions/" + division["id"] + "/generate"
    first = api.post(path, json={"effective_from": "2026-09-01"})
    assert first.status_code == 200, first.text
    assert first.json()[0]["origin"] == "generated"
    # A generated membership can be closed manually without forging its origin.
    changed = api.patch(
        "/api/v1/school/teaching-group-memberships/" + first.json()[0]["id"],
        json={"valid_to": "2027-07-01"},
    )
    assert changed.status_code == 200 and changed.json()["origin"] == "generated"
    assert api.post(path, json={"effective_from": "2026-10-01"}).status_code == 409
    assert (
        api.post(
            path, json={"effective_from": "2026-10-01", "confirm_recompute": True}
        ).status_code
        == 200
    )
    memberships = api.get("/api/v1/school/teaching-group-memberships").json()
    assert len(memberships) == 2
    assert any(m["valid_to"] == "2026-10-01" for m in memberships)


@pytest.mark.postgres
def test_simultaneous_publication_cannot_publish_twice(api, teacher, student):
    data = setup_plan(api, teacher, student)
    path = f"/api/v1/timetable/timetable-versions/{data['version']['id']}/publish"

    def call():
        with TestClient(app, headers={"X-Requested-With": "bod"}) as client:
            client.cookies.update(api.cookies)
            return client.post(path).status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = sorted(pool.map(lambda _: call(), range(2)))
    assert results == [200, 422]


def test_revoked_permission_cannot_write(api, engine):
    with engine.begin() as connection:
        connection.execute(
            text(
                "DELETE FROM role_permissions WHERE role_code='school_manager' "
                "AND permission_code='school.manage'"
            )
        )
    response = api.post("/api/v1/school/subjects", json={"code": "X", "name": "Test"})
    assert response.status_code == 403


def test_parent_scope_requires_explicit_link(api, teacher, student, clients):
    data = setup_plan(api, teacher, student)
    publish(api, data)
    parent = clients(
        "parent", {"timetable.read", "classbook.read", "attendance.request"}
    )
    params = {
        "date_from": "2026-09-01",
        "date_to": "2026-09-23",
        "student_id": str(student.actor_id),
    }
    assert parent.get("/api/v1/timetable/schedule", params=params).status_code == 403
    assert (
        parent.get(
            "/api/v1/classbook/my-attendance",
            params={"student_id": str(student.actor_id)},
        ).status_code
        == 403
    )
    post(
        api,
        "school/parent-students",
        {"parent_id": str(parent.actor_id), "student_id": str(student.actor_id)},
    )
    response = parent.get("/api/v1/timetable/schedule", params=params)
    assert response.status_code == 200 and len(response.json()) == 4


def test_teacher_cannot_materialize_another_teachers_lesson(
    api, teacher, student, clients
):
    data = setup_plan(api, teacher, student)
    publish(api, data)
    outsider = clients("teacher")
    response = outsider.post(
        "/api/v1/timetable/materialize",
        json={
            "timetable_entry_id": data["entries"][0]["id"],
            "scheduled_date": "2026-09-01",
        },
    )
    assert response.status_code == 403


def test_local_bell_times_reject_timezone(api):
    grid = post(api, "timetable/time-grids", {"name": "Zvonění"})
    response = api.post(
        "/api/v1/timetable/time-slots",
        json={
            "time_grid_id": grid["id"],
            "position": 1,
            "start_time": "08:00:00+02:00",
            "end_time": "08:45:00+02:00",
        },
    )
    assert response.status_code == 422


@pytest.mark.postgres
def test_database_supplies_er_defaults(engine):
    with engine.begin() as connection:
        row = connection.execute(
            text(
                "INSERT INTO subjects (code,name) VALUES ('DEFAULT','Výchozí') "
                "RETURNING id"
            )
        ).first()
        assert row and row.id is not None


@pytest.mark.postgres
def test_database_excludes_subsecond_slot_overlap(engine):
    from sqlalchemy.exc import IntegrityError

    with engine.begin() as connection:
        grid_id = connection.execute(
            text("INSERT INTO time_grids (name) VALUES ('Seconds') RETURNING id")
        ).scalar_one()
        connection.execute(
            text(
                "INSERT INTO time_slots (time_grid_id,position,start_time,end_time) "
                "VALUES (:grid,1,'08:00:00.1','08:00:00.4')"
            ),
            {"grid": grid_id},
        )
    with pytest.raises(IntegrityError), engine.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO time_slots (time_grid_id,position,start_time,end_time) "
                "VALUES (:grid,2,'08:00:00.2','08:00:00.3')"
            ),
            {"grid": grid_id},
        )


def test_schedule_loads_rosters_in_batches(api, teacher, student, engine):
    from sqlalchemy import event

    data = setup_plan(api, teacher, student)
    publish(api, data)
    queries = []

    def record(connection, cursor, statement, parameters, context, executemany):
        queries.append(statement)

    event.listen(engine, "before_cursor_execute", record)
    try:
        response = student.get(
            "/api/v1/timetable/schedule",
            params={"date_from": "2026-09-01", "date_to": "2026-09-23"},
        )
    finally:
        event.remove(engine, "before_cursor_execute", record)
    assert response.status_code == 200 and len(response.json()) == 4
    assert len(queries) < 40
