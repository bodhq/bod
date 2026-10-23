"""Ověření HTTP validace a shody pravidel s exportovaným OpenAPI."""

import json
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator, FormatChecker
from pydantic import ValidationError
from server.core.access.schemas import PasswordChange, UserCreate, UserPatch
from server.core.config import settings
from server.main import app
from server.modules.timetable.schemas import LessonCreate


def request_validator(schema_name):
    document = app.openapi()
    return Draft202012Validator(
        {
            "$ref": f"#/components/schemas/{schema_name}",
            "components": document["components"],
        },
        format_checker=FormatChecker(),
    )


def assert_invalid(response, location=None):
    assert response.status_code == 422, response.text
    error = response.json()["error"]
    assert error["code"] == "VALIDATION_ERROR"
    if location is not None:
        assert any(issue["location"] == location for issue in error["details"])


def test_profile_validation_and_nullable_fields(admin):
    validator = request_validator("ProfilePatch")
    for payload, field in [
        ({"email": "not-an-email"}, "email"),
        ({"email": ".broken@example.com"}, "email"),
        ({"email": "a" * 250 + "@example.com"}, "email"),
        ({"phone": "call me"}, "phone"),
        ({"phone": "+420 ext. 123"}, "phone"),
        ({"phone": "1" * 33}, "phone"),
        ({"first_name": "x" * 101}, "first_name"),
        ({"first_name": "Jan\x00Novák"}, "first_name"),
        ({"last_name": ["Novák"]}, "last_name"),
        ({"avatar_url": "https://outside.example/photo.png"}, "avatar_url"),
    ]:
        # JSON Schema format=email deklaruje e-mailovou syntaxi. Základní
        # FormatChecker knihovny jsonschema kontroluje jen část této syntaxe;
        # úplnou kontrolu na API provádí EmailStr/email-validator.
        if field != "email":
            assert not validator.is_valid(payload), payload
        assert_invalid(admin.patch("/api/v1/users/me", json=payload), ["body", field])
    assert not validator.is_valid({})
    assert_invalid(admin.patch("/api/v1/users/me", json={}))
    payload = {
        "first_name": "Žaneta-Marie",
        "last_name": "O’Connor",
        "email": "jan.novak@example.com",
        "phone": "+420 123 456 789",
    }
    assert validator.is_valid(payload)
    response = admin.patch("/api/v1/users/me", json=payload)
    assert response.status_code == 200
    response = admin.patch("/api/v1/users/me", json=dict.fromkeys(payload))
    assert response.status_code == 200
    assert all(response.json()[field] is None for field in payload)


def test_user_creation_rejects_invalid_role_items_and_duplicates(admin):
    validator = request_validator("UserCreate")
    for payload in [
        {"username": "_invalid"},
        {"username": "ab"},
        {"username": "a" * 65},
        {"role_codes": ["Teacher"]},
        {"role_codes": ["teacher", "teacher"]},
        {"role_codes": ["teacher", None]},
        {"role_codes": ["x" * 65]},
        {"role_codes": [f"role{i}" for i in range(21)]},
        {"role_codes": ["admin", "teacher"]},
        {"password": "client-cannot-set-this"},
    ]:
        assert not validator.is_valid(payload), payload
        assert_invalid(admin.post("/api/v1/admin/users", json=payload))
    # Neúplný účet zůstává povolený, jméno i heslo vydá server.
    assert validator.is_valid({})
    assert admin.post("/api/v1/admin/users", json={}).status_code == 201


def test_patch_optional_control_fields_match_contract(admin):
    user_id = admin.get("/api/v1/auth/me").json()["id"]
    validator = request_validator("UserPatch")
    for field in ["username", "is_active", "role_codes"]:
        payload = {field: None}
        assert not validator.is_valid(payload)
        assert_invalid(admin.patch(f"/api/v1/admin/users/{user_id}", json=payload))
        with pytest.raises(ValidationError):
            UserPatch.model_validate(payload)
    for value in [0, 1, "true", "false", [], {}]:
        payload = {"is_active": value}
        assert not validator.is_valid(payload)
        assert_invalid(admin.patch(f"/api/v1/admin/users/{user_id}", json=payload))
    assert validator.is_valid({"first_name": None})
    assert UserPatch(first_name=None).model_dump(exclude_unset=True) == {
        "first_name": None
    }


