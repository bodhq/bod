#!/usr/bin/env python3
"""Install and maintain one school's bod deployment. Python 3.12+, no pip packages."""

from __future__ import annotations

import argparse
import contextlib
import copy
import fcntl
import ipaddress
import json
import os
import platform
import re
import secrets
import shlex
import shutil
import socket
import ssl
import sys
import tarfile
import tempfile
import time
import urllib.request
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import urlsplit

from runtime import (
    FILES,
    LABEL,
    VERSION,
    VOLUMES,
    Error,
    archive_files,
    atomic_write,
    digest,
    execute,
    extract_archive,
    read_json,
    release_source,
    validate_volume_archive,
    verify_release,
    write_json,
)

APP_SERVICES = ["caddy", "web", "api"]
BACKUP_FILES = {
    "installation.json",
    "config.env",
    "database.dump",
    "school-media.tar.gz",
    "caddy-data.tar.gz",
    "caddy-config.tar.gz",
    "release.json",
}


def now() -> str:
    return datetime.now(UTC).isoformat()


def domain_name(value: str) -> str:
    value = value.strip().rstrip(".").encode("idna").decode("ascii").lower()
    if (
        len(value) > 253
        or not re.fullmatch(r"[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?", value)
        or any(
            not p or len(p) > 63 or p.startswith("-") or p.endswith("-")
            for p in value.split(".")
        )
    ):
        raise Error(
            "Zadejte doménu bez protokolu, portu a cesty, například bod.skola.cz."
        )
    return value


def project_name(value: str) -> str:
    if not re.fullmatch(r"bod-[a-z0-9][a-z0-9-]{2,48}", value):
        raise Error(
            "Název projektu musí začínat bod- a obsahovat malá písmena, číslice nebo pomlčky."
        )
    return value


def validate_state(state: dict) -> dict:
    if (
        state.get("format") != 1
        or not isinstance(state.get("id"), str)
        or not re.fullmatch(r"[0-9a-f]{24}", state["id"])
    ):
        raise Error("Adresář neobsahuje rozpoznanou instalaci bod.")
    for key in (
        "project",
        "version",
        "domain",
        "origin",
        "backup_dir",
        "bind",
        "phase",
    ):
        if not isinstance(state.get(key), str):
            raise Error("Konfigurace instalace není úplná.")
    project_name(state["project"])
    if (
        not VERSION.fullmatch(state["version"])
        or domain_name(state["domain"]) != state["domain"]
    ):
        raise Error("Neplatná verze nebo doména instalace.")
    if state.get("https_mode") not in {"direct", "proxy"}:
        raise Error("Neplatný způsob HTTPS.")
    for key in ("http_port", "https_port"):
        if type(state.get(key)) is not int or not 1 <= state[key] <= 65535:
            raise Error("Neplatný port instalace.")
    address = urlsplit(state["origin"])
    if (
        address.scheme != "https"
        or address.hostname != state["domain"]
        or address.username
        or address.path
        or address.query
        or address.fragment
        or (address.port or 443)
        != (state["https_port"] if state["https_mode"] == "direct" else 443)
    ):
        raise Error("Neplatná veřejná adresa instalace.")
    ipaddress.ip_address(state["bind"])
    if (
        type(state.get("insecure_localhost")) is not bool
        or state["insecure_localhost"]
        and state["domain"] != "localhost"
    ):
        raise Error("Ignorování certifikátu je dovoleno pouze pro localhost.")
    if (
        type(state.get("system_integration")) is not bool
        or type(state.get("backup_keep")) is not int
        or not 1 <= state["backup_keep"] <= 90
    ):
        raise Error("Neplatná konfigurace zálohování.")
    if not Path(state["backup_dir"]).is_absolute():
        raise Error("Cesta záloh musí být absolutní.")
    return state


def require_empty_project(project: str) -> None:
    if execute(
        [
            "docker",
            "ps",
            "-aq",
            "--filter",
            f"label=com.docker.compose.project={project}",
        ],
        quiet=True,
    ).strip():
        raise Error("Docker projekt už používá jiná instalace.")
    volumes = set(
        execute(
            ["docker", "volume", "ls", "--format", "{{.Name}}"], quiet=True
        ).splitlines()
    )
    if volumes & {f"{project}_{name}" for name in VOLUMES}:
        raise Error("Docker projekt už obsahuje data. Zvolte jiný projekt.")


