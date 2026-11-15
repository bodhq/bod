"""Deployment must reject unverified jobs and keep bootstrap secrets off CI logs."""

import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


class Pipeline(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.root = Path(directory.name)
        self.source = Path(__file__).resolve().parents[2]
        self.bin = self.root / "bin"
        self.bin.mkdir()
        self.installation = self.root / "installation"
        self.calls = self.root / "calls"
        self.environment = os.environ | {
            "PATH": str(self.bin) + os.pathsep + os.environ["PATH"],
            "CI_COMMIT_SHA": "a" * 40,
            "BOD_DEPLOY_SHA": "a" * 40,
            "CI_COMMIT_REF_NAME": "develop",
            "CI_COMMIT_REF_PROTECTED": "true",
            "CI_REGISTRY": "registry.example.test",
            "CI_REGISTRY_IMAGE": "registry.example.test/school/bod",
            "CI_JOB_TOKEN": "registry-secret",
            "BOD_DEPLOY_DIR": str(self.installation),
            "CALL_LOG": str(self.calls),
        }
        stub = (
            f"#!{sys.executable}\n"
            + """import os, pathlib, sys
name = pathlib.Path(sys.argv[0]).name
args = sys.argv[1:]
with open(os.environ["CALL_LOG"], "a") as output:
    output.write(name + " " + " ".join(args) + "\\n")
if name == "git":
    print(os.environ.get("BRANCH_HEAD", os.environ["CI_COMMIT_SHA"]) + "\\trefs/heads/develop")
elif name == "docker":
    if args[0] == "pull" and os.environ.get("FAIL_PULL"):
        sys.exit(1)
    if args[:2] == ["image", "inspect"]:
        print(args[-1].split(":sha-")[0] + "@sha256:" + "b" * 64)
elif name == "python3" and "install" in args:
    print("temporary-admin-password")
    pathlib.Path(os.environ["BOD_DEPLOY_DIR"], ".initialized").touch()
"""
        )
        for name in ("git", "docker", "python3"):
            executable = self.bin / name
            executable.write_text(stub)
            executable.chmod(0o755)

    def run_deploy(self, **overrides):
        return subprocess.run(
            ["bash", str(self.source / "scripts/deploy")],
            env=self.environment | overrides,
            capture_output=True,
            text=True,
            timeout=10,
        )

    def test_unverified_job_never_contacts_registry(self):
        for overrides in (
            {"CI_COMMIT_REF_PROTECTED": "false"},
            {"BOD_DEPLOY_SHA": "c" * 40},
        ):
            result = self.run_deploy(**overrides)
            self.assertNotEqual(result.returncode, 0)
            self.assertFalse(self.calls.exists())

    def test_stale_commit_does_not_change_installation(self):
        result = self.run_deploy(BRANCH_HEAD="c" * 40)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertNotIn("docker", self.calls.read_text())
        self.assertFalse(self.installation.exists())

    def test_failed_pull_keeps_existing_configuration_and_credentials(self):
        self.installation.mkdir()
        for name in ("config.env", "images.env", ".first-admin.txt"):
            (self.installation / name).write_text("original")
        result = self.run_deploy(FAIL_PULL="1")
        self.assertNotEqual(result.returncode, 0)
        for name in ("config.env", "images.env", ".first-admin.txt"):
            self.assertEqual((self.installation / name).read_text(), "original")

    def test_first_install_keeps_password_off_ci_logs(self):
        result = self.run_deploy()
        self.assertEqual(result.returncode, 0, result.stderr)
        credential = self.installation / ".first-admin.txt"
        self.assertEqual(credential.stat().st_mode & 0o777, 0o600)
        self.assertIn("temporary-admin-password", credential.read_text())
        self.assertNotIn("temporary-admin-password", result.stdout + result.stderr)
        self.assertNotIn("registry-secret", result.stdout + result.stderr)
        images = (self.installation / "images.env").read_text()
        self.assertEqual(len(images.splitlines()), 2)
        self.assertIn("@sha256:", images)

    def test_update_preserves_first_admin_credentials(self):
        self.installation.mkdir()
        (self.installation / ".initialized").touch()
        (self.installation / ".first-admin.txt").write_text("original")
        result = self.run_deploy()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(
            (self.installation / ".first-admin.txt").read_text(), "original"
        )
        self.assertIn(" update ", self.calls.read_text())
