"""Optional school catalogs and persisted building layouts through the public API."""

import pytest
from sqlalchemy import text

from server.core.domain.school_layout_migration import migrate_school_layout
from server.core.migrations import migrate

from .test_er_workflows import post, publish, setup_plan


def classroom(api, code="A101", **layout):
    if not api.get("/api/v1/rooms/room-types").json():
        post(api, "rooms/room-types", {"code": "classroom", "name": "Učebna"})
    return post(
        api,
        "rooms",
        {"code": code, "room_type_code": "classroom", "capacity": 30, **layout},
    )


def building_floor(api, number=0):
    building = post(api, "rooms/buildings", {"code": "A", "name": "Hlavní budova"})
    floor = post(
        api,
        "rooms/building-floors",
        {"building_id": building["id"], "number": number, "width": 200, "height": 100},
    )
    return building, floor


def enrollment(api, student):
    year = post(
        api,
        "school/school-years",
        {"name": "2026/2027", "starts_on": "2026-09-01", "ends_on": "2027-07-01"},
    )
    cls = post(api, "school/classes", {"school_year_id": year["id"], "name": "1.A"})
    payload = {
        "student_id": str(student.actor_id),
        "class_id": cls["id"],
        "valid_from": "2026-09-01",
    }
    return year, cls, payload


@pytest.mark.parametrize("catalogs", ["none", "field", "specialization", "both"])
def test_enrollment_allows_independent_optional_catalogs(api, student, catalogs):
    _, _, payload = enrollment(api, student)
    if catalogs in {"field", "both"}:
        field = post(api, "school/study-fields", {"code": "IT", "name": "Informatika"})
        payload["study_field_id"] = field["id"]
    if catalogs in {"specialization", "both"}:
        specialization = post(
            api,
            "school/specializations",
            {
                "code": "WEB",
                "name": "Webové aplikace",
                "study_field_id": payload.get("study_field_id"),
            },
        )
        payload["specialization_id"] = specialization["id"]
    result = post(api, "school/class-enrollments", payload)
    assert result["study_field_id"] == payload.get("study_field_id")
    assert result["specialization_id"] == payload.get("specialization_id")
    path = "/api/v1/school/class-enrollments/" + result["id"]
    response = api.patch(path, json={"study_field_id": None, "specialization_id": None})
    assert response.status_code == 200, response.text
    assert response.json()["study_field_id"] is None
    assert response.json()["specialization_id"] is None


def test_enrollment_and_catalog_edits_cannot_mismatch_field_and_specialization(
    api, student
):
    _, _, payload = enrollment(api, student)
    fields = [
        post(api, "school/study-fields", {"code": code, "name": code})
        for code in ("IT", "ELE")
    ]
    specialization = post(
        api,
        "school/specializations",
        {"code": "WEB", "name": "Web", "study_field_id": fields[0]["id"]},
    )
    payload["specialization_id"] = specialization["id"]
    for field_id in (None, fields[1]["id"]):
        response = api.post(
            "/api/v1/school/class-enrollments",
            json=payload | {"study_field_id": field_id},
        )
        assert response.status_code == 422, response.text
    payload["study_field_id"] = fields[0]["id"]
    post(api, "school/class-enrollments", payload)
    path = "/api/v1/school/specializations/" + specialization["id"]
    assert api.patch(path, json={"study_field_id": fields[1]["id"]}).status_code == 422
    assert api.get(path).json()["study_field_id"] == fields[0]["id"]
    assert (
        api.delete("/api/v1/school/study-fields/" + fields[0]["id"]).status_code == 409
    )


@pytest.mark.parametrize(
    "key,catalog",
    [("study_field_id", "study-fields"), ("specialization_id", "specializations")],
)
def test_new_enrollments_reject_inactive_catalog_entries(api, student, key, catalog):
    _, _, payload = enrollment(api, student)
    entry = post(
        api, "school/" + catalog, {"code": "OLD", "name": "Old", "is_active": False}
    )
    response = api.post(
        "/api/v1/school/class-enrollments", json=payload | {key: entry["id"]}
    )
    assert response.status_code == 422, response.text
    assert api.get("/api/v1/school/class-enrollments").json() == []