def confirm(message: str, yes: bool) -> None:
    if yes:
        return
    if (
        not sys.stdin.isatty()
        or input(message + " [ano/ne]: ").strip().lower() != "ano"
    ):
        raise Error("Operace nebyla potvrzena. Pro automatizaci slouží --yes.")


def prompt(value, message, default=None):
    if value is not None:
        return value
    if not sys.stdin.isatty():
        if default is not None:
            return default
        raise Error(message + "; předejte hodnotu příslušným parametrem.")
    result = input(message + (f" [{default}]" if default else "") + ": ").strip()
    return result or default


def host_checks(release: dict, root: Path) -> None:
    if platform.system() != "Linux" or os.geteuid() != 0:
        raise Error("Instalaci a údržbu spouštějte přes sudo na Linux serveru.")
    info = json.loads(execute(["docker", "info", "--format", "{{json .}}"], quiet=True))
    arch = {"aarch64": "arm64", "x86_64": "amd64"}.get(
        info["Architecture"], info["Architecture"]
    )
    if release["platform"] != "linux/" + arch:
        raise Error("Balíček neodpovídá architektuře Docker serveru.")
    version = (
        execute(["docker", "compose", "version", "--short"], quiet=True)
        .strip()
        .lstrip("v")
    )
    numbers = tuple(int(v) for v in version.split(".")[:3] if v.isdigit())
    if numbers < (2, 24, 4):
        raise Error("Je potřeba Docker Compose alespoň 2.24.4.")
    if info["NCPU"] < 2 or info["MemTotal"] < 2 * 1024**3:
        raise Error(
            "Docker potřebuje alespoň 2 CPU a 2 GiB RAM; pro pilot doporučujeme 4 GiB."
        )
    for path in (root, Path(info["DockerRootDir"])):
        if shutil.disk_usage(path).free < 3 * 1024**3:
            raise Error(
                "Instalace i Docker potřebují alespoň 3 GiB volného místa; před údržbou doporučujeme 10 GiB a rezervu na data."
            )


@contextlib.contextmanager
def operation_lock(root: Path):
    root.mkdir(parents=True, exist_ok=True, mode=0o700)
    with (root / ".bod.lock").open("a") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as exc:
            raise Error("Právě běží jiná instalace, záloha nebo obnova.") from exc
        yield


def set_current(root: Path, release: Path) -> None:
    temporary = root / ".current-new"
    temporary.unlink(missing_ok=True)
    temporary.symlink_to(release.relative_to(root))
    temporary.replace(root / "current")


def store_release(root: Path, source: Path, metadata: dict) -> Path:
    destination = root / "releases" / metadata["version"]
    if destination.exists():
        if read_json(destination / "release.json") != metadata:
            raise Error("Stejná verze už má jiný obsah. Vydané verze se nepřepisují.")
        verify_release(destination)
        return destination
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(
        prefix=".release-", dir=destination.parent
    ) as name:
        staging = Path(name) / "payload"
        staging.mkdir(mode=0o700)
        for name in FILES | {"release.json"}:
            shutil.copyfile(source / name, staging / name)
        for path in staging.iterdir():
            path.chmod(0o700 if path.name == "bod" else 0o600)
        verify_release(staging)
        staging.rename(destination)
    return destination


def load_images(release: Path) -> None:
    # Always load the checksum-verified archive. This restores its exact tags on
    # both classic and containerd Docker stores, whose image IDs can differ.
    print("Načítám ověřené obrazy z balíčku…", flush=True)
    execute(
        [
            "docker",
            "image",
            "load",
            "--quiet",
            "--input",
            str(release / "images.tar.gz"),
        ],
        quiet=True,
    )
    for image in verify_release(release)["images"].values():
        execute(["docker", "image", "inspect", image], quiet=True)


