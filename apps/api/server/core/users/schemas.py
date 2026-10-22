from server.core.access.schemas import MeRead


class UserPublic(MeRead):
    """Vlastní profil včetně rolí a oprávnění aktuální relace."""
