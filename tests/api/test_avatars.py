from io import BytesIO
from pathlib import Path
from uuid import UUID, uuid4

import pytest
from conftest import HEADERS
from fastapi.testclient import TestClient
from PIL import Image
from server.core.access.repository import AccessError, AccessRepository
from server.core.access.services import AccessService
from server.core.audit.models import AuditEvent
from server.core.config import settings
from server.core.exceptions import AppException
from server.core.migrations import migrate
from server.core.users.avatar_service import AvatarService
from server.core.users.avatar_storage import (
    MAX_AVATAR_BYTES,
    AvatarStorageUnavailable,
    AvatarTooLarge,
    LocalAvatarStorage,
    normalize_avatar,
)
from server.core.users.models import User
from server.main import app
from sqlalchemy import inspect, text
from sqlmodel import Session, select
from test_access import complete_password, issue, sign_in


def picture(format="PNG", size=(1000, 600)):
    stream = BytesIO()
    with Image.new("RGB", size, "orange") as image:
        image.save(stream, format=format)
    return stream.getvalue()


def photo_files():
    return list((settings.media_root / "avatars").glob("*.webp"))


@pytest.mark.parametrize(
    "format,content_type",
    [
        ("PNG", "image/png"),
        ("JPEG", "image/jpeg"),
        ("JPEG", "image/jpg"),
        ("WEBP", "image/webp"),
    ],
)
def test_upload_normalizes_image_and_stores_only_url(
    admin, db_engine, format, content_type
):
    me = admin.get("/api/v1/auth/me").json()
    response = admin.put(
        "/api/v1/users/me/avatar",
        content=picture(format),
        headers={"Content-Type": content_type},
    )
    assert response.status_code == 200, response.text
    assert "avatar_key" not in response.json()
    avatar_url = response.json()["avatar_url"]
    assert avatar_url.startswith(f"/api/v1/users/{me['id']}/avatar/")
    assert response.headers["cache-control"] == "no-store"
    with Session(db_engine) as db:
        user = db.get(User, UUID(me["id"]))
        assert user.avatar_url == avatar_url
        key = LocalAvatarStorage.key_from_url(user.id, user.avatar_url)
        assert len(key) == 37 and key.endswith(".webp")
        assert not Path(key).is_absolute()
    assert "avatar_key" not in {
        column["name"] for column in inspect(db_engine).get_columns("users")
    }
    assert photo_files() == [settings.media_root / "avatars" / key]
    response = admin.get(response.json()["avatar_url"])
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/webp"
    assert response.headers["cache-control"] == "no-store"
    assert response.headers["x-content-type-options"] == "nosniff"
    with Image.open(BytesIO(response.content)) as image:
        assert image.size == (512, 307)
        assert image.format == "WEBP"
    assert admin.get("/api/v1/auth/me").json()["avatar_url"] is not None


def test_avatar_rotation_and_metadata_removal():
    stream = BytesIO()
    image = Image.new("RGB", (90, 50), "blue")
    exif = Image.Exif()
    exif[0x0112] = 6
    exif[0x010E] = "private-location-information"
    image.save(stream, format="JPEG", exif=exif)
    normalized = normalize_avatar(stream.getvalue())
    assert b"private-location-information" not in normalized
    with Image.open(BytesIO(normalized)) as result:
        assert result.size == (50, 90)
        assert not result.getexif()
        assert "exif" not in result.info


def test_replace_and_delete_remove_old_file(admin):
    first = admin.put(
        "/api/v1/users/me/avatar",
        content=picture(),
        headers={"Content-Type": "image/png"},
    )
    old_file = photo_files()[0]
    second = admin.put(
        "/api/v1/users/me/avatar",
        content=picture(size=(32, 32)),
        headers={"Content-Type": "image/png"},
    )
    assert second.status_code == 200
    assert not old_file.exists()
    assert len(photo_files()) == 1
    assert second.json()["avatar_url"] != first.json()["avatar_url"]
    assert admin.get(first.json()["avatar_url"]).status_code == 404
    assert admin.get(second.json()["avatar_url"]).status_code == 200
    assert admin.delete("/api/v1/users/me/avatar").status_code == 204
    assert photo_files() == []
    assert admin.get(first.json()["avatar_url"]).status_code == 404
    assert admin.get("/api/v1/auth/me").json()["avatar_url"] is None
    assert admin.delete("/api/v1/users/me/avatar").status_code == 204