class Installation:
    def __init__(self, root: Path):
        self.root = root

    def state(self) -> dict:
        return validate_state(read_json(self.root / "installation.json"))

    def compose(self, *args, quiet=False, input_file=None, output_file=None):
        state = self.state()
        environment = dict(os.environ)
        for key in (
            "POSTGRES_USER",
            "POSTGRES_PASSWORD",
            "POSTGRES_DB",
            "DOCKER_DATABASE_URL",
            "ALLOWED_ORIGINS",
        ):
            environment.pop(key, None)
        return execute(
            [
                "docker",
                "compose",
                "--project-name",
                state["project"],
                "--env-file",
                str(self.root / "config.env"),
                "--file",
                str(self.root / "compose.json"),
                *args,
            ],
            quiet=quiet,
            input_file=input_file,
            output_file=output_file,
            env=environment,
        )

    def activate(self, release: Path, state: dict) -> None:
        metadata = verify_release(release)
        state["version"] = metadata["version"]
        state["platform"] = metadata["platform"]
        state["postgres_major"] = metadata["postgres_major"]
        write_json(self.root / "installation.json", state)
        compose = read_json(release / "compose.json")
        for name in VOLUMES:
            compose["volumes"][name] = {
                "name": f"{state['project']}_{name}",
                "labels": {LABEL: state["id"]},
            }
        for service in compose["services"].values():
            service.setdefault("labels", {})[LABEL] = state["id"]
        caddy = compose["services"]["caddy"]
        caddy["environment"]["DOMAIN"] = (
            "http://" + state["domain"]
            if state["https_mode"] == "proxy"
            else state["domain"]
        )
        caddy["ports"] = [
            {
                "target": 80,
                "published": str(state["http_port"]),
                "host_ip": state["bind"],
                "protocol": "tcp",
            }
        ]
        if state["https_mode"] == "direct":
            caddy["ports"].extend(
                {
                    "target": 443,
                    "published": str(state["https_port"]),
                    "host_ip": state["bind"],
                    "protocol": protocol,
                }
                for protocol in ("tcp", "udp")
            )
        atomic_write(self.root / "Caddyfile", (release / "Caddyfile").read_bytes())
        write_json(self.root / "compose.json", compose)
        launcher = f'#!/bin/sh\nexec python3 {shlex.quote(str(self.root / "current/bod"))} --root {shlex.quote(str(self.root))} "$@"\n'
        atomic_write(self.root / "bod", launcher, 0o700)
        set_current(self.root, release)

    def up(self, *services) -> None:
        self.compose(
            "up", "-d", "--wait", "--wait-timeout", "180", *services, quiet=True
        )

    def probe(self) -> None:
        state = self.state()
        context = ssl.create_default_context()
        if state["insecure_localhost"]:
            context = ssl._create_unverified_context()
        deadline = time.monotonic() + 60
        while True:
            try:
                for path in ("/health", "/login"):
                    url = state["origin"] + path
                    with urllib.request.urlopen(
                        url, context=context, timeout=10
                    ) as response:
                        if response.status != 200 or response.url != url:
                            raise ValueError("Unexpected HTTP status or redirect")
                        if path == "/health":
                            health = json.load(response)
                            if (
                                not isinstance(health, dict)
                                or health.get("status") != "ok"
                            ):
                                raise ValueError("Database is not healthy")
                return
            except (OSError, ValueError) as exc:
                if time.monotonic() >= deadline:
                    raise Error(
                        "Služby běží, ale veřejné HTTPS není dostupné. Ověřte DNS a certifikát."
                    ) from exc
                time.sleep(2)

    def start(self) -> None:
        state = self.state()
        release = self.root / "releases" / state["version"]
        self.activate(release, state)
        self.up()
        self.probe()
        state["phase"] = "ready"
        write_json(self.root / "installation.json", state)

    def status(self) -> None:
        state = self.state()
        print(f"bod {state['version']} · {state['phase']} · {state['origin']}")
        self.compose("ps", "--all")
        last = self.root / "last-backup.json"
        if last.exists():
            record = read_json(last)
            print(f"Poslední záloha: {record['created_at']} · {record['path']}")
        else:
            print("Úplná záloha zatím nebyla vytvořena.")
        print(f"Adresář záloh: {state['backup_dir']}")

    def system_integration(self) -> None:
        root = str(self.root)
        if not re.fullmatch(r"/[A-Za-z0-9_./-]+", root):
            raise Error(
                "Pro systemd použijte instalační cestu bez mezer a zvláštních znaků."
            )
        link = Path("/usr/local/bin/bod")
        if link.exists() or link.is_symlink():
            if not link.is_symlink() or link.resolve() != self.root / "bod":
                raise Error(
                    "/usr/local/bin/bod již patří jinému programu nebo instalaci."
                )
        else:
            link.symlink_to(self.root / "bod")
        atomic_write(
            Path("/etc/systemd/system/bod-backup.service"),
            (
                "[Unit]\nDescription=bod complete school backup\nAfter=docker.service\n"
                f"[Service]\nType=oneshot\nExecStart={root}/bod backup\nUMask=0077\n"
            ),
            0o644,
        )
        atomic_write(
            Path("/etc/systemd/system/bod-backup.timer"),
            (
                "[Unit]\nDescription=Daily bod backup\n[Timer]\n"
                "OnCalendar=*-*-* 02:30:00 Europe/Prague\nRandomizedDelaySec=20m\n"
                "Persistent=true\n[Install]\nWantedBy=timers.target\n"
            ),
            0o644,
        )
        execute(["systemctl", "daemon-reload"], quiet=True)
        execute(["systemctl", "enable", "--now", "bod-backup.timer"], quiet=True)

    def running_apps(self) -> list[str]:
        running = self.compose(
            "ps", "--services", "--status", "running", quiet=True
        ).splitlines()
        return [service for service in APP_SERVICES if service in running]

    def volume(self, name: str, path: Path, restore=False) -> None:
        state = self.state()
        image = read_json(self.root / "releases" / state["version"] / "release.json")[
            "images"
        ]["db"]
        volume = f"{state['project']}_{name}"
        if restore:
            execute(
                [
                    "docker",
                    "volume",
                    "create",
                    "--label",
                    f"{LABEL}={state['id']}",
                    volume,
                ],
                quiet=True,
            )
        else:
            execute(["docker", "volume", "inspect", volume], quiet=True)
        args = [
            "docker",
            "run",
            "--rm",
            "--network",
            "none",
            "--user",
            "0:0",
            "--entrypoint",
            "tar",
            "--mount",
            f"type=volume,src={volume},dst=/data" + ("" if restore else ",readonly"),
        ]
        if restore:
            validate_volume_archive(path)
            with path.open("rb") as source:
                execute(
                    [*args, "-i", image, "-C", "/data", "-xzf", "-"],
                    input_file=source,
                    quiet=True,
                )
        else:
            with path.open("wb") as target:
                execute(
                    [*args, image, "-C", "/data", "-czf", "-", "."],
                    output_file=target,
                    quiet=True,
                )

    def backup(self, *, resume=True) -> Path:
        state = self.state()
        folder = Path(state["backup_dir"])
        folder.mkdir(parents=True, exist_ok=True, mode=0o700)
        stamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%S%fZ")
        result = folder / f"bod-backup-{state['id']}-{stamp}.tar.gz"
        running = self.running_apps()
        completed = False
        try:
            if running:
                self.compose("stop", *running, quiet=True)
            with tempfile.TemporaryDirectory(prefix=".bod-backup-", dir=folder) as name:
                temporary = Path(name)
                with (temporary / "database.dump").open("wb") as dump:
                    self.compose(
                        "exec",
                        "-T",
                        "db",
                        "sh",
                        "-c",
                        'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc',
                        output_file=dump,
                        quiet=True,
                    )
                for volume in ("school-media", "caddy-data", "caddy-config"):
                    self.volume(volume, temporary / f"{volume}.tar.gz")
                for file in ("installation.json", "config.env"):
                    shutil.copyfile(self.root / file, temporary / file)
                shutil.copyfile(
                    self.root / "releases" / state["version"] / "release.json",
                    temporary / "release.json",
                )
                manifest = {
                    "format": 1,
                    "created_at": now(),
                    "files": {p.name: digest(p) for p in temporary.iterdir()},
                }
                write_json(temporary / "backup.json", manifest)
                partial = folder / f".{result.name}.partial"
                try:
                    archive_files(temporary, partial, BACKUP_FILES | {"backup.json"})
                    partial.replace(result)
                finally:
                    partial.unlink(missing_ok=True)
            write_json(
                self.root / "last-backup.json",
                {
                    "created_at": manifest["created_at"],
                    "path": str(result),
                    "sha256": digest(result),
                },
            )
            candidates = sorted(folder.glob(f"bod-backup-{state['id']}-*.tar.gz"))
            for obsolete in candidates[: -state["backup_keep"]]:
                if obsolete.is_file() and not obsolete.is_symlink():
                    obsolete.unlink()
            print(f"Úplná záloha: {result}", flush=True)
            completed = True
            return result
        finally:
            if running and (resume or not completed):
                self.compose(
                    "up",
                    "-d",
                    "--no-deps",
                    "--wait",
                    "--wait-timeout",
                    "180",
                    *reversed(running),
                    quiet=True,
                )

    def update(self, source: Path, yes=False) -> None:
        state = self.state()
        with release_source(source) as (folder, release):
            host_checks(release, self.root)
            if state["version"] not in release["upgrade_from"]:
                raise Error("Vydání nepovoluje aktualizaci z nainstalované verze.")
            if state["postgres_major"] != release["postgres_major"]:
                raise Error(
                    "Změna hlavní verze PostgreSQL vyžaduje samostatný migrační postup."
                )
            confirm(
                f"Aktualizovat {state['version']} → {release['version']} s krátkou odstávkou?",
                yes,
            )
            candidate = store_release(self.root, folder, release)
            load_images(candidate)
            backup = self.backup(resume=False)
            state.update(phase="updating", pre_update_backup=str(backup))
            try:
                self.activate(candidate, state)
                self.start()
            except BaseException:
                state["phase"] = "update-failed"
                write_json(self.root / "installation.json", state)
                with contextlib.suppress(Error):
                    self.compose("stop", *APP_SERVICES, quiet=True)
                print(
                    f"Aktualizace nedokončena. Data zůstala zachována; záloha: {backup}",
                    file=sys.stderr,
                )
                raise
        print(f"Aktualizováno na {release['version']}.")


