from datetime import datetime
from uuid import UUID

from sqlmodel import Session, desc, select

from server.core.auth.models import AuthSession


class AuthSessionRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_by_token_hash(self, token_hash: str) -> AuthSession | None:
        return self.db.exec(
            select(AuthSession).where(
                AuthSession.token_hash == token_hash
            )
        ).first()

    def get_by_id_and_user_id(
        self,
        session_id: UUID,
        user_id: UUID,
    ) -> AuthSession | None:
        return self.db.exec(
            select(AuthSession).where(
                AuthSession.id == session_id,
                AuthSession.user_id == user_id,
            )
        ).first()

    def get_active_for_user(
        self,
        user_id: UUID,
        now: datetime,
    ) -> list[AuthSession]:
        return list(
            self.db.exec(
                select(AuthSession)
                .where(
                    AuthSession.user_id == user_id,
                    AuthSession.expires_at > now,
                )
                .order_by(desc(AuthSession.last_seen_at))
            ).all()
        )

    def create(self, auth_session: AuthSession) -> None:
        self.db.add(auth_session)
        self.db.commit()

    def save(self, auth_session: AuthSession) -> None:
        self.db.add(auth_session)
        self.db.commit()

    def delete(self, auth_session: AuthSession) -> None:
        self.db.delete(auth_session)
        self.db.commit()