@pytest.mark.parametrize(
    "body,content_type,status",
    [
        (b"not an image", "image/png", 422),
        (b"<svg xmlns='http://www.w3.org/2000/svg'/>", "image/svg+xml", 415),
        (b"text", "text/plain", 415),
        (b"", "image/png", 422),
    ],
)
def test_rejected_upload_leaves_current_picture_unchanged(
    admin, body, content_type, status
):
    response = admin.put(
        "/api/v1/users/me/avatar",
        content=picture(),
        headers={"Content-Type": "image/png"},
    )
    previous = photo_files()
    assert (
        admin.put(
            "/api/v1/users/me/avatar",
            content=body,
            headers={"Content-Type": content_type},
        ).status_code
        == status
    )
    assert photo_files() == previous
    assert admin.get(response.json()["avatar_url"]).status_code == 200


def test_size_limit_is_enforced_while_reading_body(admin):
    def chunks():
        for _ in range(6):
            yield b"x" * (1024 * 1024)

    response = admin.put(
        "/api/v1/users/me/avatar",
        content=chunks(),
        headers={"Content-Type": "image/png"},
    )
    assert response.status_code == 413
    assert photo_files() == []
    with pytest.raises(AvatarTooLarge):
        normalize_avatar(b"x" * (MAX_AVATAR_BYTES + 1))


def test_pixel_limit_and_animated_image_are_rejected():
    with pytest.raises(AppException) as error:
        normalize_avatar(picture(size=(4001, 4000)))
    assert error.value.status_code == 422
    stream = BytesIO()
    first = Image.new("RGB", (16, 16), "red")
    second = Image.new("RGB", (16, 16), "blue")
    first.save(
        stream, format="PNG", save_all=True, append_images=[second], duration=100
    )
    with pytest.raises(AppException) as error:
        normalize_avatar(stream.getvalue())
    assert error.value.status_code == 422


def test_only_owner_or_users_manager_can_access_avatar(admin):
    student = issue(admin, username="student.one")
    other = issue(admin, username="student.two")
    url = f"/api/v1/users/{other['user']['id']}/avatar"
    assert (
        admin.put(
            url, content=picture(), headers={"Content-Type": "image/png"}
        ).status_code
        == 200
    )
    with TestClient(app, headers=HEADERS) as client:
        sign_in(client, student)
        complete_password(client, student)
        assert client.get(url).status_code == 403
        assert (
            client.put(
                url, content=picture(), headers={"Content-Type": "image/png"}
            ).status_code
            == 403
        )
        assert client.delete(url).status_code == 403
        assert (
            client.put(
                "/api/v1/users/me/avatar",
                content=picture(),
                headers={"Content-Type": "image/png"},
            ).status_code
            == 200
        )
    with TestClient(app, headers=HEADERS) as anonymous:
        assert anonymous.get(url).status_code == 401
        assert (
            anonymous.put(
                "/api/v1/users/me/avatar",
                content=picture(),
                headers={"Content-Type": "image/png"},
            ).status_code
            == 401
        )


def test_avatar_requires_password_change_and_active_permission(admin):
    student = issue(admin)
    with TestClient(app, headers=HEADERS) as client:
        sign_in(client, student)
        assert (
            client.put(
                "/api/v1/users/me/avatar",
                content=picture(),
                headers={"Content-Type": "image/png"},
            ).status_code
            == 403
        )
        complete_password(client, student)
        assert (
            client.put(
                "/api/v1/users/me/avatar",
                content=picture(),
                headers={"Content-Type": "image/png"},
            ).status_code
            == 200
        )
        assert (
            admin.put(
                "/api/v1/admin/roles/student",
                json={
                    "name": "Žák",
                    "permission_codes": ["profile.self.read"],
                },
            ).status_code
            == 200
        )
        assert client.delete("/api/v1/users/me/avatar").status_code == 403
        assert (
            client.put(
                "/api/v1/users/me/avatar",
                content=picture(),
                headers={"Content-Type": "image/png"},
            ).status_code
            == 403
        )


