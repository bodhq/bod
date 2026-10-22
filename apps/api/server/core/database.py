from collections.abc import Generator

from sqlmodel import Session, create_engine

from server.core.access.models import (  # noqa: F401
    Permission,
    Role,
    RolePermission,
    UserRole,
)
from server.core.audit.models import AuditEvent  # noqa: F401
from server.core.auth.models import AuthSession  # noqa
from server.core.config import settings
from server.core.users.models import User  # noqa

# Musíme naimportovat všechny modely, aby je SQLModel.metadata zaregistroval
from server.modules.timetable.models import Lesson  # noqa

engine = create_engine(settings.database_url, echo=False, hide_parameters=True)


def init_db() -> None:
    """Inicializuje databázi a bezpečně převede starší auth schéma."""
    from server.core.migrations import migrate

    migrate(engine)


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session
