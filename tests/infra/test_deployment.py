"""Data-loss and distribution-boundary regressions for the host deployment tool."""

import io
import json
import os
import sys
import tarfile
import tempfile
import unittest
from types import SimpleNamespace
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "infra/deploy"))

import bod  # noqa: E402
import runtime  # noqa: E402


def state(root):
    return {
        "format": 1,
        "id": "a" * 24,
        "version": "0.1.0",
        "phase": "ready",
        "project": "bod-unit-original",
        "domain": "localhost",
        "origin": "https://localhost:18444",
        "https_mode": "direct",
        "http_port": 18084,
        "https_port": 18444,
        "bind": "127.0.0.1",
        "backup_dir": str(root / "backups"),
        "backup_keep": 7,
        "insecure_localhost": True,
        "system_integration": False,
        "platform": "linux/arm64",
        "postgres_major": "16",
    }


def release(folder, version="0.1.0", upgrades=None, major="16"):
    folder.mkdir(parents=True, exist_ok=True)
    images = {name: "bod-release/" + name + ":" + "a" * 64 for name in runtime.SERVICES}
    for name in runtime.FILES:
        (folder / name).write_bytes(b"test payload")
    (folder / "compose.json").write_text(
        json.dumps(
            {
                "services": {name: {"image": ref} for name, ref in images.items()},
                "volumes": dict.fromkeys(runtime.VOLUMES),
            }
        )
    )
    compose = json.loads((folder / "compose.json").read_text())
    compose["services"]["caddy"].update(
        environment={},
        volumes=[
            {"type": "bind", "source": "./Caddyfile", "target": "/etc/caddy/Caddyfile"}
        ],
    )
    (folder / "compose.json").write_text(json.dumps(compose))
    metadata = {
        "format": 1,
        "version": version,
        "upgrade_from": upgrades or [],
        "postgres_major": major,
        "platform": "linux/arm64",
        "images": images,
        "files": {name: runtime.digest(folder / name) for name in runtime.FILES},
    }
    runtime.write_json(folder / "release.json", metadata)
    return metadata


def volume_archive(path, unsafe=False):
    with tarfile.open(path, "w:gz") as archive:
        item = tarfile.TarInfo("../escape" if unsafe else "./school-file.txt")
        item.size = 3
        archive.addfile(item, io.BytesIO(b"abc"))


def backup(folder, installation, metadata):
    folder.mkdir()
    runtime.write_json(folder / "installation.json", installation)
    runtime.write_json(folder / "release.json", metadata)
    password = "b" * 48
    (folder / "config.env").write_text(
        f"POSTGRES_USER=bod\nPOSTGRES_DB=bod\nPOSTGRES_PASSWORD={password}\n"
        f"DOCKER_DATABASE_URL=postgresql://bod:{password}@db:5432/bod\n"
        f"ALLOWED_ORIGINS={json.dumps([installation['origin']])}\n"
    )
    (folder / "database.dump").write_bytes(b"test database")
    for volume in ("school-media", "caddy-data", "caddy-config"):
        volume_archive(folder / f"{volume}.tar.gz")
    runtime.write_json(
        folder / "backup.json",
        {
            "format": 1,
            "files": {name: runtime.digest(folder / name) for name in bod.BACKUP_FILES},
        },
    )


class DeploymentTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)

    def test_preflight_checks_docker_disk_even_when_install_disk_has_space(self):
        info = {
            "Architecture": "aarch64",
            "NCPU": 2,
            "MemTotal": 4 * 1024**3,
            "DockerRootDir": str(self.root / "docker"),
        }
        with (
            patch("bod.platform.system", return_value="Linux"),
            patch("bod.os.geteuid", return_value=0),
            patch("bod.execute", side_effect=[json.dumps(info), "2.24.4"]),
            patch(
                "bod.shutil.disk_usage",
                side_effect=[
                    SimpleNamespace(free=10 * 1024**3),
                    SimpleNamespace(free=1024**3),
                ],
            ) as usage,
            self.assertRaises(runtime.Error),
        ):
            bod.host_checks({"platform": "linux/arm64"}, self.root)
        self.assertEqual(usage.call_count, 2)

    def test_modified_payload_is_rejected(self):
        release(self.root)
        (self.root / "bod").write_bytes(b"changed")
        with self.assertRaises(runtime.Error):
            runtime.verify_release(self.root)

    def test_release_cannot_request_a_local_build(self):
        metadata = release(self.root)
        compose = runtime.read_json(self.root / "compose.json")
        compose["services"]["api"]["build"] = "."
        runtime.write_json(self.root / "compose.json", compose)
        metadata["files"]["compose.json"] = runtime.digest(self.root / "compose.json")
        runtime.write_json(self.root / "release.json", metadata)
        with self.assertRaises(runtime.Error):
            runtime.verify_release(self.root)

    def test_distribution_rejects_database_publication(self):
        metadata = release(self.root)
        compose = runtime.read_json(self.root / "compose.json")
        compose["services"]["db"]["ports"] = ["5432:5432"]
        runtime.write_json(self.root / "compose.json", compose)
        metadata["files"]["compose.json"] = runtime.digest(self.root / "compose.json")
        runtime.write_json(self.root / "release.json", metadata)
        with self.assertRaises(runtime.Error):
            runtime.verify_release(self.root)

    def test_payload_symlink_is_rejected(self):
        release(self.root)
        (self.root / "bod").unlink()
        (self.root / "bod").symlink_to("runtime.py")
        with self.assertRaises(runtime.Error):
            runtime.verify_release(self.root)

    def test_archive_path_traversal_is_rejected_before_writes(self):
        archive = self.root / "unsafe.tar.gz"
        with tarfile.open(archive, "w:gz") as target:
            member = tarfile.TarInfo("../escape")
            member.size = 1
            target.addfile(member, io.BytesIO(b"x"))
        with self.assertRaises(runtime.Error):
            runtime.extract_archive(archive, self.root / "out", {"release.json"})
        self.assertFalse((self.root / "escape").exists())

    def test_duplicate_archive_members_are_rejected(self):
        archive = self.root / "duplicate.tar.gz"
        with tarfile.open(archive, "w:gz") as target:
            for _ in range(2):
                member = tarfile.TarInfo("release.json")
                member.size = 1
                target.addfile(member, io.BytesIO(b"x"))
        with self.assertRaises(runtime.Error):
            runtime.extract_archive(archive, self.root / "out", {"release.json"})

    def test_volume_traversal_is_rejected(self):
        archive = self.root / "volume.tar.gz"
        volume_archive(archive, unsafe=True)
        with self.assertRaises(runtime.Error):
            runtime.validate_volume_archive(archive)

    def test_concurrent_maintenance_is_rejected(self):
        with (
            bod.operation_lock(self.root),
            self.assertRaises(runtime.Error),
            bod.operation_lock(self.root),
        ):
            pass

    def test_unlisted_upgrade_is_rejected_before_backup_or_load(self):
        candidate = self.root / "candidate"
        release(candidate, version="0.2.0")
        app = bod.Installation(self.root)
        with (
            patch.object(app, "state", return_value=state(self.root)),
            patch("bod.host_checks"),
            patch("bod.load_images") as load,
            patch.object(app, "backup") as save,
        ):
            with self.assertRaises(runtime.Error):
                app.update(candidate, yes=True)
            load.assert_not_called()
            save.assert_not_called()

    def test_postgres_major_upgrade_is_rejected_before_outage(self):
        candidate = self.root / "candidate"
        release(candidate, version="0.2.0", upgrades=["0.1.0"], major="17")
        app = bod.Installation(self.root)
        with (
            patch.object(app, "state", return_value=state(self.root)),
            patch("bod.host_checks"),
            patch("bod.load_images") as load,
            patch.object(app, "backup") as save,
        ):
            with self.assertRaises(runtime.Error):
                app.update(candidate, yes=True)
            load.assert_not_called()
            save.assert_not_called()

    def test_failed_dump_restarts_previously_running_services(self):
        app = bod.Installation(self.root)
        calls = []

        def compose(*args, **kwargs):
            calls.append(args)
            if args[0] == "exec":
                raise runtime.Error("dump failed")
            return ""

        with (
            patch.object(app, "state", return_value=state(self.root)),
            patch.object(app, "running_apps", return_value=["caddy", "web", "api"]),
            patch.object(app, "compose", side_effect=compose),
        ):
            with self.assertRaises(runtime.Error):
                app.backup()
        self.assertTrue(any(call[0] == "up" for call in calls))
        self.assertEqual(list((self.root / "backups").glob("*.tar.gz")), [])

    def test_failed_stop_restarts_previously_running_services(self):
        app = bod.Installation(self.root)
        calls = []

        def compose(*args, **kwargs):
            calls.append(args)
            if args[0] == "stop":
                raise runtime.Error("partial stop failed")
            return ""

        with (
            patch.object(app, "state", return_value=state(self.root)),
            patch.object(app, "running_apps", return_value=["caddy", "web", "api"]),
            patch.object(app, "compose", side_effect=compose),
            self.assertRaises(runtime.Error),
        ):
            app.backup(resume=False)
        self.assertTrue(any(call[0] == "up" for call in calls))

    def test_backup_bookkeeping_failure_resumes_services_before_update(self):
        original = state(self.root)
        release(self.root / "releases/0.1.0")
        app = bod.Installation(self.root)
        app.activate(self.root / "releases/0.1.0", original)
        (self.root / "config.env").write_text("private configuration")
        calls = []

        def compose(*args, **kwargs):
            calls.append(args)
            if args[0] == "exec":
                kwargs["output_file"].write(b"database dump")
            return ""

        def write_json(path, value):
            if path.name == "last-backup.json":
                raise runtime.Error("metadata disk full")
            runtime.write_json(path, value)

        with (
            patch.object(app, "running_apps", return_value=["api", "web", "caddy"]),
            patch.object(app, "compose", side_effect=compose),
            patch.object(
                app, "volume", side_effect=lambda name, path: volume_archive(path)
            ),
            patch("bod.write_json", side_effect=write_json),
            self.assertRaises(runtime.Error),
        ):
            app.backup(resume=False)
        self.assertTrue(any(call[0] == "up" for call in calls))
        self.assertEqual(len(list((self.root / "backups").glob("*.tar.gz"))), 1)

    def test_missing_backup_volume_is_never_created_as_empty(self):
        release(self.root / "releases/0.1.0")
        app = bod.Installation(self.root)
        with (
            patch.object(app, "state", return_value=state(self.root)),
            patch(
                "bod.execute", side_effect=runtime.Error("volume missing")
            ) as execute,
            self.assertRaises(runtime.Error),
        ):
            app.volume("school-media", self.root / "media.tar.gz")
        self.assertEqual(execute.call_count, 1)
        self.assertEqual(execute.call_args.args[0][:3], ["docker", "volume", "inspect"])

    def test_failed_initial_image_load_can_be_retried(self):
        source = self.root / "source"
        release(source)
        target = self.root / "installation"
        target.mkdir()
        args = SimpleNamespace(
            bundle=source,
            domain="localhost",
            https_mode="direct",
            admin="root",
            insecure_localhost=True,
            backup_dir=None,
            https_port=None,
            http_port=None,
            project=None,
            bind=None,
            no_system_integration=True,
        )
        with (
            patch("bod.host_checks"),
            patch("bod.socket.getaddrinfo"),
            patch("bod.require_empty_project"),
            patch(
                "bod.load_images", side_effect=runtime.Error("daemon unavailable")
            ) as load,
        ):
            for _ in range(2):
                with self.assertRaises(runtime.Error):
                    bod.install(args, target)
                self.assertEqual(list(target.iterdir()), [])
        self.assertEqual(load.call_count, 2)
        self.assertTrue((source / "release.json").exists())

    def test_install_retry_is_not_ready_before_bootstrap_succeeds(self):
        original = {
            **state(self.root),
            "phase": "install-failed",
            "admin_username": "root",
        }
        release(self.root / "releases/0.1.0")
        app = bod.Installation(self.root)
        app.activate(self.root / "releases/0.1.0", original)
        with (
            patch.object(bod.Installation, "up"),
            patch.object(bod.Installation, "probe"),
            patch.object(
                bod.Installation,
                "compose",
                side_effect=runtime.Error("bootstrap failed"),
            ),
            self.assertRaises(runtime.Error),
        ):
            bod.install(SimpleNamespace(), self.root)
        self.assertEqual(app.state()["phase"], "install-failed")
        with (
            patch.object(bod.Installation, "up"),
            patch.object(bod.Installation, "probe"),
            patch.object(bod.Installation, "compose", return_value=""),
        ):
            bod.install(SimpleNamespace(), self.root)
        self.assertEqual(app.state()["phase"], "ready")

    def test_probe_waits_for_first_certificate(self):
        app = bod.Installation(self.root)
        health = io.BytesIO(b'{"status":"ok"}')
        health.url, health.status = "https://localhost:18444/health", 200
        login = io.BytesIO(b"login")
        login.url, login.status = "https://localhost:18444/login", 200
        with (
            patch.object(app, "state", return_value=state(self.root)),
            patch(
                "bod.urllib.request.urlopen",
                side_effect=[OSError("certificate not ready"), health, login],
            ) as request,
            patch("bod.time.monotonic", return_value=0),
            patch("bod.time.sleep") as sleep,
        ):
            app.probe()
        self.assertEqual(request.call_count, 3)
        sleep.assert_called_once()

    def test_probe_rejects_redirect_after_deadline(self):
        app = bod.Installation(self.root)
        response = io.BytesIO(b'{"status":"ok"}')
        response.url, response.status = "https://another-app.example/health", 200
        with (
            patch.object(app, "state", return_value=state(self.root)),
            patch("bod.urllib.request.urlopen", return_value=response),
            patch("bod.time.monotonic", side_effect=[0, 61]),
            self.assertRaises(runtime.Error),
        ):
            app.probe()

    def test_malformed_release_types_return_operator_error(self):
        for key, value in (
            ("version", []),
            ("images", []),
            ("files", None),
            ("platform", {}),
        ):
            with self.subTest(key=key):
                metadata = release(self.root)
                metadata[key] = value
                runtime.write_json(self.root / "release.json", metadata)
                with self.assertRaises(runtime.Error):
                    runtime.verify_release(self.root)

    def test_failed_fresh_restore_is_retryable_and_preserves_source(self):
        source = self.root / "source"
        metadata = release(source)
        target = self.root / "installation"
        target.mkdir()
        folder = self.root / "backup"
        backup(folder, state(target), metadata)
        archive = self.root / "backup.tar.gz"
        runtime.archive_files(folder, archive, bod.BACKUP_FILES | {"backup.json"})
        args = SimpleNamespace(
            archive=archive,
            yes=True,
            bundle=source,
            project="bod-restore-candidate",
            backup_dir=None,
            http_port=None,
            https_port=None,
        )
        calls = []

        def compose(instance, *arguments, **kwargs):
            calls.append((instance.state()["project"], arguments))
            if arguments[0] == "up":
                raise runtime.Error("candidate failed")
            return ""

        with (
            patch("bod.host_checks"),
            patch("bod.load_images"),
            patch("bod.require_empty_project"),
            patch("bod.secrets.token_hex", return_value="candidate"),
            patch.object(bod.Installation, "compose", new=compose),
        ):
            for _ in range(2):
                with self.assertRaises(runtime.Error):
                    bod.restore(args, target)
                self.assertEqual(list(target.iterdir()), [])
        deletions = [(project, args) for project, args in calls if "--volumes" in args]
        self.assertEqual(
            deletions, [("bod-restore-candidate", ("down", "--volumes"))] * 2
        )
        self.assertTrue(archive.exists())
        self.assertTrue((source / "release.json").exists())

    def test_unknown_files_are_not_installed(self):
        source = self.root / "source"
        metadata = release(source)
        (source / "private.env").write_text("not part of release")
        destination = bod.store_release(self.root / "installation", source, metadata)
        self.assertFalse((destination / "private.env").exists())

    def test_invalid_restore_never_stops_live_application(self):
        original = state(self.root)
        runtime.write_json(self.root / "installation.json", original)
        source = self.root / "source"
        metadata = release(source)
        bad_state = {**original, "project": "another-application"}
        folder = self.root / "backup"
        backup(folder, bad_state, metadata)
        archive = self.root / "backup.tar.gz"
        runtime.archive_files(folder, archive, bod.BACKUP_FILES | {"backup.json"})
        args = type("Args", (), {"archive": archive, "yes": True})()
        with patch.object(bod.Installation, "compose") as compose:
            with self.assertRaises(runtime.Error):
                bod.restore(args, self.root)
            compose.assert_not_called()

    def test_shell_secrets_do_not_override_installation_config(self):
        app = bod.Installation(self.root)
        with (
            patch.object(app, "state", return_value=state(self.root)),
            patch.dict(os.environ, {"POSTGRES_PASSWORD": "foreign-value"}),
            patch("bod.execute", return_value="") as command,
        ):
            app.compose("ps")
            self.assertNotIn("POSTGRES_PASSWORD", command.call_args.kwargs["env"])

    def test_restore_failure_never_deletes_original_volumes(self):
        original = state(self.root)
        metadata = release(self.root / "releases/0.1.0")
        app = bod.Installation(self.root)
        app.activate(self.root / "releases/0.1.0", original)
        (self.root / "config.env").write_text("original secret configuration")
        folder = self.root / "backup"
        backup(folder, original, metadata)
        archive = self.root / "backup.tar.gz"
        runtime.archive_files(folder, archive, bod.BACKUP_FILES | {"backup.json"})
        args = SimpleNamespace(
            archive=archive,
            yes=True,
            bundle=None,
            project="bod-restore-candidate",
            backup_dir=None,
            http_port=None,
            https_port=None,
        )
        calls = []

        def compose(instance, *arguments, **kwargs):
            project = instance.state()["project"]
            calls.append((project, arguments))
            if arguments[0] == "ps":
                return "db\nredis\napi\nweb\ncaddy\n"
            if project == "bod-restore-candidate" and arguments[0] == "up":
                raise runtime.Error("candidate database failed")
            return ""

        with (
            patch("bod.host_checks"),
            patch("bod.load_images"),
            patch("bod.require_empty_project"),
            patch("bod.secrets.token_hex", return_value="candidate"),
            patch.object(bod.Installation, "compose", new=compose),
        ):
            with self.assertRaises(runtime.Error):
                bod.restore(args, self.root)
        deletions = [
            (project, arguments)
            for project, arguments in calls
            if "--volumes" in arguments
        ]
        self.assertEqual(deletions, [("bod-restore-candidate", ("down", "--volumes"))])
        self.assertEqual(app.state()["project"], original["project"])
        self.assertEqual(
            (self.root / "config.env").read_text(), "original secret configuration"
        )
        self.assertTrue(
            any(
                project == original["project"] and arguments[0] == "up"
                for project, arguments in calls
            )
        )

    def test_failed_update_keeps_new_version_for_safe_recovery(self):
        original = state(self.root)
        release(self.root / "releases/0.1.0")
        app = bod.Installation(self.root)
        app.activate(self.root / "releases/0.1.0", original)
        source = self.root / "candidate"
        release(source, version="0.2.0", upgrades=["0.1.0"])
        with (
            patch("bod.host_checks"),
            patch("bod.load_images"),
            patch.object(app, "backup", return_value=self.root / "safe-backup.tar.gz"),
            patch.object(
                app, "start", side_effect=runtime.Error("new migration failed")
            ),
            patch.object(app, "compose"),
        ):
            with self.assertRaises(runtime.Error):
                app.update(source, yes=True)
        self.assertEqual(app.state()["version"], "0.2.0")
        self.assertEqual(app.state()["phase"], "update-failed")
        self.assertEqual(
            (self.root / "current").resolve(), (self.root / "releases/0.2.0").resolve()
        )

    def test_reusing_version_with_different_content_is_rejected(self):
        source = self.root / "source"
        metadata = release(source)
        bod.store_release(self.root / "server", source, metadata)
        (source / "bod").write_bytes(b"another release")
        metadata["files"]["bod"] = runtime.digest(source / "bod")
        runtime.write_json(source / "release.json", metadata)
        with self.assertRaises(runtime.Error):
            bod.store_release(self.root / "server", source, metadata)


if __name__ == "__main__":
    unittest.main()
