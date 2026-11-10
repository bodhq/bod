"""Run against disposable Docker projects; no registry publishing or school data."""

import argparse
import hashlib
import http.cookiejar
import importlib.util
import json
import re
import secrets
import shutil
import socket
import ssl
import subprocess
import sys
import time
import tempfile
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("bod", ROOT / "deploy/bod.py")
bod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bod)


def free_port():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def main(bundle=None):
    with tempfile.TemporaryDirectory(prefix="bod-production-") as temporary:
        root = Path(temporary)
        for name in ("bod.py", "compose.yml", "Caddyfile"):
            shutil.copyfile((bundle or ROOT / "deploy") / name, root / name)
        school = bod.School(root)
        prefix = "bod-ci-" + secrets.token_hex(6)
        port = free_port()
        origin = f"https://localhost:{port}"
        password = secrets.token_hex(24)
        bod.write_env(
            school.config,
            {
                "BOD_PROJECT": prefix,
                "BOD_BIND": "127.0.0.1",
                "BOD_HTTP_PORT": str(free_port()),
                "BOD_HTTPS_PORT": str(port),
                "SITE_ADDRESS": "localhost",
                "POSTGRES_USER": "bod",
                "POSTGRES_DB": "bod",
                "POSTGRES_PASSWORD": password,
                "DOCKER_DATABASE_URL": f"postgresql://bod:{password}@db:5432/bod",
                "ALLOWED_ORIGINS": json.dumps([origin]),
            },
        )
        if bundle:
            shutil.copyfile(bundle / "images.env", school.images)
            (root / "images.tar").symlink_to(bundle / "images.tar")
        else:
            bod.write_env(
                school.images,
                {"API_IMAGE": "bod-ci-api:verify", "WEB_IMAGE": "bod-ci-web:verify"},
            )
        jar = http.cookiejar.CookieJar()
        client = urllib.request.build_opener(
            urllib.request.HTTPCookieProcessor(jar),
            urllib.request.HTTPSHandler(context=ssl._create_unverified_context()),
        )

        def request(path, payload=None):
            data = None if payload is None else json.dumps(payload).encode()
            req = urllib.request.Request(
                origin + path,
                data=data,
                headers={
                    "Origin": origin,
                    "Content-Type": "application/json",
                    "X-Requested-With": "bod",
                },
            )
            with client.open(req, timeout=30) as response:
                assert response.status == 200 and response.url == origin + path
                return response.read()

        def login(value):
            jar.clear()
            request("/api/v1/auth/login", {"username": "root", "password": value})
            assert any(cookie.secure for cookie in jar)

        def media(value=None):
            script = (
                'from pathlib import Path; import hashlib; p=Path("/var/lib/bod/media/smoke.bin"); '
                + (
                    f'p.write_bytes(bytes.fromhex("{value.hex()}"))'
                    if value is not None
                    else "print(hashlib.sha256(p.read_bytes()).hexdigest())"
                )
            )
            return school.compose(
                "exec",
                "-T",
                "api",
                "python",
                "-c",
                script,
                capture_output=True,
                text=True,
            ).stdout.strip()

        passed = False
        try:
            installation = subprocess.run(
                [
                    sys.executable,
                    str(root / "bod.py"),
                    "install",
                    "--domain",
                    "localhost",
                    *(["--offline"] if bundle else []),
                ],
                capture_output=True,
                text=True,
                check=True,
                timeout=300,
            )
            deadline = time.monotonic() + 30
            while True:
                try:
                    assert json.loads(request("/health"))["status"] == "ok"
                    break
                except (OSError, urllib.error.URLError):
                    if time.monotonic() >= deadline:
                        raise
                    time.sleep(0.5)
            try:
                request("/api/v1/auth/me")
                raise AssertionError("Anonymous auth/me returned success")
            except urllib.error.HTTPError as error:
                assert error.code == 401
            html = request("/login").decode()
            assets = set(re.findall(r'(?:src|href)="(/_next/static/[^"]+)"', html))
            assert assets
            for asset in assets:
                request(asset)
            temporary_password = re.search(
                r"Dočasné heslo: (\S+)", installation.stdout
            ).group(1)
            login(temporary_password)
            current_password = secrets.token_urlsafe(24)
            request(
                "/api/v1/auth/change-password",
                {
                    "current_password": temporary_password,
                    "new_password": current_password,
                },
            )
            login(current_password)
            request("/api/v1/auth/me")
            request("/app")
            original_media = b"school-media\x00\n"
            media(original_media)
            update = root / "candidate-images.env"
            bod.write_env(update, bod.read_env(school.images))
            school.update(update, offline=bool(bundle))
            assert list((root / "backups").glob("*/.complete"))
            login(current_password)
            backup = school.backup(root / "backup")
            media(b"after-backup")
            school.restore(backup)
            login(current_password)
            request("/app")
            assert media() == hashlib.sha256(original_media).hexdigest()
            assert bod.read_env(school.config)["BOD_PROJECT"] != prefix
            passed = True
            print(
                "Production smoke passed: HTTPS, assets, secure login, SSR, update, backup and restore."
            )
        finally:
            # Exact random prefix belongs only to this invocation; never remove other projects.
            result = subprocess.run(
                ["docker", "compose", "ls", "--all", "--format", "json"],
                check=True,
                capture_output=True,
                text=True,
            )
            for project in json.loads(result.stdout):
                if project["Name"] == prefix or project["Name"].startswith(
                    prefix + "-r-"
                ):
                    if not passed:
                        school.compose(
                            "logs",
                            "--no-color",
                            "--tail",
                            "80",
                            project=project["Name"],
                        )
                    school.compose(
                        "down", "--volumes", "--remove-orphans", project=project["Name"]
                    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bundle", type=Path)
    args = parser.parse_args()
    main(args.bundle.resolve() if args.bundle else None)