def test_role_validation_is_shared_by_body_and_path(admin):
    validator = request_validator("RoleCreate")
    for payload in [
        {"name": "Valid", "code": "UPPERCASE"},
        {"name": "Valid", "code": "x" * 65},
        {"name": "   ", "code": "valid"},
        {"name": "x" * 101, "code": "valid"},
        {"name": "Valid", "code": "valid", "description": "x" * 4001},
        {"name": "Valid", "code": "valid", "description": "bad\x00text"},
        {"name": "Valid", "code": "valid", "permission_codes": ["bad permission"]},
        {"name": "Valid", "code": "valid", "permission_codes": ["a" * 101]},
        {
            "name": "Valid",
            "code": "valid",
            "permission_codes": ["profile.self.read"] * 2,
        },
    ]:
        assert not validator.is_valid(payload), payload
        assert_invalid(admin.post("/api/v1/admin/roles", json=payload))
    assert_invalid(
        admin.put("/api/v1/admin/roles/UPPER", json={"name": "Role"}), ["path", "code"]
    )
    assert_invalid(admin.delete("/api/v1/admin/roles/x"), ["path", "code"])
    response = admin.post(
        "/api/v1/admin/roles", json={"code": "valid", "name": "  Moje role  "}
    )
    assert response.status_code == 201
    assert response.json()["name"] == "Moje role"


def test_login_validation_rejects_extra_fields_and_keeps_passwords_private(client):
    secret = "SensitivePassword2026!"
    response = client.post(
        "/api/v1/auth/login",
        json={"username": "root", "password": secret, "role": "admin"},
    )
    assert_invalid(response, ["body", "role"])
    for payload in [
        {"username": "_bad", "password": secret},
        {"username": "root", "password": 12345678},
        {"username": "root", "password": secret * 100},
        {"username": "root", "password": ""},
    ]:
        assert not request_validator("LoginRequest").is_valid(payload)
        response = client.post("/api/v1/auth/login", json=payload)
        assert_invalid(response)
        assert secret not in response.text
        for issue in response.json()["error"]["details"]:
            assert set(issue) == {"location", "message", "type"}
    # Normalizace uživatelského jména se sdílí mezi založením a přihlášením.
    assert UserCreate(username="  Test.User  ").username == "test.user"


def test_password_limits_and_no_whitespace_normalization(admin):
    validator = request_validator("PasswordChange")
    for new in ["short", " " * 12, "x" * 129]:
        payload = {"current_password": "NoveHesloProAdmina2026!", "new_password": new}
        assert not validator.is_valid(payload)
        assert_invalid(
            admin.post("/api/v1/auth/change-password", json=payload),
            ["body", "new_password"],
        )
    password = "  PresneMojeHeslo2026!  "
    parsed = PasswordChange(current_password=" original ", new_password=password)
    assert parsed.current_password == " original "
    assert parsed.new_password == password
    response = admin.post(
        "/api/v1/auth/change-password",
        json={"current_password": "NoveHesloProAdmina2026!", "new_password": password},
    )
    assert response.status_code == 200
    assert (
        admin.post(
            "/api/v1/auth/login", json={"username": "root", "password": password}
        ).status_code
        == 200
    )


