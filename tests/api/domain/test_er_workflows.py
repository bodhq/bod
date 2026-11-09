from datetime import date, timedelta
from uuid import uuid4

import pytest
from sqlalchemy import inspect, text

from server.core.migrations import migrate
from server.modules.timetable.cycles import cycle_type


def post(api, path, payload):
    response = api.post("/api/v1/" + path, json=payload)
    assert response.status_code == 201, response.text
    return response.json()


def setup_plan(api, teacher, student):
    year = post(
        api,
        "school/school-years",
        {"name": "2026/2027", "starts_on": "2026-09-01", "ends_on": "2027-07-01"},
    )
    cls = post(
        api,
        "school/classes",
        {
            "school_year_id": year["id"],
            "name": "1.A",
            "class_teacher_id": str(teacher.actor_id),
        },
    )
    post(
        api,
        "school/class-enrollments",
        {
            "student_id": str(student.actor_id),
            "class_id": cls["id"],
            "valid_from": "2026-09-01",
        },
    )
    group = post(
        api,
        "school/teaching-groups",
        {
            "school_year_id": year["id"],
            "name": "1.A",
            "membership_mode": "class_enrollment",
            "source_class_id": cls["id"],
        },
    )
    subject = post(api, "school/subjects", {"code": "MAT", "name": "Matematika"})
    plan = post(
        api,
        "timetable/teaching-plans",
        {
            "school_year_id": year["id"],
            "name": "Plán",
            "cycle_anchor_monday": "2026-08-31",
        },
    )
    weeks = [
        post(
            api,
            "timetable/teaching-cycle-weeks",
            {"teaching_plan_id": plan["id"], "position": i, "code": code},
        )
        for i, code in enumerate(["A", "B"], 1)
    ]
    for i, week in enumerate(weeks, 1):
        post(
            api,
            "timetable/teaching-cycle-steps",
            {
                "teaching_plan_id": plan["id"],
                "position": i,
                "cycle_week_id": week["id"],
                "duration_weeks": 2 if i == 1 else 1,
            },
        )
    assignment = post(
        api,
        "timetable/teaching-assignments",
        {
            "teaching_plan_id": plan["id"],
            "group_id": group["id"],
            "subject_id": subject["id"],
            "teacher_id": str(teacher.actor_id),
        },
    )
    grid = post(api, "timetable/time-grids", {"name": "Zvonění"})
    slot = post(
        api,
        "timetable/time-slots",
        {
            "time_grid_id": grid["id"],
            "position": 1,
            "start_time": "08:00",
            "end_time": "08:45",
        },
    )
    distances = post(api, "rooms/room-distance-models", {"name": "Budova"})
    version = post(
        api,
        "timetable/timetable-versions",
        {
            "teaching_plan_id": plan["id"],
            "time_grid_id": grid["id"],
            "distance_model_id": distances["id"],
            "name": "Varianta",
            "valid_from": "2026-09-01",
        },
    )
    entries = []
    for week in weeks:
        post(
            api,
            "timetable/teaching-assignment-weeks",
            {
                "teaching_assignment_id": assignment["id"],
                "cycle_week_id": week["id"],
                "periods": 1,
            },
        )
        entries.append(
            post(
                api,
                "timetable/timetable-entries",
                {
                    "timetable_version_id": version["id"],
                    "teaching_assignment_id": assignment["id"],
                    "cycle_week_id": week["id"],
                    "day_of_week": 2,
                    "time_slot_id": slot["id"],
                },
            )
        )
    return locals()


def publish(api, data):
    response = api.post(
        f"/api/v1/timetable/timetable-versions/{data['version']['id']}/publish"
    )
    assert response.status_code == 200, response.text
    return response.json()


def test_custom_cycle_repeats_and_handles_dates_before_anchor():
    a, b = uuid4(), uuid4()
    steps = [
        {"position": 1, "cycle_week_id": a, "duration_weeks": 2},
        {"position": 2, "cycle_week_id": b, "duration_weeks": 1},
    ]
    anchor = date(2026, 8, 31)
    assert [
        cycle_type(anchor, anchor + timedelta(weeks=i), steps) for i in range(7)
    ] == [a, a, b, a, a, b, a]
    assert cycle_type(anchor, anchor - timedelta(weeks=1), steps) == b


def test_calendar_override_survives_regeneration(api, teacher, student):
    data = setup_plan(api, teacher, student)
    base = "/api/v1/timetable/teaching-plan-calendar-weeks/" + data["plan"]["id"]
    response = api.patch(
        base + "/2026-09-07",
        json={"cycle_week_id": data["weeks"][1]["id"], "is_override": True},
    )
    assert response.status_code == 200, response.text
    step = next(
        row
        for row in api.get("/api/v1/timetable/teaching-cycle-steps").json()
        if row["position"] == 1
    )
    response = api.patch(
        "/api/v1/timetable/teaching-cycle-steps/" + step["id"],
        json={"duration_weeks": 3},
    )
    assert response.status_code == 200, response.text
    assert (
        api.get(base + "/2026-09-07").json()["cycle_week_id"] == data["weeks"][1]["id"]
    )
    assert (
        api.get(base + "/2026-09-14").json()["cycle_week_id"] == data["weeks"][0]["id"]
    )


