"""Initialize permissions and the first administrator for the domain API."""

from sqlmodel import Session

from server.core.access.repository import AccessRepository
from server.core.access.services import AccessService
from server.core.database import engine, init_db


def seed_db() -> None:
    init_db()
    with Session(engine) as session:
        issued = AccessService(AccessRepository(session)).bootstrap()
        if issued:
            print(f"Správce: {issued.user.username}")
            print(f"Dočasné heslo: {issued.temporary_password}")
            print("Při prvním přihlášení je nutná změna hesla.")
        else:
            print("Katalog oprávnění je připravený; správce již existuje.")


if __name__ == "__main__":
    seed_db()
