from dataclasses import dataclass
from uuid import UUID

from server.core.access.repository import AccessError
from server.core.access.schemas import UserRead
from server.core.access.services import AccessContext, AccessService
from server.core.exceptions import NotFoundException
from server.core.users.avatar_storage import normalize_avatar
from server.core.users.models import utcnow


@dataclass(frozen=True)
class AvatarImage:
    data: bytes
    media_type: str


class AvatarService:
    def __init__(self, access: AccessService) -> None:
        self.access = access
        self.storage = access.avatar_storage

    def permission(self, actor: AccessContext, user_id: UUID, *, write: bool) -> str:
        if actor.user.id != user_id:
            return "users.manage"
        return "profile.self.update" if write else "profile.self.read"

    def read(
        self, actor: AccessContext, user_id: UUID, filename: str | None = None
    ) -> AvatarImage:
        permission = self.permission(actor, user_id, write=False)
        self.access.require(actor, permission)
        # Zámek účtu chrání čtení souboru před souběžnou výměnou/smazáním.
        user = self.access.repo.user(user_id, lock=True)
        if user.avatar_url is None:
            raise NotFoundException("Profilová fotka nebyla nalezena.")
        key = self.storage.key_from_url(user_id, user.avatar_url)
        if filename is not None and filename != key:
            raise NotFoundException("Profilová fotka již není aktuální.")
        return AvatarImage(
            data=self.storage.read(key),
            media_type="image/webp" if key.endswith(".webp") else "image/png",
        )

    def update(self, actor: AccessContext, user_id: UUID, data: bytes) -> UserRead:
        permission = self.permission(actor, user_id, write=True)
        self.access.require(actor, permission)
        image = normalize_avatar(data)
        actor = self.access.manage(actor, permission)
        user = self.access.repo.user(user_id, lock=True)
        old_url = user.avatar_url
        old_key = self.storage.key_from_url(user_id, old_url) if old_url else None
        new_key = self.storage.write(image)
        try:
            user.avatar_url = self.storage.url_for(user_id, new_key)
            user.updated_at = utcnow()
            self.access.repo.audit(
                actor,
                "avatar.updated",
                "users",
                str(user_id),
                before={"avatar_url": old_url},
                after={"avatar_url": user.avatar_url},
            )
            self.access.repo.commit()
        except AccessError:
            # Repo při databázovém konfliktu provede rollback. U nejasného
            # výsledku commitu (např. výpadek spojení) soubor ponecháme:
            # případný sirotek je lepší než smazat již potvrzenou fotku.
            self.storage.delete(new_key)
            raise
        self.storage.delete(old_key)
        return self.access.present_user(user)

    def delete(self, actor: AccessContext, user_id: UUID) -> None:
        permission = self.permission(actor, user_id, write=True)
        actor = self.access.manage(actor, permission)
        user = self.access.repo.user(user_id, lock=True)
        old_url = user.avatar_url
        old_key = self.storage.key_from_url(user_id, old_url) if old_url else None
        if old_key is None:
            return
        user.avatar_url = None
        user.updated_at = utcnow()
        self.access.repo.audit(
            actor,
            "avatar.deleted",
            "users",
            str(user_id),
            before={"avatar_url": old_url},
            after={"avatar_url": None},
        )
        self.access.repo.commit()
        self.storage.delete(old_key)

    def clean_orphans(self) -> int:
        # Stejný zámek jako při zápisu: úklid nesmí smazat právě nahrávaný soubor.
        self.access.repo.lock_management()
        referenced = {
            self.storage.key_from_url(user_id, url)
            for user_id, url in self.access.repo.avatar_references()
        }
        orphans = set(self.storage.keys()) - referenced
        removed = sum(self.storage.delete(key) for key in orphans)
        self.access.repo.commit()
        return removed

    def convert_legacy(self) -> int:
        """Převede původní PNG; soubory se mažou až po potvrzení nové URL."""
        converted = 0
        for user_id, url in self.access.repo.avatar_references():
            if not url.endswith(".png"):
                continue
            self.access.repo.lock_management()
            user = self.access.repo.user(user_id, lock=True)
            old_url = user.avatar_url
            if old_url is None or not old_url.endswith(".png"):
                self.access.repo.commit()
                continue
            old_key = self.storage.key_from_url(user_id, old_url)
            data = normalize_avatar(self.storage.read(old_key))
            new_key = self.storage.write(data)
            try:
                user.avatar_url = self.storage.url_for(user_id, new_key)
                user.updated_at = utcnow()
                self.access.repo.audit(
                    None,
                    "avatar.converted",
                    "users",
                    str(user_id),
                    before={"avatar_url": old_url},
                    after={"avatar_url": user.avatar_url},
                )
                self.access.repo.commit()
            except AccessError:
                self.storage.delete(new_key)
                raise
            self.storage.delete(old_key)
            converted += 1
        return converted
