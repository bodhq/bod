from uuid import UUID

from pydantic import BaseModel, ConfigDict

from server.modules.users.models import Role


class UserPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    role: Role