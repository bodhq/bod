from dataclasses import dataclass

from pydantic import BaseModel
from sqlmodel import SQLModel


@dataclass(frozen=True)
class Resource:
    name: str
    model: type[SQLModel]
    create_schema: type[BaseModel]
    patch_schema: type[BaseModel]
    read_schema: type[BaseModel]
    permission: str