def discard_new_root(root: Path) -> None:
    """Remove only installer-owned files after a failed operation on an empty root."""
    for name in (
        "releases",
        "instances",
        "recovery",
        "installation.json",
        "config.env",
        "compose.json",
        "Caddyfile",
        "bod",
        "current",
        ".current-new",
    ):
        path = root / name
        if path.is_symlink() or path.is_file():
            path.unlink()
        elif path.is_dir():
            shutil.rmtree(path)


def install(args, root: Path) -> None:
    app = Installation(root)
    if (root / "installation.json").exists():
        state = app.state()
        if state["phase"] in {"installing", "install-failed"}:
            app.activate(root / "releases" / state["version"], state)
            app.up()
            app.probe()
            app.compose(
                "exec",
                "-T",
                "api",
                "python",
                "-m",
                "server.scripts.bootstrap_admin",
                "--username",
                state["admin_username"],
            )
            if state["system_integration"]:
                app.system_integration()
            state["phase"] = "ready"
            write_json(root / "installation.json", state)
            print("Instalace byla dokončena; existující hesla se nezměnila.")
            return
        print("Instalace už existuje; konfigurace ani hesla se nepřepisují.")
        app.status()
        return
    if set(root.iterdir()) - {root / ".bod.lock"}:
        raise Error(
            "Instalační adresář není prázdný. Existující soubory se nepřepisují."
        )
    try:
        with release_source(args.bundle or Path(__file__).resolve().parent) as (
            folder,
            release,
        ):
            host_checks(release, root)
            domain = domain_name(prompt(args.domain, "Doména aplikace"))
            mode = prompt(args.https_mode, "HTTPS: direct nebo proxy", "direct")
            if mode not in {"direct", "proxy"}:
                raise Error("Způsob HTTPS musí být direct nebo proxy.")
            username = prompt(args.admin, "Jméno prvního správce", "root")
            if not re.fullmatch(r"[a-zA-Z0-9][a-zA-Z0-9_.-]{2,63}", username):
                raise Error("Neplatné uživatelské jméno správce.")
            insecure = args.insecure_localhost
            if insecure and domain != "localhost":
                raise Error(
                    "Ignorování certifikátu je dovoleno pouze pro test na localhost."
                )
            try:
                socket.getaddrinfo(domain, None)
            except OSError as exc:
                raise Error("Doména nemá dostupný DNS záznam.") from exc
            backup_dir = Path(
                prompt(
                    args.backup_dir,
                    "Adresář záloh (například připojená NAS)",
                    str(root / "backups"),
                )
            ).resolve()
            if (
                backup_dir == root
                or root in backup_dir.parents
                and "releases" in backup_dir.parts
            ):
                raise Error("Adresář záloh nesmí přepisovat soubory instalace.")
            identity = secrets.token_hex(12)
            https_port = 443
            origin = f"https://{domain}"
            state = {
                "format": 1,
                "id": identity,
                "project": project_name("bod-" + identity[:12]),
                "version": release["version"],
                "phase": "installing",
                "created_at": now(),
                "domain": domain,
                "origin": origin,
                "https_mode": mode,
                "http_port": 8080 if mode == "proxy" else 80,
                "https_port": https_port,
                "bind": "127.0.0.1" if mode == "proxy" else "0.0.0.0",
                "insecure_localhost": insecure,
                "backup_dir": str(backup_dir),
                "backup_keep": 7,
                "system_integration": not args.no_system_integration,
                "admin_username": username,
            }
            validate_state(state)
            require_empty_project(state["project"])
            candidate = store_release(root, folder, release)
            load_images(candidate)
            password = secrets.token_hex(24)
            atomic_write(
                root / "config.env",
                (
                    f"POSTGRES_USER=bod\nPOSTGRES_DB=bod\nPOSTGRES_PASSWORD={password}\n"
                    f"DOCKER_DATABASE_URL=postgresql://bod:{password}@db:5432/bod\n"
                    f"ALLOWED_ORIGINS={json.dumps([origin])}\n"
                ),
            )
            app.activate(candidate, state)
            try:
                app.up()
                app.probe()
                app.compose(
                    "exec",
                    "-T",
                    "api",
                    "python",
                    "-m",
                    "server.scripts.bootstrap_admin",
                    "--username",
                    username,
                )
                if not args.no_system_integration:
                    app.system_integration()
                state["phase"] = "ready"
                write_json(root / "installation.json", state)
            except BaseException:
                state["phase"] = "install-failed"
                write_json(root / "installation.json", state)
                raise
    except BaseException:
        if not (root / "installation.json").exists():
            discard_new_root(root)
        raise
    print(
        f"Instalace připravena: {origin}\nPři prvním přihlášení změňte dočasné heslo."
    )


