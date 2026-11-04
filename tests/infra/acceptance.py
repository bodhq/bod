#!/usr/bin/env python3
"""Exercise the shipped installer on a disposable Linux VM with a real Docker daemon."""

from __future__ import annotations

import argparse
import base64
import hashlib
import http.cookiejar
import json
import os
import re
import secrets
import shutil
import ssl
import subprocess
import tarfile
import urllib.error
import urllib.request
from pathlib import Path


def run(command, *, log=None):
    result = subprocess.run(command, capture_output=True, text=True)
    if log:
        log.write_text(result.stdout + "\n" + result.stderr)
        log.chmod(0o600)
    if result.returncode:
        raise RuntimeError(
            f"Command failed ({result.returncode}): {command[0]}; private log: {log}"
        )
    return result.stdout


def cli(root, *args, source=None, log=None):
    command = (
        [str(root / "bod"), *args]
        if source is None
        else ["python3", str(source / "bod"), "--root", str(root), *args]
    )
    return run(command, log=log)


def compose(root, *args):
    metadata = json.loads((root / "installation.json").read_text())
    env = dict(os.environ)
    for key in (
        "POSTGRES_USER",
        "POSTGRES_PASSWORD",
        "POSTGRES_DB",
        "DOCKER_DATABASE_URL",
        "ALLOWED_ORIGINS",
    ):
        env.pop(key, None)
    result = subprocess.run(
        [
            "docker",
            "compose",
            "-p",
            metadata["project"],
            "--env-file",
            str(root / "config.env"),
            "-f",
            str(root / "compose.json"),
            *args,
        ],
        capture_output=True,
        text=True,
        env=env,
    )
    if result.returncode:
        raise RuntimeError("Acceptance Docker operation failed")
    return result.stdout


class Client:
    def __init__(self, origin="https://localhost"):
        self.origin = origin
        self.jar = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(
            urllib.request.HTTPCookieProcessor(self.jar),
            urllib.request.HTTPSHandler(context=ssl._create_unverified_context()),
        )

    def call(self, path, body=None, method=None, status=200):
        request = urllib.request.Request(
            self.origin + path,
            method=method,
            data=json.dumps(body).encode() if body is not None else None,
            headers={
                "Origin": self.origin,
                "Content-Type": "application/json",
                "X-Requested-With": "bod",
            },
        )
        try:
            response = self.opener.open(request, timeout=20)
        except urllib.error.HTTPError as error:
            response = error
        if response.status != status or response.url != self.origin + path:
            raise AssertionError(
                f"Unexpected status/redirect for {path}: {response.status}"
            )
        data = response.read()
        return (
            json.loads(data)
            if "application/json" in response.headers.get("Content-Type", "")
            else data
        )

    def login(self, password):
        self.call("/api/v1/auth/login", {"username": "root", "password": password})
        if not any(cookie.secure for cookie in self.jar):
            raise AssertionError("Session cookie must be secure")


def extract(bundle: Path, folder: Path):
    folder.mkdir()
    with tarfile.open(bundle, "r:gz") as archive:
        archive.extractall(folder, filter="data")


def media(root, value=None):
    if value is not None:
        script = (
            "from pathlib import Path; import base64; Path('/var/lib/bod/media/acceptance.bin').write_bytes(base64.b64decode('"
            + base64.b64encode(value).decode()
            + "'))"
        )
    else:
        script = "from pathlib import Path; import hashlib; print(hashlib.sha256(Path('/var/lib/bod/media/acceptance.bin').read_bytes()).hexdigest())"
    return compose(root, "exec", "-T", "api", "python", "-c", script).strip()


def verify(
    root,
    fixture,
    expected_name="Před zálohou",
    expected_media=b"school-media-before\x00\n",
):
    client = Client()
    client.login(fixture["password"])
    student = client.call("/api/v1/admin/users/" + fixture["student_id"])
    if (
        student["id"] != fixture["student_id"]
        or student["display_name"] != expected_name
    ):
        raise AssertionError("School account was not preserved")
    client.call("/app")
    if media(root) != hashlib.sha256(expected_media).hexdigest():
        raise AssertionError("Media file was not preserved")
    password = next(
        line.split("=", 1)[1]
        for line in (root / "config.env").read_text().splitlines()
        if line.startswith("POSTGRES_PASSWORD=")
    )
    for command in ("status", "doctor"):
        if password in cli(root, command):
            raise AssertionError("Diagnostics exposed a database password")
    return client


