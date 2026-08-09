from uuid import UUID

from sqlmodel import Session, select

from server.modules.users.models import User


class UserRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_by_email(self, email: str) -> User | None:
        return self.db.exec(
            select(User).where(User.email == email)
        ).first()

    def get_by_id(self, user_id: UUID) -> User | None:
        return self.db.get(User, user_id)