"""Jednorázový převod původních PNG profilovek do WebP s kvalitou 85."""

import sys

from sqlalchemy.exc import OperationalError
from sqlmodel import Session

from server.core.access.repository import AccessRepository
from server.core.access.services import AccessService
from server.core.database import engine, init_db
from server.core.users.avatar_service import AvatarService


def main() -> None:
    try:
        init_db()
        with Session(engine) as session:
            service = AvatarService(AccessService(AccessRepository(session)))
            converted = service.convert_legacy()
    except OperationalError:
        print(
            "Převod se nezdařil kvůli databázové chybě. Ověř DATABASE_URL "
            "v kořenovém .env a dostupnost PostgreSQL. Pro lokální Docker "
            "spusť Docker Desktop a z kořene projektu: "
            "docker compose -f infra/docker-compose.dev.yml up -d db",
            file=sys.stderr,
        )
        raise SystemExit(1) from None
    print(f"Převedeno profilových fotek do WebP: {converted}")


if __name__ == "__main__":
    main()
