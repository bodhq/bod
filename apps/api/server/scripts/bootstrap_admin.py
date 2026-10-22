"""Spusť uv run python -m server.scripts.bootstrap_admin [--username root]."""

import argparse

from sqlmodel import Session

from server.core.access.repository import AccessRepository
from server.core.access.services import AccessService
from server.core.database import engine, init_db


def main() -> None:
    parser = argparse.ArgumentParser(description="Vytvoří prvního správce bod.")
    parser.add_argument("--username", default="root")
    args = parser.parse_args()
    # Při vydávání hesla nesmí SQL logging vypsat parametry dotazů.
    engine.echo = False
    init_db()
    with Session(engine) as session:
        issued = AccessService(AccessRepository(session)).bootstrap(args.username)
    if issued is None:
        print("Správce již existuje. Žádný účet ani heslo se nezměnily.")
        return
    print(f"Uživatel: {issued.user.username}")
    print(f"Dočasné heslo: {issued.temporary_password}")
    print(
        "Při prvním přihlášení je nutná změna hesla. Heslo bezpečně předejte správci."
    )


if __name__ == "__main__":
    main()