def verify_backup(folder: Path) -> dict:
    manifest = read_json(folder / "backup.json")
    if manifest.get("format") != 1 or set(manifest.get("files", {})) != BACKUP_FILES:
        raise Error("Nepodporovaný nebo neúplný archiv zálohy.")
    for name, expected in manifest["files"].items():
        if digest(folder / name) != expected:
            raise Error(f"Záloha má chybný kontrolní součet: {name}")
    for volume in ("school-media", "caddy-data", "caddy-config"):
        validate_volume_archive(folder / f"{volume}.tar.gz")
    state = validate_state(read_json(folder / "installation.json"))
    release = read_json(folder / "release.json")
    if state["version"] != release.get("version"):
        raise Error("Verze zálohy a aplikace se liší.")
    lines = (folder / "config.env").read_text().splitlines()
    values = dict(line.split("=", 1) for line in lines)
    if len(values) != len(lines) or set(values) != {
        "POSTGRES_USER",
        "POSTGRES_DB",
        "POSTGRES_PASSWORD",
        "DOCKER_DATABASE_URL",
        "ALLOWED_ORIGINS",
    }:
        raise Error("Záloha obsahuje neočekávané nastavení prostředí.")
    password = values["POSTGRES_PASSWORD"]
    if (
        not re.fullmatch(r"[0-9a-f]{48}", password)
        or values["POSTGRES_USER"] != "bod"
        or values["POSTGRES_DB"] != "bod"
        or values["DOCKER_DATABASE_URL"] != f"postgresql://bod:{password}@db:5432/bod"
        or json.loads(values["ALLOWED_ORIGINS"]) != [state["origin"]]
    ):
        raise Error("Záloha má nekonzistentní databázové nebo veřejné nastavení.")
    return manifest