@pytest.mark.parametrize(
    "method,catalog,rules,key",
    [
        ("study_field", "study-fields", "group-study-field-rules", "study_field_id"),
        (
            "specialization",
            "specializations",
            "group-specialization-rules",
            "specialization_id",
        ),
    ],
)
def test_catalog_group_generation_uses_the_selected_catalog(
    api, student, method, catalog, rules, key
):
    year, cls, payload = enrollment(api, student)
    entry = post(api, "school/" + catalog, {"code": "IT", "name": "IT"})
    post(api, "school/class-enrollments", payload | {key: entry["id"]})
    division = post(
        api,
        "school/group-divisions",
        {
            "class_id": cls["id"],
            "name": "Dělení",
            "method": method,
            "effective_from": "2026-09-01",
        },
    )
    groups = [
        post(
            api,
            "school/teaching-groups",
            {
                "school_year_id": year["id"],
                "name": f"Skupina {index}",
                "membership_mode": "explicit",
                "division_id": division["id"],
                "position": index,
            },
        )
        for index in (1, 2)
    ]
    post(api, "school/" + rules, {"group_id": groups[0]["id"], key: entry["id"]})
    duplicate = api.post(
        "/api/v1/school/" + rules, json={"group_id": groups[1]["id"], key: entry["id"]}
    )
    assert duplicate.status_code == 409, duplicate.text
    response = api.post(
        f"/api/v1/school/group-divisions/{division['id']}/generate",
        json={"effective_from": "2026-09-01"},
    )
    assert response.status_code == 200, response.text
    assert [(row["student_id"], row["group_id"]) for row in response.json()] == [
        (str(student.actor_id), groups[0]["id"])
    ]


def test_building_layout_persists_floors_rooms_and_updates(api):
    building, floor = building_floor(api)
    basement = post(
        api, "rooms/building-floors", {"building_id": building["id"], "number": -1}
    )
    room = classroom(api, floor_id=floor["id"], x=10, y=20, width=50, height=30)
    path = "/api/v1/rooms/" + room["id"]
    assert api.patch(path, json={"x": 80}).status_code == 200
    response = api.get(f"/api/v1/rooms/buildings/{building['id']}/layout")
    assert response.status_code == 200, response.text
    result = response.json()
    assert [row["id"] for row in result["floors"]] == [basement["id"], floor["id"]]
    assert result["floors"][0]["rooms"] == []
    assert result["floors"][1]["rooms"][0]["x"] == 80
    assert api.delete("/api/v1/rooms/building-floors/" + floor["id"]).status_code == 409
    assert api.delete("/api/v1/rooms/buildings/" + building["id"]).status_code == 409
    assert (
        api.patch(
            path, json=dict.fromkeys(("floor_id", "x", "y", "width", "height"))
        ).status_code
        == 200
    )
    assert api.delete("/api/v1/rooms/building-floors/" + floor["id"]).status_code == 204


def test_layout_validation_rolls_back_room_and_floor_edits(api):
    _, floor = building_floor(api)
    room = classroom(api, floor_id=floor["id"], x=10, y=20, width=50, height=30)
    path = "/api/v1/rooms/" + room["id"]
    for payload in (
        {"x": -1},
        {"y": True},
        {"x": 1.5},
        {"x": 2147483648},
        {"width": 0},
        {"x": 180},
        {"floor_id": None},
        {"y": None},
    ):
        response = api.patch(path, json=payload)
        assert response.status_code == 422, response.text
    response = api.patch(
        "/api/v1/rooms/building-floors/" + floor["id"], json={"width": 20}
    )
    assert response.status_code == 422, response.text
    assert api.get(path).json()["x"] == 10
    assert (
        api.get("/api/v1/rooms/building-floors/" + floor["id"]).json()["width"] == 200
    )
    assert (
        api.post(
            "/api/v1/rooms/building-floors",
            json={"building_id": floor["building_id"], "number": 0},
        ).status_code
        == 409
    )
    assert classroom(api, code="B101")["floor_id"] is None


def test_room_creation_rejects_incomplete_layout_and_accepts_floor_without_coordinates(
    api,
):
    _, floor = building_floor(api)
    classroom(api)
    path = "/api/v1/rooms"
    base = {"code": "NEW", "room_type_code": "classroom", "capacity": 30}
    for layout in (
        {"x": 0, "y": 0, "width": 20, "height": 20},
        {"floor_id": floor["id"], "x": 0},
        {"floor_id": floor["id"], "x": 0, "y": 0, "width": 20},
        {"floor_id": floor["id"], "x": 190, "y": 0, "width": 20, "height": 20},
    ):
        response = api.post(path, json=base | layout)
        assert response.status_code == 422, response.text
    room = post(api, "rooms", base | {"floor_id": floor["id"]})
    assert all(room[key] is None for key in ("x", "y", "width", "height"))


def test_moving_room_to_smaller_floor_preserves_its_previous_location(api):
    building, floor = building_floor(api)
    smaller = post(
        api,
        "rooms/building-floors",
        {"building_id": building["id"], "number": 1, "width": 30, "height": 30},
    )
    room = classroom(api, floor_id=floor["id"], x=10, y=20, width=50, height=30)
    path = "/api/v1/rooms/" + room["id"]
    response = api.patch(path, json={"floor_id": smaller["id"]})
    assert response.status_code == 422, response.text
    assert api.get(path).json() == room
    response = api.patch(
        path,
        json={"floor_id": smaller["id"], "x": 10, "y": 10, "width": 20, "height": 20},
    )
    assert response.status_code == 200, response.text
    layout = api.get(f"/api/v1/rooms/buildings/{building['id']}/layout").json()
    assert layout["floors"][0]["rooms"] == []
    assert layout["floors"][1]["rooms"][0]["id"] == room["id"]


