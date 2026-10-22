import secrets
from dataclasses import dataclass
from datetime import timedelta
from uuid import UUID

from server.core.audit.models import AuditEvent
from server.core.auth.models import AuthSession
from server.core.config import settings
from server.core.security import (
    create_session_token,
    generate_password,
    verify_password,
)
from server.core.security import (
    get_password_hash as hash_password,
)
from server.core.security import (
    hash_session_token as token_hash,
)
from server.core.users.avatar_storage import LocalAvatarStorage
from server.core.users.models import User, utcnow

from .catalog import ADMIN_PERMISSIONS, DEFAULT_ROLES, PERMISSIONS
from .models import Permission, Role, RolePermission
from .repository import AccessError, AccessRepository
from .schemas import (
    IssuedAccount,
    MeRead,
    ProfilePatch,
    RoleWrite,
    UserCreate,
    UserPatch,
    UserRead,
)


@dataclass(frozen=True)
class AccessContext:
    user: User
    session: AuthSession
    roles: list[str]
    permissions: set[str]
    # Snapshot pro audit: při odebrání vlastní role se session může změnit.
    active_role_code: str | None


class AccessService:
    def __init__(self, repository: AccessRepository) -> None:
        self.repo = repository
        self.avatar_storage = LocalAvatarStorage(settings.media_root)

    def present_users(self, users: list[User]) -> list[UserRead]:
        role_map = self.repo.roles_for_users([user.id for user in users])
        return [
            UserRead.model_validate(user).model_copy(
                update={"roles": role_map[user.id]}
            )
            for user in users
        ]

    def present_user(self, user: User) -> UserRead:
        return self.present_users([user])[0]

    def context(self, user: User, session: AuthSession) -> AccessContext:
        roles = self.repo.role_codes(user.id)
        active = session.active_role_code if session.active_role_code in roles else None
        permissions = self.repo.permission_codes(active)
        return AccessContext(user, session, roles, permissions, active)

    def me(self, context: AccessContext) -> MeRead:
        data = self.present_user(context.user).model_dump()
        return MeRead(
            **data,
            active_role=context.active_role_code,
            permissions=[]
            if context.user.must_change_password
            else sorted(context.permissions),
        )

    def require(self, context: AccessContext, permission: str) -> None:
        if context.user.must_change_password:
            raise AccessError("password_change_required", "Nejdřív změň dočasné heslo.")
        if permission not in context.permissions:
            raise AccessError(
                "forbidden", "Pro tuto operaci nemáš oprávnění v aktivní roli."
            )

    def manage(self, actor: AccessContext, permission: str) -> AccessContext:
        fresh = self.refresh_actor(actor)
        self.require(fresh, permission)
        return fresh

    def refresh_actor(self, actor: AccessContext) -> AccessContext:
        self.repo.lock_management()
        session = self.repo.session_id(actor.session.id)
        if session is None or session.expires_at <= utcnow():
            raise AccessError("unauthenticated", "Přihlášení již není platné.")
        user = self.repo.user(session.user_id)
        if not user.is_active:
            raise AccessError("unauthenticated", "Účet není aktivní.")
        fresh = self.context(user, session)
        return fresh

    def new_session(
        self, user: User, ip: str | None, agent: str | None, active: str | None = None
    ) -> tuple[str, AccessContext]:
        roles = self.repo.role_codes(user.id)
        if active not in roles:
            active = roles[0] if len(roles) == 1 else None
        raw_token = create_session_token()
        session = AuthSession(
            user_id=user.id,
            token_hash=token_hash(raw_token),
            active_role_code=active,
            ip_address=ip,
            user_agent=agent[:512] if agent else None,
            expires_at=utcnow() + timedelta(days=settings.session_idle_days),
        )
        self.repo.add(session)
        self.repo.flush()
        return raw_token, self.context(user, session)

    def change_password(
        self, context: AccessContext, current: str, new: str
    ) -> tuple[str, AccessContext]:
        context = self.refresh_actor(context)
        user = self.repo.user(context.user.id, lock=True)
        if not verify_password(current, user.hashed_password):
            raise AccessError("invalid_credentials", "Současné heslo není správné.")
        if verify_password(new, user.hashed_password):
            raise AccessError("invalid_request", "Nové heslo musí být jiné.")
        ip, agent, active = (
            context.session.ip_address,
            context.session.user_agent,
            context.session.active_role_code,
        )
        user.hashed_password = hash_password(new)
        user.must_change_password = False
        user.updated_at = utcnow()
        self.repo.revoke_sessions(user.id)
        self.repo.audit(context, "password.changed", "users", str(user.id))
        token, new_context = self.new_session(user, ip, agent, active)
        self.repo.commit()
        return token, new_context

    def switch_role(self, context: AccessContext, code: str) -> AccessContext:
        context = self.refresh_actor(context)
        if context.user.must_change_password:
            raise AccessError("password_change_required", "Nejdřív změň dočasné heslo.")
        if code not in self.repo.role_codes(context.user.id):
            raise AccessError("forbidden", "Tato role ti není přidělena.")
        context.session.active_role_code = code
        self.repo.commit()
        return self.context(context.user, context.session)

    def update_profile(self, actor: AccessContext, payload: ProfilePatch) -> UserRead:
        actor = self.manage(actor, "profile.self.update")
        user = self.repo.user(actor.user.id, lock=True)
        before = self.present_user(user).model_dump(mode="json")
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(user, field, value)
        user.updated_at = utcnow()
        self.repo.audit(
            actor,
            "profile.updated",
            "users",
            str(user.id),
            before=before,
            after=self.present_user(user).model_dump(mode="json"),
        )
        self.repo.commit()
        return self.present_user(user)

    def validate_roles(self, codes: set[str]) -> None:
        if "admin" in codes and len(codes) != 1:
            raise AccessError("invalid_request", "Admin musí mít samostatný účet.")
        for code in codes:
            self.repo.role(code)

    def validate_permissions(self, code: str, permissions: set[str]) -> None:
        for permission in permissions:
            if self.repo.find_permission(permission) is None:
                raise AccessError("invalid_request", "Neznámé oprávnění.")
        if code == "admin" and not permissions >= ADMIN_PERMISSIONS:
            raise AccessError(
                "conflict", "Administrátorovi nelze odebrat základní správu systému."
            )
        if code != "admin" and ADMIN_PERMISSIONS & permissions:
            raise AccessError(
                "invalid_request", "Správa systému patří na oddělenou roli admin."
            )

    def create_users(
        self, actor: AccessContext, payloads: list[UserCreate]
    ) -> list[IssuedAccount]:
        actor = self.manage(actor, "users.manage")
        issued = []
        for payload in payloads:
            roles = set(payload.role_codes)
            self.validate_roles(roles)
            password = generate_password()
            fields = payload.model_dump(exclude={"username", "role_codes"})
            username = payload.username or f"u_{secrets.token_hex(6)}"
            user = User(
                username=username, hashed_password=hash_password(password), **fields
            )
            self.repo.add(user)
            self.repo.flush()
            self.repo.replace_user_roles(user.id, roles)
            public = self.present_user(user)
            self.repo.audit(
                actor,
                "user.created",
                "users",
                str(user.id),
                after=public.model_dump(mode="json"),
                operation="created",
            )
            issued.append(IssuedAccount(user=public, temporary_password=password))
        self.repo.commit()
        return issued

    def protect_last_admin(
        self, user: User, next_roles: set[str], next_active: bool
    ) -> None:
        if (
            user.is_active
            and "admin" in self.repo.role_codes(user.id)
            and (not next_active or "admin" not in next_roles)
            and self.repo.active_admins_except(user.id) == 0
        ):
            raise AccessError(
                "conflict", "Nelze odstranit posledního aktivního administrátora."
            )

    def update_user(
        self, actor: AccessContext, user_id: UUID, payload: UserPatch
    ) -> UserRead:
        actor = self.manage(actor, "users.manage")
        user = self.repo.user(user_id, lock=True)
        before = self.present_user(user).model_dump(mode="json")
        fields = payload.model_dump(exclude_unset=True)
        roles = set(fields.pop("role_codes", self.repo.role_codes(user_id)))
        self.validate_roles(roles)
        self.protect_last_admin(user, roles, fields.get("is_active", user.is_active))
        for field, value in fields.items():
            setattr(user, field, value)
        user.updated_at = utcnow()
        self.repo.replace_user_roles(user_id, roles)
        if not user.is_active:
            self.repo.revoke_sessions(user_id)
        self.repo.audit(
            actor,
            "user.updated",
            "users",
            str(user_id),
            before=before,
            after=self.present_user(user).model_dump(mode="json"),
        )
        self.repo.commit()
        return self.present_user(user)

    def reset_password(self, actor: AccessContext, user_id: UUID) -> IssuedAccount:
        actor = self.manage(actor, "users.manage")
        user = self.repo.user(user_id, lock=True)
        password = generate_password()
        user.hashed_password = hash_password(password)
        user.must_change_password = True
        user.updated_at = utcnow()
        self.repo.revoke_sessions(user_id)
        self.repo.audit(actor, "password.reset", "users", str(user_id))
        self.repo.commit()
        return IssuedAccount(user=self.present_user(user), temporary_password=password)

    def delete_user(self, actor: AccessContext, user_id: UUID) -> None:
        actor = self.manage(actor, "users.manage")
        user = self.repo.user(user_id, lock=True)
        self.protect_last_admin(user, set(), False)
        if user.id == actor.user.id:
            raise AccessError("conflict", "Vlastní účet nemaž v aktuálním přihlášení.")
        before = self.present_user(user).model_dump(mode="json")
        avatar_key = (
            self.avatar_storage.key_from_url(user.id, user.avatar_url)
            if user.avatar_url is not None
            else None
        )
        self.repo.revoke_sessions(user_id)
        self.repo.replace_user_roles(user_id, set())
        self.repo.remove(user)
        self.repo.audit(
            actor,
            "user.deleted",
            "users",
            str(user_id),
            before=before,
            operation="deleted",
        )
        self.repo.commit()
        self.avatar_storage.delete(avatar_key)

    def role_data(self, role: Role) -> dict[str, object]:
        return {
            "code": role.code,
            "name": role.name,
            "description": role.description,
            "permission_codes": sorted(self.repo.permission_codes(role.code)),
        }

    def write_role(
        self,
        actor: AccessContext,
        code: str,
        payload: RoleWrite,
        *,
        create: bool = False,
    ) -> dict[str, object]:
        actor = self.manage(actor, "roles.manage")
        permissions = set(payload.permission_codes)
        self.validate_permissions(code, permissions)
        role = Role(code=code, name=payload.name) if create else self.repo.role(code)
        before = None if create else self.role_data(role)
        role.name, role.description = payload.name, payload.description
        self.repo.add(role)
        self.repo.flush()
        self.repo.replace_permissions(code, permissions)
        after = self.role_data(role)
        self.repo.audit(
            actor,
            "role.created" if create else "role.updated",
            "roles",
            code,
            before=before,
            after=after,
            operation="created" if create else "updated",
        )
        self.repo.commit()
        return after

    def delete_role(self, actor: AccessContext, code: str) -> None:
        actor = self.manage(actor, "roles.manage")
        if code in DEFAULT_ROLES:
            raise AccessError("conflict", "Výchozí systémovou roli nelze smazat.")
        role = self.repo.role(code)
        if self.repo.role_is_assigned(code):
            raise AccessError("conflict", "Role je stále přiřazená uživatelům.")
        before = self.role_data(role)
        self.repo.delete_role(role)
        self.repo.audit(
            actor, "role.deleted", "roles", code, before=before, operation="deleted"
        )
        self.repo.commit()

    def seed_catalog(self) -> None:
        # Existujícím rolím se po restartu nevracejí ručně odebraná oprávnění.
        for code, description in PERMISSIONS.items():
            if self.repo.find_permission(code) is None:
                self.repo.add(Permission(code=code, description=description))
        self.repo.flush()
        for code, (name, defaults) in DEFAULT_ROLES.items():
            created = self.repo.find_role(code) is None
            if created:
                self.repo.add(Role(code=code, name=name))
                self.repo.flush()
            existing = self.repo.permission_codes(code)
            for permission in defaults - existing:
                if created or (code == "admin" and permission in ADMIN_PERMISSIONS):
                    self.repo.add(
                        RolePermission(role_code=code, permission_code=permission)
                    )
        self.repo.flush()

    def bootstrap(self, username: str = "root") -> IssuedAccount | None:
        self.repo.lock_management()
        self.seed_catalog()
        if self.repo.has_any_admin():
            self.repo.commit()
            return None
        normalized = UserCreate(username=username, role_codes=["admin"]).username
        assert normalized is not None
        password = generate_password()
        user = User(username=normalized, hashed_password=hash_password(password))
        self.repo.add(user)
        self.repo.flush()
        self.repo.replace_user_roles(user.id, {"admin"})
        public = self.present_user(user)
        self.repo.audit(
            None,
            "admin.bootstrapped",
            "users",
            str(user.id),
            after=public.model_dump(mode="json"),
            operation="created",
        )
        self.repo.commit()
        return IssuedAccount(user=public, temporary_password=password)

    def list_users(
        self, actor: AccessContext, offset: int, limit: int
    ) -> list[UserRead]:
        self.require(actor, "users.manage")
        return self.present_users(self.repo.users(offset, limit))

    def read_user(self, actor: AccessContext, user_id: UUID) -> UserRead:
        self.require(actor, "users.manage")
        return self.present_user(self.repo.user(user_id))

    def list_roles(self, actor: AccessContext) -> list[dict[str, object]]:
        self.require(actor, "roles.manage")
        return [self.role_data(role) for role in self.repo.roles()]

    def list_permissions(self, actor: AccessContext) -> list[Permission]:
        self.require(actor, "roles.manage")
        return self.repo.permissions()

    def read_audit(
        self, actor: AccessContext, offset: int, limit: int
    ) -> list[AuditEvent]:
        self.require(actor, "audit.read")
        return self.repo.audit_events(offset, limit)