def restore(args, root: Path) -> None:
    app = Installation(root)
    previous = app.state() if (root / "installation.json").exists() else None
    if previous:
        confirm("Obnovit zálohu do nových volumes s krátkou odstávkou?", args.yes)
    elif set(root.iterdir()) - {root / ".bod.lock"}:
        raise Error("Cílový adresář není prázdný.")
    candidate_running = False
    try:
        with tempfile.TemporaryDirectory(prefix=".restore-", dir=root) as directory:
            temporary = Path(directory)
            extract_archive(args.archive, temporary, BACKUP_FILES | {"backup.json"})
            verify_backup(temporary)
            restored = copy.deepcopy(read_json(temporary / "installation.json"))
            if previous and previous["id"] != restored["id"]:
                raise Error(
                    "Záloha patří jiné instalaci. Použijte prázdný cílový adresář."
                )
            release_meta = read_json(temporary / "release.json")
            available = root / "releases" / restored["version"]
            source = args.bundle or (available if available.exists() else None)
            if source is None:
                raise Error(
                    "Na novém serveru předejte --bundle s vydáním uvedeným v záloze."
                )
            with release_source(source) as (folder, release):
                if release != release_meta:
                    raise Error("Vydání neodpovídá záloze.")
                host_checks(release, root)
                candidate_release = store_release(root, folder, release)
                load_images(candidate_release)
            target_project = project_name("bod-restore-" + secrets.token_hex(6))
            require_empty_project(target_project)
            restored.update(project=target_project, phase="restoring")
            if args.backup_dir:
                restored["backup_dir"] = str(Path(args.backup_dir).resolve())
            validate_state(restored)
            # The candidate has its own Compose configuration throughout recovery.
            # Cleanup can therefore never address the original project's volumes.
            trial_root = root / "instances" / target_project
            trial_root.mkdir(parents=True)
            (trial_root / "releases").mkdir()
            release_alias = trial_root / "releases" / release["version"]
            release_alias.symlink_to(candidate_release)
            env = (temporary / "config.env").read_text()
            env = re.sub(
                r"^ALLOWED_ORIGINS=.*$",
                "ALLOWED_ORIGINS=" + json.dumps([restored["origin"]]),
                env,
                flags=re.M,
            )
            atomic_write(trial_root / "config.env", env)
            trial = Installation(trial_root)
            trial.activate(release_alias, restored)
            rendered = read_json(trial_root / "compose.json")
            for mount in rendered["services"]["caddy"]["volumes"]:
                if mount["type"] == "bind":
                    mount["source"] = str(root / "Caddyfile")
            write_json(trial_root / "compose.json", rendered)
            old = root / "recovery" / secrets.token_hex(6)
            previously_running = []
            if previous:
                old.mkdir(parents=True)
                for name in (
                    "installation.json",
                    "config.env",
                    "compose.json",
                    "Caddyfile",
                ):
                    shutil.copyfile(root / name, old / name)
                previously_running = app.compose(
                    "ps", "--services", "--status", "running", quiet=True
                ).splitlines()
            try:
                if previous:
                    app.compose("stop", quiet=True)
                atomic_write(
                    root / "Caddyfile", (candidate_release / "Caddyfile").read_bytes()
                )
                candidate_running = True
                trial.up("db", "redis")
                with (temporary / "database.dump").open("rb") as dump:
                    trial.compose(
                        "exec",
                        "-T",
                        "db",
                        "sh",
                        "-c",
                        'exec pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --no-privileges --exit-on-error',
                        input_file=dump,
                        quiet=True,
                    )
                for name in ("school-media", "caddy-data", "caddy-config"):
                    trial.volume(name, temporary / f"{name}.tar.gz", restore=True)
                trial.up()
                trial.probe()
                restored["phase"] = "ready"
                retired = previous.get("retired_projects", []) if previous else []
                restored["retired_projects"] = (
                    [
                        *retired,
                        {"project": previous["project"], "configuration": str(old)},
                    ]
                    if previous
                    else []
                )
                atomic_write(root / "config.env", env)
                app.activate(candidate_release, restored)
                if restored["system_integration"]:
                    app.system_integration()
            except BaseException:
                try:
                    trial.compose("down", "--volumes", quiet=True)
                    candidate_running = False
                except Error:
                    print(
                        f"Úklid kandidáta {target_project} selhal; zachovávám jeho konfiguraci v {trial_root}.",
                        file=sys.stderr,
                    )
                if previous:
                    for name in (
                        "installation.json",
                        "config.env",
                        "compose.json",
                        "Caddyfile",
                    ):
                        atomic_write(root / name, (old / name).read_bytes())
                    set_current(root, root / "releases" / previous["version"])
                    if previously_running:
                        app.up(*previously_running)
                raise
    except BaseException:
        if previous is None and not candidate_running:
            discard_new_root(root)
        raise
    print("Obnova dokončena. Předchozí datové volumes zůstaly zachované.")


