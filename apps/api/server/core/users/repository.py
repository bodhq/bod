from uuid import UUID

from sqlalchemy import func
from sqlmodel import Session, select

from server.core.users.models import User


class UserRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_by_username(self, username: str, *, lock: bool = False) -> User | None:
        normalized_username = username.strip().lower()

        query = select(User).where(func.lower(User.username) == normalized_username)
        return self.db.exec(query.with_for_update() if lock else query).first()

    def get_by_id(self, user_id: UUID) -> User | None:
        return self.db.get(User, user_id)
