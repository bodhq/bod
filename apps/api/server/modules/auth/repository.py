from sqlmodel import Session, select

from server.modules.auth.models import AuthSession


class AuthSessionRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_by_token_hash(self, token_hash: str) -> AuthSession | None:
        return self.db.exec(
            select(AuthSession).where(
                AuthSession.token_hash == token_hash
            )
        ).first()

    def create(self, auth_session: AuthSession) -> None:
        self.db.add(auth_session)
        self.db.commit()

    def save(self, auth_session: AuthSession) -> None:
        self.db.add(auth_session)
        self.db.commit()

    def delete(self, auth_session: AuthSession) -> None:
        self.db.delete(auth_session)
        self.db.commit()