def test_catalog_deactivation_preserves_existing_enrollment(api, student):
    _, _, payload = enrollment(api, student)
    field = post(api, "school/study-fields", {"code": "IT", "name": "Informatika"})
    specialization = post(
        api,
        "school/specializations",
        {"code": "WEB", "name": "Web", "study_field_id": field["id"]},
    )
    row = post(
        api,
        "school/class-enrollments",
        payload
        | {"study_field_id": field["id"], "specialization_id": specialization["id"]},
    )
    for catalog, item in (("study-fields", field), ("specializations", specialization)):
        response = api.patch(
            f"/api/v1/school/{catalog}/{item['id']}", json={"is_active": False}
        )
        assert response.status_code == 200, response.text
    path = "/api/v1/school/class-enrollments/" + row["id"]
    assert api.get(path).json() == row
    response = api.patch(path, json={"valid_to": "2027-06-30"})
    assert response.status_code == 200, response.text
    assert response.json()["study_field_id"] == field["id"]
    assert response.json()["specialization_id"] == specialization["id"]


def test_new_resources_require_the_existing_module_permissions(api, teacher):
    building, _ = building_floor(api)
    for path in (
        "school/study-fields",
        "school/group-study-field-rules",
        "rooms/buildings",
        "rooms/building-floors",
        f"rooms/buildings/{building['id']}/layout",
    ):
        assert teacher.get("/api/v1/" + path).status_code == 403
    assert (
        teacher.post(
            "/api/v1/rooms/buildings", json={"code": "B", "name": "B"}
        ).status_code
        == 403
    )


def test_timetable_can_be_published_without_legacy_distance_model(
    api, teacher, student
):
    data = setup_plan(api, teacher, student)
    draft = post(
        api,
        "timetable/timetable-versions",
        {
            "teaching_plan_id": data["plan"]["id"],
            "time_grid_id": data["grid"]["id"],
            "name": "Bez modelu vzdáleností",
        },
    )
    assert draft["distance_model_id"] is None
    assert draft["valid_from"] is None
    assert draft["valid_to"] is None
    draft_path = "/api/v1/timetable/timetable-versions/" + draft["id"]
    assert api.post(draft_path + "/publish").status_code == 422
    assert api.patch(draft_path, json={"valid_to": "2027-07-01"}).status_code == 422
    response = api.patch(draft_path, json={"valid_from": "2026-09-01"})
    assert response.status_code == 200, response.text
    assert response.json()["valid_to"] == "2027-07-01"
    assert api.delete(draft_path).status_code == 204
    path = "/api/v1/timetable/timetable-versions/" + data["version"]["id"]
    response = api.patch(path, json={"distance_model_id": None})
    assert response.status_code == 200, response.text
    assert publish(api, data)["distance_model_id"] is None
    response = api.post(
        path + "/clone", json={"name": "Kopie", "plan_name": "Kopie plánu"}
    )
    assert response.status_code == 201, response.text
    assert response.json()["distance_model_id"] is None


@pytest.mark.postgres
def test_upgrade_preserves_existing_school_and_room_data(api, engine):
    specialization = post(api, "school/specializations", {"code": "WEB", "name": "Web"})
    room = classroom(api)
    # Simulate the pre-upgrade schema inside the fixture's isolated test schema.
    with engine.begin() as connection:
        for statement in (
            "DROP TABLE group_study_field_rules",
            "ALTER TABLE specializations DROP COLUMN study_field_id",
            "ALTER TABLE class_enrollments DROP COLUMN study_field_id",
            "DROP TABLE study_fields",
            "ALTER TABLE rooms DROP COLUMN floor_id, DROP COLUMN x, DROP COLUMN y, DROP COLUMN width, DROP COLUMN height",
            "DROP TABLE building_floors",
            "DROP TABLE buildings",
            "ALTER TABLE timetable_versions ALTER COLUMN distance_model_id SET NOT NULL",
            "DELETE FROM schema_migrations WHERE version='20261120_10_school_layout'",
        ):
            connection.execute(text(statement))
    migrate(engine)
    migrate(engine)
    with engine.begin() as connection:
        migrate_school_layout(connection)
    assert (
        api.get("/api/v1/school/specializations/" + specialization["id"]).json()
        == specialization
    )
    assert api.get("/api/v1/rooms/" + room["id"]).json() == room
    assert api.get("/api/v1/school/study-fields").json() == []
    building_floor(api)
