"""The offline archive contains every runtime image and no school secrets."""

import hashlib
import os
import shutil
import subprocess
import sys
import tarfile
import tempfile
import unittest
from pathlib import Path


class Bundle(unittest.TestCase):
    def test_runtime_images_checksum_and_secret_exclusion(self):
        source = Path(__file__).resolve().parents[2]
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "scripts").mkdir()
            (root / "deploy").mkdir()
            (root / "bin").mkdir()
            shutil.copy2(source / "scripts/ci", root / "scripts/ci")
            for name in ("bod.py", "compose.yml", "Caddyfile"):
                shutil.copy2(source / "deploy" / name, root / "deploy" / name)
            (root / "deploy/config.env").write_text("POSTGRES_PASSWORD=school-secret")
            docker = root / "bin/docker"
            docker.write_text(
                f"#!{sys.executable}\n"
                + """import os, pathlib, sys
args = sys.argv[1:]
if args[0] == "compose":
    print(os.environ["API_IMAGE"])
    print(os.environ["WEB_IMAGE"])
    print("postgres:16-alpine\\nredis:7-alpine\\ncaddy:2-alpine\\nextra:1")
elif args[:2] == ["image", "inspect"]:
    if "{{.Id}}" in args:
        print("sha256:" + ("a" if "api" in args[-1] else "b") * 64)
    elif "{{.Architecture}}" in args:
        print("amd64")
elif args[:2] == ["image", "save"]:
    position = args.index("--output")
    pathlib.Path(args[position + 1]).write_text("\\n".join(args[position + 2:]))
"""
            )
            docker.chmod(0o755)
            uv = root / "bin/uv"
            uv.write_text("#!/bin/sh\nexit 0\n")
            uv.chmod(0o755)
            result = subprocess.run(
                ["bash", str(root / "scripts/ci"), "package"],
                env=os.environ
                | {
                    "PATH": str(root / "bin") + os.pathsep + os.environ["PATH"],
                    "BOD_VERSION": "v0.1.0",
                    "API_IMAGE": "unrelated:ambient-override",
                },
                capture_output=True,
                text=True,
                timeout=15,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            archive = root / "dist/bod-v0.1.0-linux-amd64.tar.gz"
            with tarfile.open(archive) as bundle:
                self.assertNotIn("deploy/config.env", bundle.getnames())
                images = bundle.extractfile("deploy/images.tar").read().decode()
                self.assertEqual(len(images.splitlines()), 6)
                for dependency in (
                    "postgres:16-alpine",
                    "redis:7-alpine",
                    "caddy:2-alpine",
                    "extra:1",
                ):
                    self.assertIn(dependency, images.splitlines())
                self.assertNotIn("ambient-override", images)
                references = bundle.extractfile("deploy/images.env").read().decode()
                self.assertIn("bod-api:v0.1.0-" + "a" * 64, references)
                self.assertIn("bod-web:v0.1.0-" + "b" * 64, references)
            checksum = Path(str(archive) + ".sha256").read_text().split()[0]
            self.assertEqual(checksum, hashlib.sha256(archive.read_bytes()).hexdigest())
