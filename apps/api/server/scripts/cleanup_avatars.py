"""Úklid souborů bez vazby na účet (například po pádu při nahrávání)."""

from sqlmodel import Session

from server.core.access.repository import AccessRepository
from server.core.access.services import AccessService
from server.core.database import engine, init_db
from server.core.users.avatar_service import AvatarService


def main() -> None:
    init_db()
    with Session(engine) as session:
        service = AvatarService(AccessService(AccessRepository(session)))
        removed = service.clean_orphans()
    print(f"Odstraněno osiřelých profilových fotek: {removed}")


if __name__ == "__main__":
    main()
