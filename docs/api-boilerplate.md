# Tvorba nového API Modulu (Boilerplate)

Pokud vytváříte nový modul (např. `users`, `grades`), musíte dodržet 5-vrstvou architekturu. Tento dokument slouží jako šablona (Copy-Paste boilerplate), abyste nemuseli psát strukturu od nuly.

## 1. Vytvoření složky
Ve složce `apps/api/server/modules/` vytvořte novou složku se jménem vašeho modulu (např. `users`).

## 2. Tabulka: `models.py`
Tento soubor nesmí obsahovat nic kromě definice SQL tabulky.

```python
from sqlmodel import Field, SQLModel

class User(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    email: str = Field(unique=True, index=True)
    hashed_password: str
```

## 3. DTO Schémata: `schemas.py`
Definujte, co přesně vrací API. Heslo (`hashed_password`) sem nepatří!

```python
from pydantic import BaseModel, ConfigDict

class UserPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    email: str

class UserCreate(BaseModel):
    email: str
    password: str
```

## 4. Databázová vrstva: `repository.py`
Jediné místo, které volá `session.exec()`.

```python
from sqlmodel import Session, select
from server.modules.users.models import User

class UserRepository:
    def __init__(self, session: Session):
        self.session = session

    def get_by_email(self, email: str) -> User | None:
        return self.session.exec(select(User).where(User.email == email)).first()
    
    def create(self, user: User) -> User:
        self.session.add(user)
        self.session.commit()
        self.session.refresh(user)
        return user
```

## 5. Byznys logika: `services.py`
Dirigent. Zavolá repository, udělá výpočet a vrátí data.

```python
from sqlmodel import Session
from server.modules.users.repository import UserRepository
from server.modules.users.models import User
from server.modules.users.schemas import UserCreate
from server.core.exceptions import BadRequestException

class UserService:
    def __init__(self, session: Session):
        self.repository = UserRepository(session)

    def register_user(self, data: UserCreate) -> User:
        if self.repository.get_by_email(data.email):
            raise BadRequestException("Email již existuje.")
        
        # Zde by proběhlo hashování hesla...
        new_user = User(email=data.email, hashed_password=data.password)
        return self.repository.create(new_user)
```

## 6. HTTP Router: `router.py`
Přijme HTTP požadavek, předá ho do Service a vrátí DTO (`UserPublic`).

```python
from typing import Annotated
from fastapi import APIRouter, Depends
from sqlmodel import Session
from server.core.database import get_session
from server.modules.users.schemas import UserPublic, UserCreate
from server.modules.users.services import UserService

router = APIRouter(prefix="/users", tags=["users"])
SessionDep = Annotated[Session, Depends(get_session)]

@router.post("/register", response_model=UserPublic)
async def register(data: UserCreate, session: SessionDep) -> UserPublic:
    service = UserService(session)
    user = service.register_user(data)
    return UserPublic.model_validate(user)
```

## 7. Registrace Routeru
Nezapomeňte nový router přidat do `apps/api/server/api/router.py`:

```python
from server.modules.users.router import router as users_router
# ...
api_router.include_router(users_router)
```
