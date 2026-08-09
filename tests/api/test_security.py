from server.core.security import (
    create_session_token,
    get_password_hash,
    hash_session_token,
    verify_password,
)


def test_password_is_hashed_and_verifiable() -> None:
    password = "Moje-testovaci-heslo-2026"

    hashed_password = get_password_hash(password)

    assert hashed_password != password
    assert password not in hashed_password
    assert verify_password(password, hashed_password) is True


def test_wrong_password_is_rejected() -> None:
    hashed_password = get_password_hash("SpravneHeslo")

    assert verify_password("SpatneHeslo", hashed_password) is False


def test_same_password_creates_different_hashes() -> None:
    password = "StejneHeslo"

    first_hash = get_password_hash(password)
    second_hash = get_password_hash(password)

    assert first_hash != second_hash
    assert verify_password(password, first_hash) is True
    assert verify_password(password, second_hash) is True


def test_session_tokens_are_random() -> None:
    first_token = create_session_token()
    second_token = create_session_token()

    assert first_token != second_token
    assert len(first_token) >= 32


def test_session_token_hash_is_deterministic() -> None:
    token = "test-session-token"

    assert hash_session_token(token) == hash_session_token(token)
    assert hash_session_token(token) != hash_session_token("other-token")
    assert len(hash_session_token(token)) == 64