"""Regression tests for failures that could lose data or interrupt the school."""

import importlib.util
import io
import os
import subprocess
import tarfile
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

spec = importlib.util.spec_from_file_location(
    "bod", Path(__file__).resolve().parents[2] / "deploy/bod.py"
)
bod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bod)


class Operations(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.disk = patch.object(
            bod.shutil, "disk_usage", return_value=SimpleNamespace(free=10 * 1024**3)
        )
        self.disk.start()
        self.addCleanup(self.disk.stop)
        self.school = bod.School(self.root)
        bod.write_env(
            self.school.config,
            {"BOD_PROJECT": "bod-original", "POSTGRES_PASSWORD": "secret"},
        )
        bod.write_env(
            self.school.images, {"API_IMAGE": "api:old", "WEB_IMAGE": "web:old"}
        )

    def backup(self, member="file", kind=tarfile.REGTYPE):
        folder = self.root / "source"
        folder.mkdir()
        for name in ("config.env", "images.env"):
            (folder / name).write_bytes((self.root / name).read_bytes())
        (folder / "database.dump").write_bytes(b"PGDMP")
        with tarfile.open(folder / "media.tar.gz", "w:gz") as archive:
            info = tarfile.TarInfo(member)
            info.type = kind
            info.size = 1 if kind == tarfile.REGTYPE else 0
            archive.addfile(info, io.BytesIO(b"x") if info.size else None)
        (folder / ".complete").touch()
        return folder

    def test_environment_does_not_override_school_configuration(self):
        with (
            patch.dict(
                os.environ,
                {
                    "POSTGRES_PASSWORD": "other",
                    "COMPOSE_PROJECT_NAME": "unrelated-school",
                    "COOKIE_SECURE": "false",
                },
            ),
            patch.object(bod.subprocess, "run") as run,
        ):
            self.school.compose("ps")
        self.assertNotIn("POSTGRES_PASSWORD", run.call_args.kwargs["env"])
        self.assertNotIn("COOKIE_SECURE", run.call_args.kwargs["env"])
        command = run.call_args.args[0]
        self.assertEqual(command[command.index("-p") + 1], "bod-original")

    def test_concurrent_maintenance_is_rejected(self):
        with self.school.lock(), self.assertRaises(ValueError), self.school.lock():
            pass

    def test_failed_dump_resumes_only_previously_running_services(self):
        with (
            patch.object(self.school, "running", return_value=["api"]),
            patch.object(self.school, "compose") as call,
        ):
            call.side_effect = [None, subprocess.CalledProcessError(1, "docker"), None]
            with self.assertRaises(subprocess.CalledProcessError):
                self.school.backup(self.root / "backup")
        self.assertEqual(call.call_args.args, ("start", "api"))
        self.assertFalse((self.root / "backup/.complete").exists())

    def test_incomplete_backup_never_touches_docker(self):
        folder = self.backup()
        (folder / ".complete").unlink()
        with (
            patch.object(self.school, "compose") as call,
            self.assertRaises(ValueError),
        ):
            self.school.restore(folder)
        call.assert_not_called()

    def test_unsafe_media_archives_never_touch_docker(self):
        for name, kind in [
            ("../escape", tarfile.REGTYPE),
            ("/absolute", tarfile.REGTYPE),
            ("link", tarfile.SYMTYPE),
            ("device", tarfile.CHRTYPE),
        ]:
            with self.subTest(name=name):
                folder = self.backup(name, kind)
                with (
                    patch.object(self.school, "compose") as call,
                    self.assertRaises(ValueError),
                ):
                    self.school.restore(folder)
                call.assert_not_called()
                import shutil

                shutil.rmtree(folder)

    def test_failed_candidate_start_preserves_configuration_and_original_volumes(self):
        folder = self.backup()
        before = self.school.config.read_bytes()
        calls = []

        def compose(*args, **kwargs):
            calls.append((args, kwargs))
            if args[:2] == ("up", "-d") and "--wait-timeout" in args:
                raise subprocess.CalledProcessError(1, "docker")

        with (
            patch.object(self.school, "compose", side_effect=compose),
            patch.object(self.school, "running", return_value=["api"]),
        ):
            with self.assertRaises(subprocess.CalledProcessError):
                self.school.restore(folder)
        self.assertEqual(self.school.config.read_bytes(), before)
        self.assertEqual(calls[-1][0], ("start", "api"))
        self.assertTrue(
            all("down" not in args and "--volumes" not in args for args, _ in calls)
        )

    def test_failed_update_keeps_new_image_selection_and_backup(self):
        images = self.root / "candidate.env"
        bod.write_env(images, {"API_IMAGE": "api:new", "WEB_IMAGE": "web:new"})
        with (
            patch.object(self.school, "backup") as backup,
            patch.object(self.school, "compose") as call,
        ):
            call.side_effect = [None, subprocess.CalledProcessError(1, "docker")]
            with self.assertRaisesRegex(ValueError, "Nové obrazy"):
                self.school.update(images)
        backup.assert_called_once()
        self.assertEqual(bod.read_env(self.school.images)["API_IMAGE"], "api:new")

    def test_update_refuses_an_already_overwritten_image_file(self):
        with (
            patch.object(self.school, "compose") as call,
            self.assertRaises(ValueError),
        ):
            self.school.update(self.school.images)
        call.assert_not_called()

    def test_old_offline_installation_is_not_overwritten(self):
        (self.root / "installation.json").write_text("{}")
        before = self.school.config.read_bytes()
        with (
            patch.object(self.school, "compose") as call,
            self.assertRaises(ValueError),
        ):
            self.school.install("school.example", False)
        call.assert_not_called()
        self.assertEqual(self.school.config.read_bytes(), before)

    def test_repeated_install_keeps_credentials_and_does_not_bootstrap_again(self):
        (self.root / ".initialized").touch()
        before = self.school.config.read_bytes()
        with patch.object(self.school, "compose") as call:
            self.school.install("other.example", True)
        self.assertEqual(self.school.config.read_bytes(), before)
        self.assertFalse(
            any("bootstrap_admin" in str(args) for args in call.call_args_list)
        )

    def test_invalid_domain_does_not_write_configuration(self):
        self.school.config.unlink()
        with (
            patch.object(self.school, "compose") as call,
            self.assertRaises(ValueError),
        ):
            self.school.install("https://school.example/path", False)
        call.assert_not_called()
        self.assertFalse(self.school.config.exists())

    def test_configuration_failure_after_candidate_start_restores_previous_selection(
        self,
    ):
        folder = self.backup()
        previous = self.school.config.read_bytes()
        original = bod.write_env
        failed = False

        def write(path, values):
            nonlocal failed
            if path == self.school.config and not failed:
                failed = True
                raise OSError("disk full")
            return original(path, values)

        with (
            patch.object(self.school, "compose"),
            patch.object(self.school, "running", return_value=["api"]),
            patch.object(bod, "write_env", side_effect=write),
        ):
            with self.assertRaises(OSError):
                self.school.restore(folder)
        self.assertEqual(self.school.config.read_bytes(), previous)
        self.assertEqual(bod.read_env(self.school.images)["API_IMAGE"], "api:old")

    def test_insufficient_space_is_rejected_before_installation(self):
        self.school.config.unlink()
        with (
            patch.object(
                bod.shutil, "disk_usage", return_value=SimpleNamespace(free=0)
            ),
            patch.object(self.school, "compose") as call,
        ):
            with self.assertRaisesRegex(ValueError, "3 GiB"):
                self.school.install("school.example", False)
        call.assert_not_called()
        self.assertFalse(self.school.config.exists())

    def test_failed_candidate_preparation_never_stops_original_services(self):
        folder = self.backup()
        calls = []

        def compose(*args, **kwargs):
            calls.append((args, kwargs))
            if "pg_restore" in " ".join(args):
                raise subprocess.CalledProcessError(1, "docker")

        with patch.object(self.school, "compose", side_effect=compose):
            with self.assertRaises(subprocess.CalledProcessError):
                self.school.restore(folder)
        self.assertEqual(calls[-1][0], ("stop", "db", "redis"))
        self.assertTrue(
            all(kwargs.get("project") != "bod-original" for _, kwargs in calls)
        )

    def test_interrupted_switch_resumes_original_application(self):
        folder = self.backup()
        previous = self.school.config.read_bytes()
        calls = []

        def compose(*args, **kwargs):
            calls.append(args)
            if "--wait-timeout" in args:
                raise KeyboardInterrupt()

        with (
            patch.object(self.school, "compose", side_effect=compose),
            patch.object(self.school, "running", return_value=["api"]),
        ):
            with self.assertRaises(KeyboardInterrupt):
                self.school.restore(folder)
        self.assertEqual(self.school.config.read_bytes(), previous)
        self.assertEqual(calls[-1], ("start", "api"))
        self.assertFalse((self.root / ".initialized").exists())

    def test_successful_restore_stops_old_database_without_deleting_volumes(self):
        folder = self.backup()
        with (
            patch.object(self.school, "compose") as call,
            patch.object(self.school, "running", return_value=["api"]),
        ):
            self.school.restore(folder)
        self.assertNotEqual(
            bod.read_env(self.school.config)["BOD_PROJECT"], "bod-original"
        )
        self.assertEqual(call.call_args.args, ("stop", "db", "redis"))
        self.assertEqual(call.call_args.kwargs["project"], "bod-original")
        self.assertTrue(
            all(
                "down" not in args.args and "--volumes" not in args.args
                for args in call.call_args_list
            )
        )


if __name__ == "__main__":
    unittest.main()
