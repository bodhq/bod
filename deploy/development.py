#!/usr/bin/env python3
"""Pull verified develop images from GitHub; only for the development instance."""

import argparse
import json
import os
import re
import secrets
import subprocess
import sys
import tempfile
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import urlopen

from bod import School, read_env, write_env

REPOSITORY = "bodhq/bod"
MANIFEST = f"https://github.com/{REPOSITORY}/releases/download/development/images.env"
IMAGE = re.compile(r"ghcr\.io/bodhq/bod/(api|web)@sha256:[0-9a-f]{64}")


def fetch_images():
    with urlopen(MANIFEST, timeout=30) as response:
        payload = response.read(4097)
    if len(payload) > 4096:
        raise ValueError("Vývojový manifest je příliš velký.")
    rows = payload.decode("utf-8").splitlines()
    if len(rows) != 2:
        raise ValueError("Manifest musí obsahovat právě dva obrazy.")
    images = dict(line.split("=", 1) for line in rows)
    if set(images) != {"API_IMAGE", "WEB_IMAGE"}:
        raise ValueError("Manifest obsahuje neplatné klíče.")
    for service in ("api", "web"):
        value = images[f"{service.upper()}_IMAGE"]
        match = IMAGE.fullmatch(value)
        if not match or match[1] != service:
            raise ValueError("Manifest neobsahuje připnuté obrazy projektu bod.")
    return images


def configure(root, origin):
    url = urlsplit(origin)
    if (
        url.scheme not in {"http", "https"}
        or not url.hostname
        or url.username
        or url.password
        or url.path not in {"", "/"}
        or url.query
        or url.fragment
    ):
        raise ValueError("Zadej HTTP/HTTPS adresu bez cesty a přihlašovacích údajů.")
    if not re.fullmatch(r"[a-z0-9][a-z0-9.-]*", url.hostname):
        raise ValueError("Zadej doménu nebo IPv4 adresu.")
    if url.scheme == "https" and url.port not in {None, 443}:
        raise ValueError("Přímé HTTPS používá standardní port 443.")
    if (root / "config.env").exists():
        raise ValueError("Konfigurace už existuje; init ji nepřepisuje.")
    password = secrets.token_hex(24)
    write_env(
        root / "config.env",
        {
            "BOD_PROJECT": "bod-development",
            "BOD_BIND": "0.0.0.0",
            "BOD_HTTP_PORT": str(url.port or 80) if url.scheme == "http" else "80",
            "BOD_HTTPS_PORT": "443",
            "SITE_ADDRESS": "http://:80" if url.scheme == "http" else url.hostname,
            "POSTGRES_USER": "bod",
            "POSTGRES_DB": "bod",
            "POSTGRES_PASSWORD": password,
            "DOCKER_DATABASE_URL": f"postgresql://bod:{password}@db:5432/bod",
            "ALLOWED_ORIGINS": json.dumps([origin.rstrip("/")], separators=(",", ":")),
            "COOKIE_SECURE": str(url.scheme == "https").lower(),
        },
    )
    print("Vývojová konfigurace vytvořena. Nyní spusť update.")


def update(root):
    school = School(root)
    if (
        not school.config.exists()
        or read_env(school.config).get("BOD_PROJECT") != "bod-development"
    ):
        raise ValueError("Nejde o vývojovou instalaci; nejdřív spusť init.")
    with school.lock():
        images = fetch_images()
        applied = root / ".development-applied.env"
        if (
            applied.exists()
            and read_env(applied) == images
            and read_env(school.images) == images
        ):
            print("Vývojová verze je aktuální.")
            return
        school.require_space()
        if (root / ".initialized").exists():
            with tempfile.TemporaryDirectory(dir=root) as temporary:
                candidate = Path(temporary) / "images.env"
                write_env(candidate, images)
                school.update(candidate)
        else:
            write_env(school.images, images)
            school.compose("pull", "--policy", "missing")
            school.compose("up", "-d", "--wait", "--wait-timeout", "180")
            credentials = root / ".first-admin.txt"
            with credentials.open("a") as output:
                os.chmod(credentials, 0o600)
                school.compose(
                    "exec",
                    "-T",
                    "api",
                    "python",
                    "-m",
                    "server.scripts.bootstrap_admin",
                    stdout=output,
                )
            (root / ".initialized").touch(mode=0o600)
            print(
                "Údaje prvního správce jsou v .first-admin.txt; po přihlášení změň heslo."
            )
        write_env(applied, images)
        print("Vývojová verze byla ověřena a spuštěna.")


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parent)
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("init").add_argument("--origin", required=True)
    commands.add_parser("update")
    args = parser.parse_args()
    root = args.root.resolve()
    try:
        if args.command == "init":
            configure(root, args.origin)
        else:
            update(root)
    except (OSError, ValueError, subprocess.CalledProcessError) as error:
        print(f"Vývojové nasazení: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