def cleanup(root):
    metadata_path = root / "installation.json"
    if not metadata_path.exists():
        return
    metadata = json.loads(metadata_path.read_text())
    identity = metadata["id"]
    if not re.fullmatch(r"[0-9a-f]{24}", identity):
        raise AssertionError("Refusing cleanup of unknown resources")
    label = "org.bodhq.installation=" + identity
    ids = run(["docker", "ps", "-aq", "--filter", "label=" + label]).split()
    if ids:
        run(["docker", "rm", "-f", *ids])
    names = run(["docker", "volume", "ls", "-q", "--filter", "label=" + label]).split()
    if names:
        run(["docker", "volume", "rm", *names])
    networks = run(["docker", "network", "ls", "--format", "{{.Name}}|{{.Labels}}"])
    projects = {
        metadata["project"],
        *(p["project"] for p in metadata.get("retired_projects", [])),
    }
    for line in networks.splitlines():
        name, labels = line.split("|", 1)
        if any(
            f"com.docker.compose.project={project}" in labels.split(",")
            for project in projects
        ):
            run(["docker", "network", "rm", name])


def stop_system_integration(root):
    link = Path("/usr/local/bin/bod")
    if link.is_symlink() and link.resolve() == root / "bod":
        run(["systemctl", "disable", "--now", "bod-backup.timer"])
        link.unlink()
        for name in ("bod-backup.timer", "bod-backup.service"):
            (Path("/etc/systemd/system") / name).unlink(missing_ok=True)
        run(["systemctl", "daemon-reload"])


def proxy_test(source, parent, primary):
    compose(primary, "stop", "caddy")
    root = parent / "proxy-server"
    edge = "bod-test-edge-" + secrets.token_hex(5)
    config = parent / "edge.Caddyfile"
    config.write_text("localhost {\n    reverse_proxy 127.0.0.1:8080\n}\n")
    image = json.loads((source / "release.json").read_text())["images"]["caddy"]
    run(
        [
            "docker",
            "run",
            "-d",
            "--name",
            edge,
            "--network",
            "host",
            "--mount",
            f"type=bind,src={config},dst=/etc/caddy/Caddyfile,readonly",
            image,
        ]
    )
    try:
        output = cli(
            root,
            "install",
            "--domain",
            "localhost",
            "--https-mode",
            "proxy",
            "--insecure-localhost",
            "--no-system-integration",
            source=source,
            log=parent / "proxy-install.log",
        )
        password = re.search(r"Dočasné heslo: (\S+)", output).group(1)
        client = Client()
        client.login(password)
        client.call(
            "/api/v1/auth/change-password",
            {"current_password": password, "new_password": secrets.token_urlsafe(24)},
        )
        client.call("/app")
        state = json.loads((root / "installation.json").read_text())
        rendered = json.loads((root / "compose.json").read_text())
        ports = rendered["services"]["caddy"]["ports"]
        if (
            state["https_mode"] != "proxy"
            or len(ports) != 1
            or ports[0]["host_ip"] != "127.0.0.1"
        ):
            raise AssertionError("Proxy installation exposed unexpected ports")
    finally:
        run(["docker", "rm", "-f", edge])
        cleanup(root)
        cli(primary, "start")
    print("Existing HTTPS proxy mode passed", flush=True)


