import hashlib
import secrets

from pwdlib import PasswordHash

password_hash = PasswordHash.recommended()
# Stejně nákladné ověření i pro neexistující účet.
DUMMY_PASSWORD_HASH = password_hash.hash(secrets.token_urlsafe(32))


def get_password_hash(password: str) -> str:
    return password_hash.hash(password)


def verify_password(password: str, hashed_password: str) -> bool:
    return password_hash.verify(password, hashed_password)


def generate_password() -> str:
    return secrets.token_urlsafe(24)


def create_session_token() -> str:
    return secrets.token_urlsafe(32)


def hash_session_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