def test_publication_freezes_dependencies_and_scopes_schedule(
    api, teacher, student, clients
):
    data = setup_plan(api, teacher, student)
    publish(api, data)
    for path, payload in [
        ("teaching-plans/" + data["plan"]["id"], {"name": "Změna"}),
        ("time-slots/" + data["slot"]["id"], {"end_time": "09:00"}),
        ("timetable-entries/" + data["entries"][0]["id"], {"day_of_week": 3}),
    ]:
        assert api.patch("/api/v1/timetable/" + path, json=payload).status_code == 409
    params = {"date_from": "2026-09-01", "date_to": "2026-09-23"}
    response = student.get("/api/v1/timetable/schedule", params=params)
    assert response.status_code == 200, response.text
    assert len(response.json()) == 4
    outsider = clients("student")
    assert outsider.get("/api/v1/timetable/schedule", params=params).json() == []
    assert outsider.get("/api/v1/timetable/teaching-plans").status_code == 403


def test_publication_rejects_missing_period_and_conflicting_teacher(
    api, teacher, student
):
    data = setup_plan(api, teacher, student)
    entry = data["entries"][1]
    assert (
        api.delete("/api/v1/timetable/timetable-entries/" + entry["id"]).status_code
        == 204
    )
    response = api.post(
        f"/api/v1/timetable/timetable-versions/{data['version']['id']}/publish"
    )
    assert response.status_code == 422
    assert (
        api.get("/api/v1/timetable/teaching-plans/" + data["plan"]["id"]).json()[
            "frozen_at"
        ]
        is None
    )


def test_classbook_snapshot_attendance_and_excuse(api, teacher, student):
    data = setup_plan(api, teacher, student)
    publish(api, data)
    occurrence = teacher.post(
        "/api/v1/timetable/materialize",
        json={
            "timetable_entry_id": data["entries"][0]["id"],
            "scheduled_date": "2026-09-01",
        },
    )
    assert occurrence.status_code == 201, occurrence.text
    lesson = post(
        teacher,
        "classbook/lessons",
        {
            "lesson_occurrence_id": occurrence.json()["id"],
            "group_id": data["group"]["id"],
            "subject_id": data["subject"]["id"],
            "actual_teacher_id": str(teacher.actor_id),
            "starts_at": "2026-09-01T08:00:00+02:00",
            "ends_at": "2026-09-01T08:45:00+02:00",
            "topic": "Rovnice",
        },
    )
    participants = api.get("/api/v1/classbook/classbook-participants").json()
    assert [p["student_id"] for p in participants] == [str(student.actor_id)]
    response = teacher.put(
        f"/api/v1/classbook/classbook-entries/{lesson['id']}/attendance",
        json={
            "student_id": str(student.actor_id),
            "status": "absent",
            "missed_minutes": 45,
        },
    )
    assert response.status_code == 200, response.text
    record = response.json()
    response = teacher.post(f"/api/v1/classbook/classbook-entries/{lesson['id']}/sign")
    assert response.status_code == 200, response.text
    request = post(
        student,
        "classbook/excuse-requests",
        {
            "student_id": str(student.actor_id),
            "reason": "Nemoc",
            "attendance_record_ids": [record["id"]],
        },
    )
    response = teacher.post(
        f"/api/v1/classbook/excuse-requests/{request['id']}/items/{record['id']}/decide",
        json={"decision": "approved"},
    )
    assert response.status_code == 200, response.text
    attendance = student.get("/api/v1/classbook/my-attendance").json()
    assert attendance[0]["is_excused"] is True
    assert (
        student.get("/api/v1/classbook/my-excuse-requests").json()[0]["status"]
        == "closed"
    )
    assert (
        api.delete("/api/v1/classbook/classbook-entries/" + lesson["id"]).status_code
        == 409
    )


def test_csrf_and_server_owned_fields(api):
    assert (
        api.post(
            "/api/v1/school/subjects",
            json={"code": "A", "name": "A", "created_by": str(uuid4())},
        ).status_code
        == 422
    )
    response = api.post(
        "/api/v1/school/subjects",
        headers={"Origin": "https://evil.example"},
        json={"code": "A", "name": "A"},
    )
    assert response.status_code == 403


@pytest.mark.postgres
def test_migration_is_repeatable_and_has_all_tables(engine):
    migrate(engine)
    migrate(engine)
    tables = set(inspect(engine).get_table_names())
    assert {
        "users",
        "teaching_cycle_steps",
        "classbook_participants",
        "lesson_changes",
    } <= tables
    with engine.connect() as connection:
        versions = connection.execute(
            text(
                "SELECT count(*) FROM schema_migrations "
                "WHERE version='20261102_05_school_er_model'"
            )
        ).scalar_one()
        assert versions == 1


@pytest.mark.postgres
def test_postgres_frozen_history_rejects_direct_sql(api, teacher, student, engine):
    from sqlalchemy.exc import IntegrityError

    data = setup_plan(api, teacher, student)
    publish(api, data)
    with pytest.raises(IntegrityError), engine.begin() as connection:
        connection.execute(
            text(
                "UPDATE teaching_cycle_steps SET duration_weeks=9 "
                "WHERE teaching_plan_id=:plan"
            ),
            {"plan": data["plan"]["id"]},
        )