def exercise(bundle, root, output):
    if root.exists() and any(root.iterdir()):
        raise RuntimeError("Acceptance requires an empty installation directory")
    output.mkdir(parents=True, exist_ok=True)
    source = output / "release"
    extract(bundle, source)
    initial = cli(
        root,
        "install",
        "--domain",
        "localhost",
        "--insecure-localhost",
        source=source,
        log=output / "install.log",
    )
    if run(["systemctl", "is-enabled", "bod-backup.timer"]).strip() != "enabled":
        raise AssertionError("Daily backup timer is not enabled")
    run(["systemctl", "stop", "bod-backup.timer"])
    temporary = re.search(r"Dočasné heslo: (\S+)", initial).group(1)
    fixture = {"password": secrets.token_urlsafe(24)}
    client = Client()
    client.login(temporary)
    client.call(
        "/api/v1/auth/change-password",
        {"current_password": temporary, "new_password": fixture["password"]},
    )
    student = client.call(
        "/api/v1/admin/users",
        {
            "username": "acceptance.student",
            "display_name": "Před zálohou",
            "role_codes": ["student"],
        },
        status=201,
    )
    fixture["student_id"] = student["user"]["id"]
    media(root, b"school-media-before\x00\n")
    verify(root, fixture)
    (output / "fixture.json").write_text(json.dumps(fixture))
    (output / "fixture.json").chmod(0o600)
    cli(root, "install")
    verify(root, fixture)
    print(
        "Offline install, HTTPS, secure login, idempotence and systemd passed",
        flush=True,
    )
    cli(root, "backup", log=output / "backup.log")
    saved = json.loads((root / "last-backup.json").read_text())["path"]
    client.call(
        "/api/v1/admin/users/" + fixture["student_id"],
        {"display_name": "Po záloze"},
        method="PATCH",
    )
    media(root, b"school-media-after")
    candidate = output / "update"
    shutil.copytree(source, candidate, copy_function=os.link)
    original = json.loads((source / "release.json").read_text())
    next_version = original["version"].split("-")[0].split(".")
    next_version[-1] = str(int(next_version[-1]) + 1)
    target = {
        **original,
        "version": ".".join(next_version),
        "upgrade_from": [original["version"]],
    }
    (candidate / "release.json").unlink()
    (candidate / "release.json").write_text(json.dumps(target))
    cli(root, "update", "--bundle", str(candidate), "--yes", log=output / "update.log")
    verify(root, fixture, "Po záloze", b"school-media-after")
    if (
        json.loads((root / "installation.json").read_text())["version"]
        != target["version"]
    ):
        raise AssertionError("Update did not activate the candidate version")
    print("Versioned update and data preservation passed", flush=True)
    cli(root, "restore", saved, "--yes", log=output / "restore.log")
    verify(root, fixture)
    state = json.loads((root / "installation.json").read_text())
    if state["version"] != original["version"] or not state["retired_projects"]:
        raise AssertionError("Restore did not preserve previous volumes")
    print(
        "Restore of pre-update database, media and application version passed",
        flush=True,
    )
    proxy_test(source, output, root)
    cli(root, "backup", log=output / "final-backup.log")
    saved = Path(json.loads((root / "last-backup.json").read_text())["path"])
    shutil.copyfile(saved, output / "recovery.tar.gz")
    (output / "fixture.json").write_text(json.dumps(fixture))
    (output / "fixture.json").chmod(0o600)
    run(["systemctl", "stop", "bod-backup.timer"])
    print("Recovery archive ready for a fresh server", flush=True)


def fresh(bundle, root, output, archive, fixture_path):
    if root.exists() and any(root.iterdir()):
        raise RuntimeError(
            "Fresh-server restore requires an empty installation directory"
        )
    output.mkdir(parents=True, exist_ok=True)
    source = output / "release"
    extract(bundle, source)
    cli(
        root,
        "restore",
        str(archive),
        "--bundle",
        str(bundle),
        source=source,
        log=output / "fresh-restore.log",
    )
    verify(root, json.loads(fixture_path.read_text()))
    if run(["systemctl", "is-enabled", "bod-backup.timer"]).strip() != "enabled":
        raise AssertionError("Restored server did not enable backups")
    print(
        "Cold restore on an empty server preserved login, accounts, media and HTTPS",
        flush=True,
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bundle", type=Path)
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--phase", choices=["all", "fresh", "verify"], default="all")
    parser.add_argument("--archive", type=Path)
    parser.add_argument("--fixture", type=Path)
    parser.add_argument("--cleanup", action="store_true")
    args = parser.parse_args()
    os.umask(0o077)
    if os.geteuid() != 0:
        raise RuntimeError("Use sudo on a disposable Linux VM")
    if args.phase == "verify":
        verify(args.root, json.loads(args.fixture.read_text()))
        print("Reboot verification passed", flush=True)
        return
    existed = args.root.exists() and any(args.root.iterdir())
    try:
        if args.phase == "all":
            exercise(args.bundle, args.root, args.output)
        else:
            fresh(args.bundle, args.root, args.output, args.archive, args.fixture)
    finally:
        if args.cleanup and not existed:
            stop_system_integration(args.root)
            cleanup(args.root)


if __name__ == "__main__":
    main()
