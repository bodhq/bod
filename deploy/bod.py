#!/usr/bin/env python3
"""School operations over Docker Compose. Python 3.12+, no extra packages."""

import argparse
import contextlib
import fcntl
import json
import os
import re
import secrets
import shutil
import subprocess
import sys
import tarfile
from datetime import UTC, datetime
from pathlib import Path

APP = ("caddy", "web", "api")
BACKUP = ("config.env", "images.env", "database.dump", "media.tar.gz")


def read_env(path):
    result = {}
    for line in path.read_text().splitlines():
        if line and not line.startswith("#"):
            if "=" not in line:
                raise ValueError("Neplatný konfigurační soubor.")
            key, value = line.split("=", 1)
            if key in result:
                raise ValueError("Konfigurace obsahuje opakovaný klíč.")
            result[key] = value
    return result


def write_env(path, values):
    temporary = path.with_suffix(".partial")
    with temporary.open("w") as output:
        os.chmod(temporary, 0o600)
        output.write("".join(f"{key}={value}\n" for key, value in values.items()))
    temporary.replace(path)


class School:
    def __init__(self, root):
        self.root = root.resolve()
        self.config = self.root / "config.env"
        self.images = self.root / "images.env"

    def compose(self, *args, project=None, config=None, images=None, **kwargs):
        # Ambient development variables must never override the school's files.
        env = dict(os.environ)
        for path in (config or self.config, images or self.images):
            for key in read_env(path):
                env.pop(key, None)
        command = [
            "docker",
            "compose",
            "--env-file",
            str(config or self.config),
            "--env-file",
            str(images or self.images),
            "-f",
            str(self.root / "compose.yml"),
        ]
        command += ["-p", project or read_env(config or self.config)["BOD_PROJECT"]]
        kwargs.setdefault("timeout", 300)
        return subprocess.run(command + list(args), env=env, check=True, **kwargs)

    @contextlib.contextmanager
    def lock(self):
        with (self.root / ".lock").open("a") as handle:
            try:
                fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                raise ValueError("Jiná údržba této instalace už běží.") from None
            yield

    def running(self):
        result = self.compose(
            "ps", "--status", "running", "--services", capture_output=True, text=True
        )
        return [name for name in result.stdout.splitlines() if name in APP]

    def require_space(self):
        if shutil.disk_usage(self.root).free < 3 * 1024**3:
            raise ValueError(
                "Před změnou instalace uvolni alespoň 3 GiB na instalačním disku."
            )

    def install(self, domain, proxy):
        self.require_space()
        if (self.root / "installation.json").exists():
            raise ValueError("Starší offline instalace vyžaduje samostatný převod.")
        if not self.config.exists():
            domain = domain or input("Doména, například bod.skola.cz: ").strip()
            domain = domain.rstrip(".").encode("idna").decode("ascii").lower()
            if (
                len(domain) > 253
                or not re.fullmatch(r"[a-z0-9][a-z0-9.-]*", domain)
                or any(
                    not part
                    or len(part) > 63
                    or part.startswith("-")
                    or part.endswith("-")
                    for part in domain.split(".")
                )
            ):
                raise ValueError("Zadej doménu bez protokolu, portu a cesty.")
            password = secrets.token_hex(24)
            write_env(
                self.config,
                {
                    "BOD_PROJECT": "bod-" + secrets.token_hex(6),
                    "BOD_BIND": "127.0.0.1" if proxy else "0.0.0.0",
                    "BOD_HTTP_PORT": "8080" if proxy else "80",
                    "BOD_HTTPS_PORT": "8443" if proxy else "443",
                    "SITE_ADDRESS": "http://:80" if proxy else domain,
                    "POSTGRES_USER": "bod",
                    "POSTGRES_DB": "bod",
                    "POSTGRES_PASSWORD": password,
                    "DOCKER_DATABASE_URL": f"postgresql://bod:{password}@db:5432/bod",
                    "ALLOWED_ORIGINS": json.dumps(
                        ["https://" + domain], separators=(",", ":")
                    ),
                },
            )
        self.compose("pull", "--policy", "missing")
        self.compose("up", "-d", "--wait", "--wait-timeout", "180")
        marker = self.root / ".initialized"
        if not marker.exists():
            self.compose(
                "exec", "-T", "api", "python", "-m", "server.scripts.bootstrap_admin"
            )
            marker.touch(mode=0o600)
        print("Instalace běží. Dočasné heslo správce změň při prvním přihlášení.")

    def backup(self, destination):
        destination = destination.resolve()
        destination.mkdir(parents=True, exist_ok=True, mode=0o700)
        if any(destination.iterdir()):
            raise ValueError("Cílový adresář zálohy musí být prázdný.")
        os.chmod(destination, 0o700)
        running = self.running()
        try:
            if running:
                self.compose("stop", *running)
            for name in ("config.env", "images.env"):
                shutil.copyfile(self.root / name, destination / name)
            with (destination / "database.dump").open("wb") as output:
                self.compose(
                    "exec",
                    "-T",
                    "db",
                    "sh",
                    "-c",
                    'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc',
                    stdout=output,
                )
            with (destination / "media.tar.gz").open("wb") as output:
                self.compose(
                    "run",
                    "--rm",
                    "--no-deps",
                    "-T",
                    "--entrypoint",
                    "tar",
                    "api",
                    "-C",
                    "/var/lib/bod/media",
                    "-czf",
                    "-",
                    ".",
                    stdout=output,
                )
            for name in BACKUP:
                os.chmod(destination / name, 0o600)
            (destination / ".complete").touch(mode=0o600)
        finally:
            if running:
                self.compose("start", *running)
        print(f"Záloha: {destination}")
        return destination

    def validate_backup(self, source):
        if not (source / ".complete").is_file():
            raise ValueError("Záloha není dokončená.")
        for name in BACKUP:
            path = source / name
            if path.is_symlink() or not path.is_file() or not path.stat().st_size:
                raise ValueError(f"Chybí platná část zálohy: {name}")
        with tarfile.open(source / "media.tar.gz") as archive:
            for member in archive:
                parts = Path(member.name).parts
                if (
                    member.name.startswith("/")
                    or ".." in parts
                    or not (member.isfile() or member.isdir())
                ):
                    raise ValueError(
                        "Archiv médií obsahuje nebezpečnou cestu nebo odkaz."
                    )
        images = read_env(source / "images.env")
        if set(images) != {"API_IMAGE", "WEB_IMAGE"}:
            raise ValueError("Záloha obsahuje neplatné odkazy na obrazy.")
        return read_env(source / "config.env")

    def restore(self, source):
        self.require_space()
        source = source.resolve()
        config = self.validate_backup(source)
        candidate = config["BOD_PROJECT"][:30] + "-r-" + secrets.token_hex(6)
        arguments = {
            "project": candidate,
            "config": source / "config.env",
            "images": source / "images.env",
        }
        print(f"Projekt obnovy: {candidate}")
        try:
            self.compose("pull", "--policy", "missing", **arguments)
            self.compose("up", "-d", "--wait", "db", "redis", **arguments)
            with (source / "database.dump").open("rb") as data:
                self.compose(
                    "exec",
                    "-T",
                    "db",
                    "sh",
                    "-c",
                    'exec pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --exit-on-error --no-owner',
                    stdin=data,
                    **arguments,
                )
            with (source / "media.tar.gz").open("rb") as data:
                self.compose(
                    "run",
                    "--rm",
                    "--no-deps",
                    "-T",
                    "--entrypoint",
                    "tar",
                    "api",
                    "-C",
                    "/var/lib/bod/media",
                    "-xzf",
                    "-",
                    stdin=data,
                    **arguments,
                )
        except BaseException:
            with contextlib.suppress(
                OSError, subprocess.CalledProcessError, subprocess.TimeoutExpired
            ):
                self.compose("stop", "db", "redis", **arguments)
            raise
        previous = {
            path: read_env(path) if path.exists() else None
            for path in (self.config, self.images)
        }
        running = self.running() if self.config.exists() else []
        marker = self.root / ".initialized"
        initialized = marker.exists()
        try:
            if running:
                self.compose("stop", *running)
            self.compose("up", "-d", "--wait", "--wait-timeout", "180", **arguments)
            config["BOD_PROJECT"] = candidate
            write_env(self.images, read_env(source / "images.env"))
            write_env(self.config, config)
            marker.touch(mode=0o600)
        except BaseException:
            try:
                self.compose("stop", **arguments)
            finally:
                for path, values in previous.items():
                    if values is None:
                        path.unlink(missing_ok=True)
                    else:
                        write_env(path, values)
                if not initialized:
                    marker.unlink(missing_ok=True)
                if running:
                    self.compose("start", *running)
            raise
        if previous[self.config]:
            try:
                self.compose(
                    "stop", "db", "redis", project=previous[self.config]["BOD_PROJECT"]
                )
            except (OSError, subprocess.CalledProcessError, subprocess.TimeoutExpired):
                print(
                    "Obnova je dokončená; původní databázový projekt ještě ručně zastav.",
                    file=sys.stderr,
                )
        print("Obnova dokončena. Původní volumes zůstaly zachované.")

    def update(self, images):
        self.require_space()
        images = images.resolve()
        if images == self.images:
            raise ValueError(
                "Nové obrazy předej jako jiný soubor; původní images.env nepřepisuj."
            )
        refs = read_env(images)
        if set(refs) != {"API_IMAGE", "WEB_IMAGE"}:
            raise ValueError("images.env musí obsahovat pouze API_IMAGE a WEB_IMAGE.")
        self.compose("pull", "--policy", "missing", "api", "web", images=images)
        folder = self.root / "backups" / datetime.now(UTC).strftime("%Y%m%dT%H%M%S%fZ")
        self.backup(folder)
        write_env(self.images, refs)
        try:
            self.compose("up", "-d", "--wait", "--wait-timeout", "180")
        except subprocess.CalledProcessError:
            raise ValueError(
                f"Aktualizace selhala. Nové obrazy zůstávají zvolené; záloha: {folder}"
            ) from None


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parent)
    commands = parser.add_subparsers(dest="command", required=True)
    installer = commands.add_parser("install")
    installer.add_argument("--domain")
    installer.add_argument("--proxy", action="store_true")
    commands.add_parser("status")
    commands.add_parser("backup").add_argument("destination", type=Path)
    updater = commands.add_parser("update")
    updater.add_argument("images", type=Path)
    restorer = commands.add_parser("restore")
    restorer.add_argument("source", type=Path)
    restorer.add_argument("--yes", action="store_true")
    args = parser.parse_args()
    school = School(args.root)
    try:
        if args.command == "status":
            school.compose("ps")
        else:
            with school.lock():
                if args.command == "install":
                    school.install(args.domain, args.proxy)
                elif args.command == "backup":
                    school.backup(args.destination)
                elif args.command == "update":
                    school.update(args.images)
                elif args.command == "restore":
                    if (
                        not args.yes
                        and input("Obnovit školní data? [ano/ne]: ").strip().lower()
                        != "ano"
                    ):
                        raise ValueError("Obnova nebyla potvrzena.")
                    school.restore(args.source)
        return 0
    except KeyboardInterrupt:
        print(
            "Operace byla přerušena. Ověř stav služeb příkazem status.", file=sys.stderr
        )
        return 130
    except (
        ValueError,
        OSError,
        KeyError,
        subprocess.CalledProcessError,
        subprocess.TimeoutExpired,
        tarfile.TarError,
    ) as error:
        # Never include a subprocess command or school secrets in the operator message.
        print(
            str(error)
            if isinstance(error, ValueError)
            else "Operace selhala. Ověř Docker, soubory a volné místo.",
            file=sys.stderr,
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
