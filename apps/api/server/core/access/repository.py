from typing import TYPE_CHECKING, Any
from uuid import UUID

from sqlalchemy import delete, func, text, update
from sqlalchemy.engine import Result
from sqlalchemy.exc import IntegrityError
from sqlalchemy.sql import Executable
from sqlmodel import Session, SQLModel, col, select

from server.core.audit.models import AuditEvent
from server.core.auth.models import AuthSession
from server.core.exceptions import AppException, ErrorCode
from server.core.users.models import User

from .models import Permission, Role, RolePermission, UserRole

if TYPE_CHECKING:
    from .services import AccessContext


class AccessError(AppException):
    def __init__(self, code: str, message: str) -> None:
        statuses = {
            "invalid_request": (422, ErrorCode.VALIDATION_ERROR),
            "invalid_credentials": (401, ErrorCode.AUTH_INVALID_CREDENTIALS),
            "unauthenticated": (401, ErrorCode.AUTH_UNAUTHENTICATED),
            "forbidden": (403, ErrorCode.AUTH_FORBIDDEN),
            "password_change_required": (403, ErrorCode.AUTH_PASSWORD_CHANGE_REQUIRED),
            "not_found": (404, ErrorCode.RESOURCE_NOT_FOUND),
            "conflict": (409, ErrorCode.RESOURCE_CONFLICT),
        }
        status, error_code = statuses[code]
        super().__init__(status, error_code, message)


class AccessRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def lock_management(self) -> None:
        # Serializuje změny administrátorů, aby nešlo souběžně odebrat oba poslední.
        self.execute(text("SELECT pg_advisory_xact_lock(7463812041)"))

    def user(self, user_id: UUID, *, lock: bool = False) -> User:
        query = select(User).where(col(User.id) == user_id)
        if lock:
            query = query.with_for_update()
        user = self.db.exec(query.execution_options(populate_existing=True)).first()
        if user is None:
            raise AccessError("not_found", "Účet nebyl nalezen.")
        return user

    def username(self, username: str, *, lock: bool = False) -> User | None:
        query = select(User).where(col(User.username) == username.strip().lower())
        return self.db.exec(query.with_for_update() if lock else query).first()

    def role_codes(self, user_id: UUID) -> list[str]:
        return list(
            self.db.exec(
                select(col(UserRole.role_code))
                .where(col(UserRole.user_id) == user_id)
                .order_by(col(UserRole.role_code))
            ).all()
        )

    def permission_codes(self, role_code: str | None) -> set[str]:
        if role_code is None:
            return set()
        return set(
            self.db.exec(
                select(col(RolePermission.permission_code)).where(
                    col(RolePermission.role_code) == role_code
                )
            ).all()
        )

    def users(self, offset: int, limit: int) -> list[User]:
        return list(
            self.db.exec(
                select(User).order_by(col(User.username)).offset(offset).limit(limit)
            ).all()
        )

    def roles_for_users(self, ids: list[UUID]) -> dict[UUID, list[str]]:
        result: dict[UUID, list[str]] = {user_id: [] for user_id in ids}
        if ids:
            for item in self.db.exec(
                select(UserRole)
                .where(col(UserRole.user_id).in_(ids))
                .order_by(col(UserRole.role_code))
            ).all():
                result[item.user_id].append(item.role_code)
        return result

    def session(self, token_hash: str) -> AuthSession | None:
        return self.db.exec(
            select(AuthSession).where(col(AuthSession.token_hash) == token_hash)
        ).first()

    def revoke_sessions(self, user_id: UUID) -> None:
        self.execute(delete(AuthSession).where(col(AuthSession.user_id) == user_id))

    def replace_user_roles(self, user_id: UUID, codes: set[str]) -> None:
        # Composite FK vyžaduje zrušit aktivní výběr před smazáním user_roles.
        self.execute(
            update(AuthSession)
            .where(
                col(AuthSession.user_id) == user_id,
                col(AuthSession.active_role_code).not_in(codes),
            )
            .values(active_role_code=None)
        )
        self.execute(
            delete(UserRole).where(
                col(UserRole.user_id) == user_id, col(UserRole.role_code).not_in(codes)
            )
        )
        existing = set(self.role_codes(user_id))
        for code in sorted(codes - existing):
            self.db.add(UserRole(user_id=user_id, role_code=code))
        self.flush()

    def active_admins_except(self, user_id: UUID) -> int:
        query = (
            select(func.count())
            .select_from(User)
            .join(UserRole)
            .where(
                col(UserRole.role_code) == "admin",
                col(User.is_active),
                col(User.id) != user_id,
            )
        )
        return self.db.exec(query).one()

    def has_any_admin(self) -> bool:
        return (
            self.db.exec(
                select(UserRole).where(col(UserRole.role_code) == "admin")
            ).first()
            is not None
        )

    def flush(self) -> None:
        try:
            self.db.flush()
        except IntegrityError as error:
            self.db.rollback()
            raise AccessError(
                "conflict", "Záznam již existuje nebo je navázán na jiná data."
            ) from error

    def commit(self) -> None:
        try:
            self.db.commit()
        except IntegrityError as error:
            self.db.rollback()
            raise AccessError(
                "conflict", "Operace by porušila databázové vazby."
            ) from error

    def role(self, code: str) -> Role:
        role = self.db.get(Role, code)
        if role is None:
            raise AccessError("not_found", "Role nebyla nalezena.")
        return role

    def replace_permissions(self, code: str, permissions: set[str]) -> None:
        self.execute(
            delete(RolePermission).where(col(RolePermission.role_code) == code)
        )
        for permission in sorted(permissions):
            self.db.add(RolePermission(role_code=code, permission_code=permission))
        self.flush()

    def audit(
        self,
        actor: "AccessContext | None",
        event: str,
        entity_type: str,
        entity_id: str,
        *,
        before: dict[str, Any] | None = None,
        after: dict[str, Any] | None = None,
        operation: str = "updated",
    ) -> None:
        self.db.add(
            AuditEvent(
                actor_user_id=actor.user.id if actor else None,
                actor_role_code=actor.active_role_code if actor else None,
                operation=operation,
                event_code=event,
                entity_type=entity_type,
                entity_id=entity_id,
                before_data=before,
                after_data=after,
            )
        )

    def add(self, entity: SQLModel) -> None:
        self.db.add(entity)

    def remove(self, entity: SQLModel) -> None:
        self.db.delete(entity)

    def find_role(self, code: str) -> Role | None:
        return self.db.get(Role, code)

    def find_permission(self, code: str) -> Permission | None:
        return self.db.get(Permission, code)

    def session_id(self, session_id: UUID) -> AuthSession | None:
        return self.db.exec(
            select(AuthSession)
            .where(col(AuthSession.id) == session_id)
            .execution_options(populate_existing=True)
        ).first()

    def role_is_assigned(self, code: str) -> bool:
        return (
            self.db.exec(
                select(UserRole).where(col(UserRole.role_code) == code)
            ).first()
            is not None
        )

    def delete_role(self, role: Role) -> None:
        self.execute(
            delete(RolePermission).where(col(RolePermission.role_code) == role.code)
        )
        self.db.delete(role)

    def roles(self) -> list[Role]:
        return list(self.db.exec(select(Role).order_by(col(Role.code))).all())

    def permissions(self) -> list[Permission]:
        return list(
            self.db.exec(select(Permission).order_by(col(Permission.code))).all()
        )

    def audit_events(self, offset: int, limit: int) -> list[AuditEvent]:
        return list(
            self.db.exec(
                select(AuditEvent)
                .order_by(col(AuditEvent.created_at).desc())
                .offset(offset)
                .limit(limit)
            ).all()
        )

    def avatar_references(self) -> list[tuple[UUID, str]]:
        return [
            (user_id, url)
            for user_id, url in self.db.exec(
                select(col(User.id), col(User.avatar_url))
            ).all()
            if url is not None
        ]

    def execute(self, statement: Executable) -> Result[Any]:
        try:
            return self.db.execute(statement)
        except IntegrityError as error:
            self.db.rollback()
            raise AccessError(
                "conflict",
                "Operace by porušila databázové vazby; účet s historií deaktivuj.",
            ) from error