def test_avatar_key_and_url_cannot_be_set_via_profile_json(admin):
    for field in ("avatar_key", "avatar_url"):
        assert (
            admin.patch("/api/v1/users/me", json={field: "../../private"}).status_code
            == 422
        )
        assert (
            admin.post("/api/v1/admin/users", json={field: "../../private"}).status_code
            == 422
        )


def test_storage_failure_preserves_database_and_previous_file(admin, monkeypatch):
    response = admin.put(
        "/api/v1/users/me/avatar",
        content=picture(),
        headers={"Content-Type": "image/png"},
    )
    previous = photo_files()

    def fail_write(self, image):
        raise AvatarStorageUnavailable()

    monkeypatch.setattr(LocalAvatarStorage, "write", fail_write)
    assert (
        admin.put(
            "/api/v1/users/me/avatar",
            content=picture(),
            headers={"Content-Type": "image/png"},
        ).status_code
        == 503
    )
    assert photo_files() == previous
    assert admin.get(response.json()["avatar_url"]).status_code == 200


def test_database_conflict_removes_uncommitted_new_file(admin, monkeypatch):
    response = admin.put(
        "/api/v1/users/me/avatar",
        content=picture(),
        headers={"Content-Type": "image/png"},
    )
    previous = photo_files()

    def conflict(self):
        self.db.rollback()
        raise AccessError("conflict", "Simulovaný konflikt při uložení")

    monkeypatch.setattr(AccessRepository, "commit", conflict)
    assert (
        admin.put(
            "/api/v1/users/me/avatar",
            content=picture(),
            headers={"Content-Type": "image/png"},
        ).status_code
        == 409
    )
    assert photo_files() == previous
    assert admin.get(response.json()["avatar_url"]).status_code == 200


def test_hard_delete_account_removes_photo_after_commit(admin):
    student = issue(admin)
    url = f"/api/v1/users/{student['user']['id']}/avatar"
    assert (
        admin.put(
            url, content=picture(), headers={"Content-Type": "image/png"}
        ).status_code
        == 200
    )
    assert (
        admin.delete(f"/api/v1/admin/users/{student['user']['id']}").status_code == 204
    )
    assert photo_files() == []


def test_cleanup_removes_orphans_and_preserves_referenced_files(admin, db_engine):
    assert (
        admin.put(
            "/api/v1/users/me/avatar",
            content=picture(),
            headers={"Content-Type": "image/png"},
        ).status_code
        == 200
    )
    referenced = photo_files()[0]
    storage = LocalAvatarStorage(settings.media_root)
    orphan_key = storage.write(normalize_avatar(picture()))
    with Session(db_engine) as db:
        assert AvatarService(AccessService(AccessRepository(db))).clean_orphans() == 1
        events = db.exec(
            select(AuditEvent).where(AuditEvent.event_code == "avatar.updated")
        ).all()
        assert len(events) == 1
        assert events[0].after_data["avatar_url"].endswith("/" + referenced.name)
        assert "avatar_key" not in events[0].after_data
    assert referenced.exists()
    assert not storage.path(orphan_key).exists()


def test_storage_rejects_paths_and_reports_unavailable_directory(tmp_path):
    storage = LocalAvatarStorage(tmp_path)
    with pytest.raises(AvatarStorageUnavailable):
        storage.read("../../outside.png")
    assert not storage.delete("../../outside.png")
    assert storage.keys() == []
    (tmp_path / "avatars").write_text("file blocking directory")
    with pytest.raises(AvatarStorageUnavailable):
        storage.write(b"image")


@pytest.mark.postgres
def test_avatars_migrate_from_previous_rbac_version_without_resetting_accounts(
    admin, db_engine
):
    before = admin.get("/api/v1/auth/me").json()
    with db_engine.begin() as connection:
        connection.execute(text("ALTER TABLE users DROP COLUMN avatar_url"))
        connection.execute(
            text(
                "DELETE FROM schema_migrations WHERE version IN "
                "('20261022_02_user_avatars', '20261022_03_avatar_urls')"
            )
        )
    migrate(db_engine)
    migrate(db_engine)
    response = admin.get("/api/v1/auth/me")
    assert response.status_code == 200
    assert response.json()["id"] == before["id"]
    assert response.json()["roles"] == before["roles"]
    assert response.json()["avatar_url"] is None