def main(argv=None) -> int:
    os.umask(0o077)
    default_root = Path(__file__).resolve().parent.parent.parent
    if not (default_root / "installation.json").exists():
        default_root = Path("/opt/bod")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=default_root)
    commands = parser.add_subparsers(dest="command", required=True)
    installer = commands.add_parser(
        "install", help="Nainstalovat školní server z vydaného balíčku"
    )
    installer.add_argument("--bundle", type=Path)
    installer.add_argument("--domain")
    installer.add_argument("--admin")
    installer.add_argument("--https-mode", choices=["direct", "proxy"])
    installer.add_argument("--backup-dir")
    installer.add_argument(
        "--insecure-localhost",
        action="store_true",
        help="Pouze lokální test certifikátu",
    )
    installer.add_argument(
        "--no-system-integration",
        action="store_true",
        help="Bez globálního příkazu a systemd timeru",
    )
    commands.add_parser("status", help="Stav služeb, verze a poslední záloha")
    commands.add_parser("doctor", help="Ověření prostředí a dostupnosti aplikace")
    commands.add_parser("start", help="Znovu spustit nainstalovanou verzi")
    commands.add_parser("backup", help="Úplná konzistentní záloha s krátkou odstávkou")
    updater = commands.add_parser("update", help="Řízená aktualizace vydané verze")
    updater.add_argument("--bundle", type=Path, required=True)
    updater.add_argument("--yes", action="store_true")
    restorer = commands.add_parser("restore", help="Obnova do nových volumes")
    restorer.add_argument("archive", type=Path)
    restorer.add_argument("--bundle", type=Path)
    restorer.add_argument("--backup-dir")
    restorer.add_argument("--yes", action="store_true")
    args = parser.parse_args(argv)
    root = args.root.resolve()
    if len(root.parts) < 3:
        parser.error("Zvolte vlastní podadresář, například /opt/bod.")
    try:
        app = Installation(root)
        if args.command == "status":
            app.status()
        elif args.command == "doctor":
            app.status()
            state = app.state()
            host_checks(
                read_json(root / "releases" / state["version"] / "release.json"), root
            )
            app.probe()
            print("Prostředí a HTTPS odpovídají konfiguraci.")
        else:
            if platform.system() != "Linux" or os.geteuid() != 0:
                raise Error("Údržbu spouštějte přes sudo na Linux serveru.")
            with operation_lock(root):
                if args.command == "install":
                    install(args, root)
                elif args.command == "backup":
                    app.backup()
                elif args.command == "start":
                    app.start()
                elif args.command == "update":
                    app.update(args.bundle, args.yes)
                elif args.command == "restore":
                    restore(args, root)
        return 0
    except (Error, OSError, ValueError, KeyError, tarfile.TarError) as error:
        message = (
            str(error)
            if isinstance(error, Error)
            else "Operace selhala; ověřte soubory, volné místo a dostupnost Dockeru."
        )
        print(f"bod: {message}", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print("bod: Operace přerušena. Zkontrolujte bod status.", file=sys.stderr)
        return 130


if __name__ == "__main__":
    raise SystemExit(main())
