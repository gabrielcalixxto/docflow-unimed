import pytest
from fastapi import HTTPException
from jose import jwt

from app.core.config import settings
from app.core.enums import UserRole
from app.core.security import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)


def test_hash_and_verify_password_roundtrip() -> None:
    hashed = hash_password("minha-senha")

    assert hashed != "minha-senha"
    assert verify_password("minha-senha", hashed) is True
    assert verify_password("outra-senha", hashed) is False


def test_create_access_token_includes_role_and_user_id() -> None:
    token = create_access_token(
        subject="autor.docflow",
        role=UserRole.AUTOR,
        roles=[UserRole.AUTOR, UserRole.REVISOR],
        email="autor@example.com",
        user_id=42,
        sector_ids=[10, 12],
    )
    decoded = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])

    assert decoded["sub"] == "autor.docflow"
    assert decoded["email"] == "autor@example.com"
    assert decoded["role"] == UserRole.AUTOR.value
    assert decoded["roles"] == [UserRole.AUTOR.value, UserRole.REVISOR.value]
    assert decoded["user_id"] == 42
    assert decoded["sector_ids"] == [10, 12]
    assert "exp" in decoded


def test_get_current_user_returns_authenticated_user() -> None:
    token = create_access_token(
        subject="admin.docflow",
        role=UserRole.ADMIN,
        roles=[UserRole.ADMIN, UserRole.REVISOR],
        email="admin@example.com",
        user_id=7,
        sector_ids=[9],
    )
    user = get_current_user(token)

    assert user.email == "admin@example.com"
    assert user.role == UserRole.ADMIN
    assert user.username == "admin.docflow"
    assert user.has_role(UserRole.REVISOR)
    assert user.normalized_sector_ids() == [9]
    assert user.user_id == 7


def test_get_current_user_raises_401_on_invalid_token() -> None:
    with pytest.raises(HTTPException) as exc_info:
        get_current_user("invalid.token.value")

    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "Could not validate credentials."