def test_filename_collision_never_deletes_existing_file(tmp_path, monkeypatch):
    import server.core.users.avatar_storage as module

    identifier = uuid4()
    monkeypatch.setattr(module, "uuid4", lambda: identifier)
    storage = LocalAvatarStorage(tmp_path)
    key = storage.write(b"existing-image")
    with pytest.raises(AvatarStorageUnavailable):
        storage.write(b"replacement")
    assert storage.read(key) == b"existing-image"


def test_partial_write_failure_cleans_new_file(tmp_path, monkeypatch):
    import server.core.users.avatar_storage as module

    def fail_fsync(descriptor):
        raise OSError("Simulovaný výpadek disku")

    monkeypatch.setattr(module.os, "fsync", fail_fsync)
    storage = LocalAvatarStorage(tmp_path)
    with pytest.raises(AvatarStorageUnavailable):
        storage.write(b"image")
    assert storage.keys() == []


def legacy_avatar_column(engine, user_id, key):
    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE users DROP COLUMN avatar_url"))
        connection.execute(text("ALTER TABLE users ADD COLUMN avatar_key varchar(64)"))
        connection.execute(
            text("UPDATE users SET avatar_key = :key WHERE id = :id"),
            {"key": key, "id": user_id},
        )
        connection.execute(
            text(
                "DELETE FROM schema_migrations "
                "WHERE version = '20261022_03_avatar_urls'"
            )
        )


@pytest.mark.postgres
def test_migration_replaces_key_with_working_url_without_moving_file(admin, db_engine):
    me = admin.get("/api/v1/auth/me").json()
    storage = LocalAvatarStorage(settings.media_root)
    key = f"{uuid4().hex}.png"
    storage.directory.mkdir(parents=True, exist_ok=True)
    storage.path(key).write_bytes(picture())
    before = storage.read(key)
    legacy_avatar_column(db_engine, me["id"], key)
    migrate(db_engine)
    migrate(db_engine)
    url = storage.url_for(UUID(me["id"]), key)
    assert admin.get("/api/v1/auth/me").json()["avatar_url"] == url
    assert admin.get(url).content == before
    assert list(storage.directory.iterdir()) == [storage.path(key)]
    assert "avatar_key" not in {
        c["name"] for c in inspect(db_engine).get_columns("users")
    }
    with Session(db_engine) as db:
        assert db.get(User, UUID(me["id"])).avatar_url == url


@pytest.mark.postgres
def test_invalid_legacy_key_aborts_migration_without_dropping_original(
    admin, db_engine
):
    me = admin.get("/api/v1/auth/me").json()
    legacy_avatar_column(db_engine, me["id"], "../../outside.png")
    with pytest.raises(RuntimeError, match="neplatný klíč"):
        migrate(db_engine)
    columns = {c["name"] for c in inspect(db_engine).get_columns("users")}
    assert "avatar_key" in columns
    assert "avatar_url" not in columns
    with db_engine.connect() as connection:
        assert (
            connection.execute(text("SELECT avatar_key FROM users")).scalar_one()
            == "../../outside.png"
        )


def test_storage_urls_are_bound_to_user_and_local_api(tmp_path):
    storage = LocalAvatarStorage(tmp_path)
    owner = uuid4()
    filename = f"{uuid4().hex}.png"
    valid = storage.url_for(owner, filename)
    assert storage.key_from_url(owner, valid) == filename
    for url in (
        f"https://outside.example/{filename}",
        storage.url_for(uuid4(), filename),
        f"/api/v1/users/{owner}/avatar/../../outside.png",
        valid + "?path=../outside",
    ):
        with pytest.raises(AvatarStorageUnavailable):
            storage.key_from_url(owner, url)
    with pytest.raises(AvatarStorageUnavailable):
        storage.url_for(owner, "../../outside.png")


def test_webp_uses_quality_85_and_preserves_transparency(monkeypatch):
    source = BytesIO()
    Image.new("RGBA", (40, 30), (20, 40, 60, 100)).save(source, format="PNG")
    original_save = Image.Image.save
    options = []

    def capture_save(image, output, format=None, **kwargs):
        options.append((format, kwargs.copy()))
        return original_save(image, output, format=format, **kwargs)

    monkeypatch.setattr(Image.Image, "save", capture_save)
    data = normalize_avatar(source.getvalue())
    assert options[0][0] == "WEBP"
    assert options[0][1]["quality"] == 85
    with Image.open(BytesIO(data)) as image:
        assert image.format == "WEBP"
        assert image.getpixel((0, 0))[3] == 100
        assert not image.getexif()


