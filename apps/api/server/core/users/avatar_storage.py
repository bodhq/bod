"""Lokální soubory profilových fotek, bez závislosti na HTTP a databázi."""

import logging
import os
import re
from io import BytesIO
from pathlib import Path
from uuid import UUID, uuid4

from PIL import Image, ImageOps, UnidentifiedImageError

from server.core.exceptions import AppException, ErrorCode, NotFoundException

logger = logging.getLogger(__name__)
MAX_AVATAR_BYTES = 5 * 1024 * 1024
MAX_AVATAR_PIXELS = 16_000_000
AVATAR_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}


class AvatarTooLarge(AppException):
    def __init__(self) -> None:
        super().__init__(
            413, ErrorCode.MEDIA_FILE_TOO_LARGE, "Fotka může mít nejvýše 5 MiB."
        )


class AvatarStorageUnavailable(AppException):
    def __init__(self) -> None:
        super().__init__(
            503, ErrorCode.MEDIA_UNAVAILABLE, "Úložiště fotek není dostupné."
        )


def normalize_avatar(data: bytes) -> bytes:
    if len(data) > MAX_AVATAR_BYTES:
        raise AvatarTooLarge()
    try:
        with Image.open(BytesIO(data), formats=("JPEG", "PNG", "WEBP")) as image:
            if image.width * image.height > MAX_AVATAR_PIXELS:
                raise ValueError("Příliš velké rozlišení")
            if getattr(image, "is_animated", False):
                raise ValueError("Animované obrázky nejsou podporované")
            image.load()
            oriented = ImageOps.exif_transpose(image)
            oriented.thumbnail((512, 512))
            # Nový obraz nemá původní EXIF, GPS ani další metadata.
            mode = (
                "RGBA"
                if "A" in oriented.getbands() or "transparency" in image.info
                else "RGB"
            )
            normalized = Image.new(mode, oriented.size)
            normalized.paste(oriented.convert(mode))
            output = BytesIO()
            normalized.save(output, format="PNG")
            return output.getvalue()
    except (
        UnidentifiedImageError,
        OSError,
        ValueError,
        SyntaxError,
        Image.DecompressionBombError,
    ) as error:
        raise AppException(
            422,
            ErrorCode.VALIDATION_ERROR,
            "Pošli platný neanimovaný JPEG, PNG nebo WebP do 16 milionů pixelů.",
        ) from error


class LocalAvatarStorage:
    def __init__(self, root: Path) -> None:
        self.directory = root.resolve() / "avatars"

    def path(self, key: str) -> Path:
        # Klíče vytváří server. Kontrola chrání i před poškozeným záznamem DB.
        if re.fullmatch(r"[0-9a-f]{32}\.png", key) is None:
            raise AvatarStorageUnavailable()
        return self.directory / key

    @staticmethod
    def url_for(user_id: UUID, key: str) -> str:
        if re.fullmatch(r"[0-9a-f]{32}\.png", key) is None:
            raise AvatarStorageUnavailable()
        return f"/api/v1/users/{user_id}/avatar/{key}"

    @staticmethod
    def key_from_url(user_id: UUID, url: str) -> str:
        prefix = f"/api/v1/users/{user_id}/avatar/"
        if not url.startswith(prefix):
            raise AvatarStorageUnavailable()
        key = url.removeprefix(prefix)
        if re.fullmatch(r"[0-9a-f]{32}\.png", key) is None:
            raise AvatarStorageUnavailable()
        return key

    def write(self, image: bytes) -> str:
        key = f"{uuid4().hex}.png"
        path = self.path(key)
        created = False
        try:
            self.directory.mkdir(parents=True, exist_ok=True, mode=0o700)
            descriptor = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
            created = True
            with os.fdopen(descriptor, "wb") as file:
                file.write(image)
                file.flush()
                os.fsync(file.fileno())
        except OSError as error:
            if created:
                self.delete(key)
            raise AvatarStorageUnavailable() from error
        return key

    def read(self, key: str) -> bytes:
        try:
            return self.path(key).read_bytes()
        except FileNotFoundError as error:
            raise NotFoundException("Profilová fotka nebyla nalezena.") from error
        except OSError as error:
            raise AvatarStorageUnavailable() from error

    def delete(self, key: str | None) -> bool:
        if key is None:
            return False
        try:
            self.path(key).unlink(missing_ok=True)
            return True
        except (OSError, AvatarStorageUnavailable):
            # DB už mohla úspěšně commitnout. Chyba úklidu nesmí operaci
            # vykazovat jako neúspěšnou; osiřelý soubor uklidí údržba.
            logger.warning("Nepodařilo se uklidit soubor profilové fotky.")
            return False

    def keys(self) -> list[str]:
        if not self.directory.exists():
            return []
        return [
            p.name
            for p in self.directory.glob("*.png")
            if re.fullmatch(r"[0-9a-f]{32}\.png", p.name)
        ]
