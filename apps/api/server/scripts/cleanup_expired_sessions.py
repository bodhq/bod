from sqlmodel import Session

from server.core.auth.repository import AuthSessionRepository
from server.core.auth.service import SessionCleanupService
from server.core.database import engine


def main() -> None:
    with Session(engine) as db:
        repository = AuthSessionRepository(db)
        cleanup_service = SessionCleanupService(repository)

        deleted_count = cleanup_service.remove_expired_sessions()

    print(f"Deleted {deleted_count} expired session(s).")


if __name__ == "__main__":
    main()