def test_existing_png_is_readable_and_replaced_by_webp(admin, db_engine):
    me = admin.get("/api/v1/auth/me").json()
    storage = LocalAvatarStorage(settings.media_root)
    key = f"{uuid4().hex}.png"
    storage.directory.mkdir(parents=True, exist_ok=True)
    storage.path(key).write_bytes(picture())
    url = storage.url_for(UUID(me["id"]), key)
    with Session(db_engine) as db:
        db.get(User, UUID(me["id"])).avatar_url = url
        db.commit()
    response = admin.get(url)
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"
    assert (
        admin.get(f"/api/v1/users/{me['id']}/avatar").headers["content-type"]
        == "image/png"
    )
    # Úklid nesmí smazat stále používanou starou fotku.
    with Session(db_engine) as db:
        assert AvatarService(AccessService(AccessRepository(db))).clean_orphans() == 0
    response = admin.put(
        "/api/v1/users/me/avatar",
        content=picture("JPEG"),
        headers={"Content-Type": "image/jpg"},
    )
    assert response.status_code == 200
    assert response.json()["avatar_url"].endswith(".webp")
    assert not storage.path(key).exists()
    assert admin.get(url).status_code == 404


def test_legacy_conversion_updates_url_preserves_metadata_and_is_idempotent(
    admin, db_engine
):
    me = admin.get("/api/v1/auth/me").json()
    storage = LocalAvatarStorage(settings.media_root)
    key = f"{uuid4().hex}.png"
    storage.directory.mkdir(parents=True, exist_ok=True)
    storage.path(key).write_bytes(picture())
    old_url = storage.url_for(UUID(me["id"]), key)
    with Session(db_engine) as db:
        db.get(User, UUID(me["id"])).avatar_url = old_url
        db.commit()
        service = AvatarService(AccessService(AccessRepository(db)))
        assert service.convert_legacy() == 1
        assert service.convert_legacy() == 0
    result = admin.get("/api/v1/auth/me").json()
    assert result["id"] == me["id"]
    assert result["roles"] == me["roles"]
    assert result["avatar_url"].endswith(".webp")
    response = admin.get(result["avatar_url"])
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/webp"
    assert not storage.path(key).exists()
    assert admin.get(old_url).status_code == 404


def test_legacy_conversion_conflict_keeps_original_png_and_url(
    admin, db_engine, monkeypatch
):
    me = admin.get("/api/v1/auth/me").json()
    storage = LocalAvatarStorage(settings.media_root)
    key = f"{uuid4().hex}.png"
    storage.directory.mkdir(parents=True, exist_ok=True)
    storage.path(key).write_bytes(picture())
    url = storage.url_for(UUID(me["id"]), key)
    with Session(db_engine) as db:
        db.get(User, UUID(me["id"])).avatar_url = url
        db.commit()

        def conflict(repo):
            repo.db.rollback()
            raise AccessError("conflict", "Simulovaný konflikt převodu")

        with monkeypatch.context() as patch:
            patch.setattr(AccessRepository, "commit", conflict)
            service = AvatarService(AccessService(AccessRepository(db)))
            with pytest.raises(AccessError):
                service.convert_legacy()
    assert storage.keys() == [key]
    assert admin.get("/api/v1/auth/me").json()["avatar_url"] == url
    assert admin.get(url).status_code == 200


def test_conversion_cli_reports_unavailable_database_without_starting_conversion(
    monkeypatch, capsys
):
    import server.scripts.convert_avatars as script
    from sqlalchemy.exc import OperationalError

    def unavailable():
        raise OperationalError("connect", {}, ConnectionError("connection refused"))

    def unexpected_conversion(self):
        pytest.fail("Konverze se nesmí spustit bez dostupné databáze.")

    monkeypatch.setattr(script, "init_db", unavailable)
    monkeypatch.setattr(AvatarService, "convert_legacy", unexpected_conversion)
    with pytest.raises(SystemExit) as result:
        script.main()
    assert result.value.code == 1
    output = capsys.readouterr()
    assert "DATABASE_URL" in output.err
    assert "docker compose" in output.err
    assert "Traceback" not in output.err
    assert output.out == ""