def test_query_parameters_and_all_identifier_routes(admin):
    for path in ["/api/v1/admin/users", "/api/v1/admin/audit"]:
        for query in [
            "offset=-1",
            "offset=2147483648",
            "limit=0",
            "limit=101",
            "limit=text",
            "unexpected=1",
        ]:
            assert_invalid(admin.get(path + "?" + query))
        assert admin.get(path + "?offset=0&limit=1").status_code == 200
    for method, path, payload in [
        ("get", "/api/v1/admin/users/not-uuid", None),
        ("patch", "/api/v1/admin/users/not-uuid", {"first_name": "Jan"}),
        ("delete", "/api/v1/admin/users/not-uuid", None),
        ("post", "/api/v1/admin/users/not-uuid/reset-password", None),
        ("delete", "/api/v1/auth/sessions/not-uuid", None),
        ("get", "/api/v1/users/not-uuid/avatar", None),
        ("put", "/api/v1/auth/active-role", {"role_code": "Bad role"}),
    ]:
        kwargs = {"json": payload} if payload is not None else {}
        assert_invalid(admin.request(method, path, **kwargs))
    role = admin.post("/api/v1/admin/users", json={"role_codes": ["student"]}).json()
    # Vlastní učitel/žák má právo rozvrh číst; admin toto právo nemá.
    admin.post(
        "/api/v1/auth/login",
        json={
            "username": role["user"]["username"],
            "password": role["temporary_password"],
        },
    )
    admin.post(
        "/api/v1/auth/change-password",
        json={
            "current_password": role["temporary_password"],
            "new_password": "StudentovoNoveHeslo2026!",
        },
    )
    for class_id in ["0", "-1", "2147483648", "not-int"]:
        assert_invalid(admin.get(f"/api/v1/timetable/{class_id}"), ["path", "class_id"])


def test_batch_limits_headers_cookie_and_avatar_filename(admin):
    for payload in [
        {"users": []},
        {"users": [{}] * 101},
        {"users": [{"role_codes": ["bad role"]}]},
    ]:
        assert not request_validator("BatchCreate").is_valid(payload)
        assert_invalid(admin.post("/api/v1/admin/users/generate", json=payload))
    me = admin.get("/api/v1/auth/me").json()
    assert_invalid(
        admin.get(f"/api/v1/users/{me['id']}/avatar/invalid.png"), ["path", "filename"]
    )
    assert_invalid(
        admin.get("/api/v1/auth/me", headers={"Origin": "x" * 2049}),
        ["header", "origin"],
    )
    assert_invalid(
        admin.post(
            "/api/v1/auth/login",
            headers={"User-Agent": "x" * 513},
            json={"username": "root", "password": "anything"},
        ),
        ["header", "user-agent"],
    )
    admin.cookies.set(settings.session_cookie_name, "bad.token")
    assert_invalid(
        admin.get("/api/v1/auth/me"), ["cookie", settings.session_cookie_name]
    )


def test_lesson_dto_rejects_invalid_times_ids_and_types():
    valid = {
        "class_id": 1,
        "teacher_id": 2,
        "subject": "Angličtina",
        "room": "A1",
        "day": 1,
        "start_time": "08:00",
        "end_time": "08:45",
    }
    assert LessonCreate(**valid).day == 1
    for changes in [
        {"class_id": 0},
        {"teacher_id": True},
        {"class_id": "1"},
        {"day": 0},
        {"day": 8},
        {"day": False},
        {"subject": " "},
        {"room": "A\n1"},
        {"start_time": "24:00"},
        {"start_time": "8:00"},
        {"end_time": "08:00"},
        {"end_time": "07:45"},
    ]:
        with pytest.raises(ValidationError):
            LessonCreate.model_validate({**valid, **changes})


def test_exported_contract_matches_live_api_and_documents_upload_limits():
    live = app.openapi()
    exported = json.loads((Path(__file__).parents[2] / "docs/openapi.json").read_text())
    assert exported == live, "Obnov docs/openapi.json pomocí python -m server.openapi."
    for schema in live["components"]["schemas"].values():
        Draft202012Validator.check_schema(schema)
    schema = live["paths"]["/api/v1/users/me/avatar"]["put"]["requestBody"]
    for media_type in ["image/png", "image/jpeg", "image/webp"]:
        binary = schema["content"][media_type]["schema"]
        assert binary["format"] == "binary"
        assert binary["x-maxSizeBytes"] == 5 * 1024 * 1024
        assert binary["x-maxPixels"] == 16_000_000
    params = live["paths"]["/api/v1/admin/users"]["get"]["parameters"]
    assert {p["name"] for p in params} >= {
        "offset",
        "limit",
        "origin",
        "X-Requested-With",
        settings.session_cookie_name,
    }
