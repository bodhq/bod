"""Shared, dependency-free primitives for release packaging and school operations."""

from __future__ import annotations

import contextlib
import hashlib
import json
import os
import re
import shutil
import subprocess
import tarfile
import tempfile
from pathlib import Path

SERVICES = {"api", "web", "db", "redis", "caddy"}
VOLUMES = {"postgres-data", "school-media", "caddy-data", "caddy-config"}
FILES = {"bod", "runtime.py", "compose.json", "Caddyfile", "images.tar.gz"}
LABEL = "org.bodhq.installation"
VERSION = re.compile(r"\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?")
IMAGE = re.compile(r"bod-release/(?:api|web|db|redis|caddy):[0-9a-f]{64}")


class Error(Exception):
    """An actionable operator error; never contains configuration values."""


def digest(path: Path) -> str:
    with path.open("rb") as source:
        return hashlib.file_digest(source, "sha256").hexdigest()


def read_json(path: Path) -> dict:
    try:
        if path.stat().st_size > 1024 * 1024:
            raise Error(f"Příliš velká metadata: {path.name}")
        result = json.loads(path.read_text())
        if not isinstance(result, dict):
            raise ValueError("expected object")
        return result
    except (OSError, ValueError) as exc:
        raise Error(f"Neplatná metadata: {path.name}") from exc


def atomic_write(path: Path, data: str | bytes, mode: int = 0o600) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, name = tempfile.mkstemp(prefix=".bod-", dir=path.parent)
    temporary = Path(name)
    try:
        with os.fdopen(fd, "wb") as target:
            target.write(data.encode() if isinstance(data, str) else data)
            target.flush()
            os.fsync(target.fileno())
        temporary.chmod(mode)
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)


def write_json(path: Path, value: dict) -> None:
    atomic_write(path, json.dumps(value, indent=2, ensure_ascii=False) + "\n")


def execute(
    args: list[str], *, input_file=None, output_file=None, quiet=False, env=None
) -> str:
    try:
        result = subprocess.run(
            args,
            stdin=input_file,
            stdout=output_file if output_file is not None else subprocess.PIPE,
            stderr=subprocess.PIPE,
            env=env,
            check=False,
        )
    except OSError as exc:
        raise Error(f"Nelze spustit {args[0]}; ověřte jeho instalaci.") from exc
    if result.returncode:
        # Raw daemon/process errors can contain environment values or SQL data.
        raise Error(
            f"Příkaz {args[0]} selhal (kód {result.returncode}). Zkontrolujte bod doctor."
        )
    text = result.stdout.decode(errors="replace") if result.stdout is not None else ""
    if not quiet and output_file is None and text:
        print(text, end="", flush=True)
    return text


def verify_release(folder: Path) -> dict:
    release = read_json(folder / "release.json")
    if (
        release.get("format") != 1
        or not isinstance(release.get("version"), str)
        or not VERSION.fullmatch(release["version"])
    ):
        raise Error("Nepodporovaný formát nebo verze vydání.")
    images = release.get("images", {})
    if (
        not isinstance(images, dict)
        or set(images) != SERVICES
        or not all(isinstance(v, str) and IMAGE.fullmatch(v) for v in images.values())
    ):
        raise Error("Vydání musí obsahovat přesné identity všech pěti obrazů.")
    if not isinstance(release.get("platform"), str) or release["platform"] not in {
        "linux/amd64",
        "linux/arm64",
    }:
        raise Error("Nepodporovaná platforma vydání.")
    upgrades = release.get("upgrade_from")
    if not isinstance(upgrades, list) or not all(
        isinstance(v, str) and VERSION.fullmatch(v) for v in upgrades
    ):
        raise Error("Neplatný seznam podporovaných předchozích verzí.")
    if not isinstance(release.get("postgres_major"), str):
        raise Error("Chybí hlavní verze PostgreSQL.")
    hashes = release.get("files", {})
    if not isinstance(hashes, dict) or set(hashes) != FILES:
        raise Error("Neúplný instalační balíček.")
    for name, expected in hashes.items():
        path = folder / name
        if path.is_symlink() or not path.is_file() or digest(path) != expected:
            raise Error(f"Kontrolní součet nesouhlasí: {name}")
    compose = read_json(folder / "compose.json")
    services = compose.get("services")
    if not isinstance(services, dict) or set(services) != SERVICES:
        raise Error("Neplatné služby v distribuční konfiguraci.")
    if (
        not isinstance(compose.get("volumes"), dict)
        or set(compose["volumes"]) != VOLUMES
    ):
        raise Error("Neplatné datové volumes v distribuční konfiguraci.")
    for name, service in compose["services"].items():
        if (
            not isinstance(service, dict)
            or "build" in service
            or service.get("image") != images[name]
        ):
            raise Error("Distribuce nesmí sestavovat ani zaměňovat obrazy.")
        if name != "caddy" and service.get("ports"):
            raise Error("Veřejný port může mít pouze proxy.")
        if service.get("privileged"):
            raise Error("Aplikační služba nesmí běžet jako privileged.")
    return release


def extract_archive(archive: Path, target: Path, allowed: set[str]) -> None:
    """Extract only flat regular files, with a preflight disk-space bound."""
    target.mkdir(parents=True, exist_ok=True)
    with tarfile.open(archive, "r:*") as source:
        members = source.getmembers()
        names = [member.name for member in members]
        if len(names) != len(set(names)) or set(names) != allowed:
            raise Error(
                "Archiv obsahuje chybějící, duplicitní nebo neočekávané soubory."
            )
        if any(not m.isfile() or m.name not in allowed for m in members):
            raise Error("Archiv smí obsahovat pouze běžné soubory.")
        if (
            sum(m.size for m in members) + 256 * 1024**2
            > shutil.disk_usage(target).free
        ):
            raise Error("Pro rozbalení archivu není dostatek místa.")
        for member in members:
            file = source.extractfile(member)
            if file is None:
                raise Error("Poškozený archiv.")
            with file, (target / member.name).open("xb") as output:
                shutil.copyfileobj(file, output)
            (target / member.name).chmod(0o600)


@contextlib.contextmanager
def release_source(path: Path):
    if path.is_dir():
        yield path, verify_release(path)
    else:
        with tempfile.TemporaryDirectory(prefix="bod-release-") as directory:
            folder = Path(directory)
            extract_archive(path, folder, FILES | {"release.json"})
            yield folder, verify_release(folder)


def validate_volume_archive(path: Path) -> None:
    with tarfile.open(path, "r:*") as source:
        for member in source:
            parts = Path(member.name).parts
            if (
                member.name.startswith("/")
                or ".." in parts
                or not (member.isfile() or member.isdir())
            ):
                raise Error(
                    "Záloha volume obsahuje nebezpečnou cestu nebo typ souboru."
                )


def archive_files(directory: Path, target: Path, names: set[str]) -> None:
    with tarfile.open(target, "w:gz", compresslevel=1) as archive:
        for name in sorted(names):
            archive.add(directory / name, arcname=name, recursive=False)
    target.chmod(0o600)
