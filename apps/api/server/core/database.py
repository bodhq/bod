from collections.abc import Generator

from sqlmodel import Session, SQLModel, create_engine

from server.core.config import settings

# Musíme naimportovat všechny modely, aby je SQLModel.metadata zaregistroval
from server.modules.timetable.models import Lesson  # noqa

engine = create_engine(settings.database_url, echo=True)


def init_db() -> None:
    """Vytvoří všechny chybějící tabulky v databázi."""
    SQLModel.metadata.create_all(engine)

def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session
