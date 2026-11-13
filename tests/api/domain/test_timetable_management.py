from uuid import uuid4

from sqlmodel import Session, select
from tests.api.domain.test_er_workflows import post, publish, setup_plan

from server.core.audit.models import AuditEvent

BASE = "/api/v1/timetable"


def test_overview_workloads_and_publication_check(api, teacher, student, engine):
    data = setup_plan(api, teacher, student)
    url = f"{BASE}/timetable-versions/{data['version']['id']}"
    with Session(engine) as db:
        audit_count = len(db.exec(select(AuditEvent)).all())
    check = api.get(url + "/publication-check")
    assert check.status_code == 200, check.text
    assert check.json() == {"can_publish": True, "issues": []}
    response = api.get(url + "/overview")
    assert response.status_code == 200, response.text
    view = response.json()
    assert view["editable"] and view["plan_editable"]
    assert view["assignments"][0]["subject_name"] == "Matematika"
    assert view["assignments"][0]["group_name"] == "1.A"
    assert view["assignments"][0]["teacher_name"]
    assert "hashed_password" not in response.text
    assert [w["remaining_periods"] for w in view["workloads"]] == [0, 0]
    assert len(view["entries"]) == 2
    with Session(engine) as db:
        assert len(db.exec(select(AuditEvent)).all()) == audit_count
    assert (
        api.get(f"{BASE}/teaching-plans/{data['plan']['id']}").json()["frozen_at"]
        is None
    )
    entry = data["entries"][0]
    assert api.delete(f"{BASE}/timetable-entries/{entry['id']}").status_code == 204
    view = api.get(url + "/overview").json()
    assert [w["remaining_periods"] for w in view["workloads"]] == [1, 0]
    check = api.get(url + "/publication-check").json()
    assert not check["can_publish"]
    assert "úvazkům" in check["issues"][0]["message"]
    payload = {
        k: entry[k]
        for k in (
            "timetable_version_id",
            "teaching_assignment_id",
            "cycle_week_id",
            "day_of_week",
            "time_slot_id",
            "room_id",
            "is_locked",
        )
    }
    post(api, "timetable/timetable-entries", payload)
    publish(api, data)
    view = api.get(url + "/overview").json()
    assert not view["editable"] and not view["plan_editable"]
    assert not api.get(url + "/publication-check").json()["can_publish"]


def test_filters_apply_before_pagination(api, teacher, student):
    data = setup_plan(api, teacher, student)
    version_id = data["version"]["id"]
    extra = post(
        api,
        "timetable/timetable-versions",
        {
            **{
                k: data["version"][k]
                for k in (
                    "teaching_plan_id",
                    "time_grid_id",
                    "distance_model_id",
                    "valid_from",
                )
            },
            "name": "Druhá varianta",
        },
    )
    assert (
        api.get(
            f"{BASE}/timetable-entries",
            params={
                "timetable_version_id": extra["id"],
                "limit": 1,
            },
        ).json()
        == []
    )
    entries = api.get(
        f"{BASE}/timetable-entries",
        params={
            "timetable_version_id": version_id,
            "cycle_week_id": data["weeks"][0]["id"],
            "limit": 1,
        },
    ).json()
    assert len(entries) == 1
    assert entries[0]["cycle_week_id"] == data["weeks"][0]["id"]
    assert (
        api.get(
            f"{BASE}/teaching-plans", params={"school_year_id": str(uuid4())}
        ).json()
        == []
    )
    assert (
        api.get(f"{BASE}/timetable-versions", params={"status": "published"}).json()
        == []
    )
    assert (
        api.get(f"{BASE}/timetable-versions", params={"status": "invalid"}).status_code
        == 422
    )
    assert (
        api.get(f"{BASE}/time-slots", params={"time_grid_id": str(uuid4())}).json()
        == []
    )


def test_management_requires_editor_and_unknown_version_is_404(api, teacher, student):
    data = setup_plan(api, teacher, student)
    for suffix in ("overview", "publication-check"):
        path = f"{BASE}/timetable-versions/{data['version']['id']}/{suffix}"
        assert student.get(path).status_code == 403
        assert teacher.get(path).status_code == 403
        assert (
            api.get(f"{BASE}/timetable-versions/{uuid4()}/{suffix}").status_code == 404
        )
    assert (
        student.get(
            f"{BASE}/timetable-entries",
            params={
                "timetable_version_id": data["version"]["id"],
            },
        ).status_code
        == 403
    )


def test_check_reports_unavailability_and_overview_reports_excess(
    api, teacher, student
):
    data = setup_plan(api, teacher, student)
    url = f"{BASE}/timetable-versions/{data['version']['id']}"
    absence = post(
        api,
        "timetable/teacher-unavailability",
        {
            "teacher_id": str(teacher.actor_id),
            "starts_at": "2026-09-01T05:00:00Z",
            "ends_at": "2026-09-01T08:00:00Z",
        },
    )
    check = api.get(url + "/publication-check")
    assert check.status_code == 200
    assert check.json()["issues"][0]["code"] == "RESOURCE_CONFLICT"
    assert "nedostupný" in check.json()["issues"][0]["message"]
    assert (
        api.get(f"{BASE}/timetable-versions/{data['version']['id']}").json()["status"]
        == "draft"
    )
    assert (
        api.delete(f"{BASE}/teacher-unavailability/{absence['id']}").status_code == 204
    )
    entry = data["entries"][0]
    post(
        api,
        "timetable/timetable-entries",
        {
            **{
                k: entry[k]
                for k in (
                    "timetable_version_id",
                    "teaching_assignment_id",
                    "cycle_week_id",
                    "time_slot_id",
                )
            },
            "day_of_week": 3,
        },
    )
    workloads = api.get(url + "/overview").json()["workloads"]
    assert [w["remaining_periods"] for w in workloads] == [-1, 0]
    assert not api.get(url + "/publication-check").json()["can_publish"]
