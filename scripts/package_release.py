#!/usr/bin/env python3
"""Package tested local images and the canonical Compose into an offline release."""

from __future__ import annotations

import argparse
import gzip
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "infra" / "deploy"))

from runtime import (  # noqa: E402 - standalone tool loads the adjacent deployment runtime
    SERVICES,
    VERSION,
    Error,
    archive_files,
    digest,
    execute,
    read_json,
)


def package(output: Path, api: str, web: str) -> Path:
    metadata = read_json(ROOT / "infra" / "release.json")
    version = metadata["version"]
    if not VERSION.fullmatch(version):
        raise Error("Verze musí být SemVer bez prefixu v.")
    upgrades = metadata["upgrade_from"]
    if not all(VERSION.fullmatch(value) for value in upgrades):
        raise Error("Neplatná předchozí verze.")
    compose = json.loads(
        execute(
            [
                "docker",
                "compose",
                "-f",
                str(ROOT / "infra/docker-compose.yml"),
                "config",
                "--no-interpolate",
                "--no-normalize",
                "--no-path-resolution",
                "--format",
                "json",
            ],
            quiet=True,
        )
    )
    compose.pop("x-logging", None)
    compose.pop("name", None)
    references = {
        name: service.get("image") for name, service in compose["services"].items()
    }
    references.update(api=api, web=web)
    images = {}
    platform = None
    postgres_major = None
    for name in sorted(SERVICES):
        image = json.loads(
            execute(["docker", "image", "inspect", references[name]], quiet=True)
        )[0]
        current = image["Os"] + "/" + image["Architecture"]
        if current not in {"linux/amd64", "linux/arm64"} or platform not in {
            None,
            current,
        }:
            raise Error("Obrazy musí mít společnou podporovanou Linux platformu.")
        platform = current
        reference = f"bod-release/{name}:{image['Id'].removeprefix('sha256:')}"
        execute(["docker", "image", "tag", references[name], reference], quiet=True)
        images[name] = reference
        if name == "db":
            postgres_major = next(
                (
                    v.split("=", 1)[1]
                    for v in image["Config"]["Env"]
                    if v.startswith("PG_MAJOR=")
                ),
                None,
            )
        service = compose["services"][name]
        service.pop("build", None)
        service["image"] = reference
        service["pull_policy"] = "never"
    if not postgres_major:
        raise Error("Nelze určit hlavní verzi PostgreSQL.")
    for mount in compose["services"]["caddy"]["volumes"]:
        if mount["type"] == "bind":
            mount["source"] = "./Caddyfile"
            mount["read_only"] = True
            mount["bind"] = {"create_host_path": False}
    output.mkdir(parents=True, exist_ok=True)
    name = f"bod-{version}-{platform.replace('/', '-')}"
    result = output / f"{name}.tar.gz"
    if result.exists():
        raise Error("Vydaný balíček už existuje; jeho obsah se nepřepisuje.")
    with tempfile.TemporaryDirectory(prefix="bod-package-", dir=output) as directory:
        staging = Path(directory)
        shutil.copyfile(ROOT / "infra/deploy/bod.py", staging / "bod")
        shutil.copyfile(ROOT / "infra/deploy/runtime.py", staging / "runtime.py")
        shutil.copyfile(ROOT / "infra/Caddyfile", staging / "Caddyfile")
        (staging / "compose.json").write_text(json.dumps(compose, indent=2) + "\n")
        with (staging / "images.tar.gz").open("wb") as raw:
            with gzip.GzipFile(
                fileobj=raw, mode="wb", compresslevel=1, mtime=0
            ) as compressed:
                process = subprocess.Popen(
                    ["docker", "image", "save", *sorted(set(images.values()))],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                )
                try:
                    shutil.copyfileobj(process.stdout, compressed)
                finally:
                    process.stdout.close()
                process.stderr.read()
                process.stderr.close()
                if process.wait():
                    raise Error("Export Docker obrazů selhal.")
        files = {p.name: digest(p) for p in staging.iterdir()}
        manifest = {
            "format": 1,
            "version": version,
            "upgrade_from": upgrades,
            "platform": platform,
            "postgres_major": postgres_major,
            "images": images,
            "revision": execute(
                ["git", "-C", str(ROOT), "rev-parse", "HEAD"], quiet=True
            ).strip(),
            "files": files,
        }
        (staging / "release.json").write_text(json.dumps(manifest, indent=2) + "\n")
        (staging / "bod").chmod(0o755)
        temporary = output / f".{name}.partial"
        try:
            archive_files(staging, temporary, set(files) | {"release.json"})
            temporary.replace(result)
        finally:
            temporary.unlink(missing_ok=True)
    result.chmod(0o644)
    (output / f"{name}.sha256").write_text(f"{digest(result)}  {result.name}\n")
    print(result)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--api-image", required=True)
    parser.add_argument("--web-image", required=True)
    args = parser.parse_args()
    os.umask(0o077)
    try:
        package(args.output, args.api_image, args.web_image)
    except (Error, OSError) as error:
        print(f"Balíček nebyl vytvořen: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
